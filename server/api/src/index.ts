import crypto from "node:crypto";
import { DomainError, randomId, sha256 } from "./core";
import { compatibilityActions, DomainService, Actor } from "./domain";
import { CloudStore, Store } from "./store";

// wx-server-sdk is provided by the CloudBase function runtime package.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const store = new CloudStore(cloud.database());

function parseAllowlist(raw: unknown): Set<string> {
  return new Set(String(raw || "").split(",").map((value) => value.trim()).filter(Boolean));
}

function secureEqual(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function ensureIdentity(database: Store, appid: string, openid: string, now: number): Promise<Actor> {
  const identityId = sha256(`${appid}${openid}`);
  const legacyIdentityId = `idn_${identityId.slice(0, 40)}`;
  return database.runTransaction(async (transaction) => {
    const currentMapping = await transaction.get("identities", identityId);
    const legacyMapping = currentMapping ? null : await transaction.get("identities", legacyIdentityId);
    const mapping = currentMapping || legacyMapping;
    if (mapping) {
      const existingUser = await transaction.get("users", mapping.user_id);
      if (existingUser) {
        const migratedUser = existingUser.identity_id === identityId ? existingUser : await transaction.update("users", existingUser._id, { identity_id: identityId, updated_at: now });
        if (legacyMapping) {
          await transaction.put("identities", identityId, { ...legacyMapping, _id: identityId, updated_at: now });
          await transaction.delete("identities", legacyIdentityId);
        }
        return migratedUser as Actor;
      }
    }

    // Compatibility migrations for the P0 raw-OpenID document and the early V1
    // hashed-identity user document. Neither form is kept after this migration.
    const hashedLegacy = await transaction.get("users", legacyIdentityId);
    const rawLegacy = await transaction.get("users", openid);
    const legacy = hashedLegacy || rawLegacy;
    const businessUserId = legacy?.user_id || randomId("usr");
    const user: Actor = {
      _id: businessUserId,
      identity_id: identityId,
      user_id: businessUserId,
      nickname: legacy?.nickname || "",
      avatar_key: legacy?.avatar_key || "sage",
      profile_completed: Boolean(legacy?.nickname),
      couple_id: null,
      status: "active",
      created_at: legacy?.created_at || legacy?.createdAt || now,
      updated_at: now,
    };
    await transaction.put("users", businessUserId, user);
    await transaction.put("identities", identityId, { appid, openid, user_id: businessUserId, created_at: mapping?.created_at || now, updated_at: now });
    if (legacyMapping) await transaction.delete("identities", legacyIdentityId);
    if (hashedLegacy) await transaction.delete("users", legacyIdentityId);
    if (rawLegacy) await transaction.delete("users", openid);
    return user;
  });
}

function success(data: unknown, requestId: string, serverTime: number) {
  return { ok: true, data, request_id: requestId, server_time: serverTime };
}

function failure(error: unknown, requestId: string, serverTime: number) {
  if (error instanceof DomainError) {
    return {
      ok: false,
      error: { code: error.code, message: error.message, retryable: error.retryable },
      request_id: requestId,
      server_time: serverTime,
    };
  }
  console.error("[couple-oa-api]", { request_id: requestId, error_name: (error as any)?.name || "UnknownError" });
  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "服务暂不可用，请稍后重试。", retryable: true },
    request_id: requestId,
    server_time: serverTime,
  };
}

export async function main(event: Record<string, any> = {}) {
  const serverTime = Date.now();
  const suppliedRequestId = typeof event.request_id === "string" ? event.request_id : typeof event.requestId === "string" ? event.requestId : "";
  const responseRequestId = suppliedRequestId || randomId("req");
  try {
    const context = cloud.getWXContext();
    if (!context.OPENID || !context.APPID) throw new DomainError("UNAUTHENTICATED", "无法验证微信身份，请确认小程序与云环境已关联。");

    const requestedAction = typeof event.action === "string" ? event.action : "";
    const normalized = compatibilityActions[requestedAction] || requestedAction;
    const isBootstrap = normalized === "auth.bootstrap";
    if (isBootstrap) {
      const configured = process.env.COUPLE_OA_BOOTSTRAP_TOKEN;
      const submitted = event.payload?.bootstrap_token ?? event.payload?.bootstrapToken;
      if (!configured) throw new DomainError("BOOTSTRAP_DISABLED", "开发初始化入口未开启。");
      if (!secureEqual(configured, submitted) || String(submitted).length < 24) throw new DomainError("BOOTSTRAP_TOKEN_INVALID", "开发初始化令牌无效。");
    } else {
      const allowlist = parseAllowlist(process.env.COUPLE_OA_ALLOWED_OPENIDS);
      if (!allowlist.size) throw new DomainError("IDENTITY_ALLOWLIST_UNCONFIGURED", "开发环境尚未配置身份白名单。");
      if (!allowlist.has(context.OPENID)) throw new DomainError("IDENTITY_NOT_ALLOWED", "当前微信身份未获授权，可进入只读演示模式。");
    }

    const user = await ensureIdentity(store, context.APPID, context.OPENID, serverTime);
    const action = isBootstrap ? "auth.get" : normalized;
    const service = new DomainService(store, () => serverTime);
    const data = await service.execute(action, event.payload || {}, user, suppliedRequestId);
    return success(data, responseRequestId, serverTime);
  } catch (error) {
    return failure(error, responseRequestId, serverTime);
  }
}

export { ensureIdentity, parseAllowlist };
