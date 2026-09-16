const crypto = require("node:crypto");

function parseAllowlist(rawAllowlist) {
  return new Set(
    String(rawAllowlist || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function toBusinessUserId(openid) {
  return `usr_${crypto.createHash("sha256").update(openid).digest("hex").slice(0, 24)}`;
}

function domainError(code, message, retryable = false) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

async function resolveIdentity({ openid, allowlist, users, now = () => Date.now() }) {
  if (!openid || typeof openid !== "string") {
    throw domainError("IDENTITY_CONTEXT_MISSING", "无法验证微信身份，请确认小程序与云环境已关联。");
  }
  const allowedOpenids = parseAllowlist(allowlist);
  if (allowedOpenids.size === 0) {
    throw domainError("IDENTITY_ALLOWLIST_UNCONFIGURED", "环境尚未完成身份白名单配置，请由账号持有人处理。 ");
  }
  if (!allowedOpenids.has(openid)) {
    throw domainError("IDENTITY_NOT_ALLOWED", "当前微信身份未获开发白名单授权。 ");
  }

  return getOrCreateIdentity({ openid, users, now });
}

/**
 * 仅用于建立开发白名单前的受控初始化。令牌只保存为云函数环境变量，
 * 初始化完成、从控制台登记 OpenID 后必须删除该变量并重新部署。
 */
async function bootstrapIdentity({ openid, bootstrapToken, submittedToken, users, now = () => Date.now() }) {
  if (!openid || typeof openid !== "string") {
    throw domainError("IDENTITY_CONTEXT_MISSING", "无法验证微信身份，请确认小程序与云环境已关联。");
  }
  if (!bootstrapToken) {
    throw domainError("BOOTSTRAP_DISABLED", "开发初始化入口未开启。", false);
  }
  if (typeof submittedToken !== "string" || submittedToken.length < 24 || submittedToken !== bootstrapToken) {
    throw domainError("BOOTSTRAP_TOKEN_INVALID", "开发初始化令牌无效。", false);
  }
  return getOrCreateIdentity({ openid, users, now });
}

async function getOrCreateIdentity({ openid, users, now }) {
  const existing = await users.getByOpenId(openid);
  if (existing) return { userId: existing.userId, isNew: false };

  const timestamp = now();
  const user = {
    _id: openid,
    userId: toBusinessUserId(openid),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await users.create(user);
  return { userId: user.userId, isNew: true };
}

module.exports = { bootstrapIdentity, parseAllowlist, resolveIdentity, toBusinessUserId };
