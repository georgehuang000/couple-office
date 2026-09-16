"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/api/src/index.ts
var index_exports = {};
__export(index_exports, {
  ensureIdentity: () => ensureIdentity,
  main: () => main,
  parseAllowlist: () => parseAllowlist
});
module.exports = __toCommonJS(index_exports);
var import_node_crypto2 = __toESM(require("node:crypto"));

// server/api/src/core.ts
var import_node_crypto = __toESM(require("node:crypto"));
var DomainError = class extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
};
function fail(code, message, retryable = false) {
  throw new DomainError(code, message, retryable);
}
function sha256(value) {
  return import_node_crypto.default.createHash("sha256").update(value).digest("hex");
}
function randomId(prefix) {
  return `${prefix}_${import_node_crypto.default.randomBytes(12).toString("base64url")}`;
}
function randomInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = import_node_crypto.default.randomBytes(10);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function stringField(payload, key, options = {}) {
  const raw = payload[key];
  if (raw === void 0 || raw === null) {
    if (options.required) fail("VALIDATION_ERROR", `${key} \u4E3A\u5FC5\u586B\u9879\u3002`);
    return "";
  }
  if (typeof raw !== "string") fail("VALIDATION_ERROR", `${key} \u683C\u5F0F\u4E0D\u6B63\u786E\u3002`);
  const value = raw.trim();
  if (options.required && !value) fail("VALIDATION_ERROR", `${key} \u4E3A\u5FC5\u586B\u9879\u3002`);
  if (options.min && value.length < options.min) fail("VALIDATION_ERROR", `${key} \u81F3\u5C11\u9700\u8981 ${options.min} \u4E2A\u5B57\u7B26\u3002`);
  if (options.max && value.length > options.max) fail("VALIDATION_ERROR", `${key} \u6700\u591A\u5141\u8BB8 ${options.max} \u4E2A\u5B57\u7B26\u3002`);
  return value;
}
function optionalNumber(payload, key) {
  const value = payload[key];
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) fail("VALIDATION_ERROR", `${key} \u683C\u5F0F\u4E0D\u6B63\u786E\u3002`);
  return value;
}
function enumField(payload, key, allowed, fallback) {
  const value = payload[key];
  if ((value === void 0 || value === null || value === "") && fallback) return fallback;
  if (typeof value !== "string" || !allowed.includes(value)) fail("VALIDATION_ERROR", `${key} \u53D6\u503C\u4E0D\u6B63\u786E\u3002`);
  return value;
}
function booleanField(payload, key, fallback = false) {
  const value = payload[key];
  if (value === void 0 || value === null) return fallback;
  if (typeof value !== "boolean") fail("VALIDATION_ERROR", `${key} \u683C\u5F0F\u4E0D\u6B63\u786E\u3002`);
  return value;
}
function dateField(payload, key, required = false) {
  const value = payload[key];
  if (value === void 0 || value === null || value === "") {
    if (required) fail("VALIDATION_ERROR", `${key} \u4E3A\u5FC5\u586B\u9879\u3002`);
    return null;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("VALIDATION_ERROR", `${key} \u5FC5\u987B\u662F YYYY-MM-DD\u3002`);
  const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail("VALIDATION_ERROR", `${key} \u4E0D\u662F\u6709\u6548\u65E5\u671F\u3002`);
  return value;
}
function expectedVersion(payload) {
  const value = payload.expected_version;
  if (!Number.isInteger(value) || Number(value) < 1) fail("VALIDATION_ERROR", "\u7F3A\u5C11\u6709\u6548\u7684 expected_version\u3002");
  return Number(value);
}
function assertVersion(record, version) {
  if (Number(record.version) !== version) fail("VERSION_CONFLICT", "\u5185\u5BB9\u5DF2\u88AB\u53E6\u4E00\u53F0\u8BBE\u5907\u66F4\u65B0\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
}
function clampPageSize(payload) {
  const value = payload.page_size;
  if (value === void 0) return 20;
  if (!Number.isInteger(value) || Number(value) < 1) fail("VALIDATION_ERROR", "page_size \u683C\u5F0F\u4E0D\u6B63\u786E\u3002");
  return Math.min(Number(value), 50);
}
function localDate(timestamp, timezone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
}
function calendarDayDiff(fromDate, toDate) {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / 864e5);
}
function togetherDays(startDate, today) {
  if (!startDate) return null;
  const diff = calendarDayDiff(startDate, today);
  return diff >= 0 ? diff + 1 : diff;
}
function nextAnniversary(originalDate, today) {
  const [month, day] = originalDate.slice(5).split("-").map(Number);
  let year = Number(today.slice(0, 4));
  const normalized = (targetYear) => {
    if (month === 2 && day === 29) {
      const leap = new Date(Date.UTC(targetYear, 1, 29)).getUTCDate() === 29;
      return `${targetYear}-${leap ? "02-29" : "02-28"}`;
    }
    return `${targetYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  let next = normalized(year);
  if (next < today) next = normalized(++year);
  return { next_date: next, days_until: calendarDayDiff(today, next) };
}

// server/api/src/domain.ts
var TASK_STATUSES = ["todo", "doing", "done", "cancelled"];
var WISH_STATUSES = ["pending", "planned", "completed", "archived"];
var WISH_CATEGORIES = ["eat", "go", "buy", "do"];
var AVATARS = ["sage", "peach", "sun", "moon"];
function publicUser(user) {
  return {
    user_id: user.user_id,
    nickname: user.nickname || "\u672A\u8BBE\u7F6E\u79F0\u547C",
    avatar_key: user.avatar_key || "sage",
    couple_id: user.couple_id || null,
    status: user.status || "active"
  };
}
async function members(store2, couple) {
  const users = await store2.find("users", {}, 100);
  return couple.member_ids.map((id) => users.find((item) => item.user_id === id)).filter(Boolean).map(publicUser);
}
async function requireCouple(context, allowArchived = false) {
  if (!context.user.couple_id) fail("NOT_FOUND", "\u5F53\u524D\u8FD8\u6CA1\u6709\u53CC\u4EBA\u7A7A\u95F4\u3002");
  const couple = await context.store.get("couples", context.user.couple_id);
  if (!couple) fail("NOT_FOUND", "\u7A7A\u95F4\u4E0D\u5B58\u5728\u6216\u5DF2\u4E0D\u53EF\u7528\u3002");
  const isMember = couple.member_ids?.includes(context.user.user_id) || couple.archived_member_ids?.includes(context.user.user_id);
  if (!isMember) fail("NOT_FOUND", "\u7A7A\u95F4\u4E0D\u5B58\u5728\u6216\u5DF2\u4E0D\u53EF\u7528\u3002");
  if (!allowArchived && couple.status === "archived") fail("INVALID_STATE", "\u7A7A\u95F4\u5DF2\u5F52\u6863\uFF0C\u53EA\u80FD\u5BFC\u51FA\u5386\u53F2\u8D44\u6599\u3002");
  return couple;
}
function coupleView(couple, memberList = []) {
  return {
    _id: couple._id,
    name: couple.name,
    member_ids: couple.member_ids,
    members: memberList.length ? memberList : couple.archived_members || [],
    created_by: couple.created_by,
    start_date: couple.start_date || null,
    timezone: couple.timezone || "Asia/Shanghai",
    status: couple.status,
    archived_at: couple.archived_at || null,
    purge_at: couple.purge_at || null,
    version: couple.version
  };
}
async function assertResource(context, collection, id, allowDeleted = false) {
  const couple = await requireCouple(context);
  const record = await context.store.get(collection, id);
  if (!record || record.couple_id !== couple._id || !allowDeleted && record.deleted_at) fail("NOT_FOUND", "\u5185\u5BB9\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE\u3002");
  return record;
}
async function notify(context, receiverId, type, resourceType, resourceId, preview, coupleIdOverride) {
  if (receiverId === context.user.user_id) return;
  const couple = coupleIdOverride ? await context.store.get("couples", coupleIdOverride) : await requireCouple(context);
  if (!couple) fail("NOT_FOUND", "\u7A7A\u95F4\u4E0D\u5B58\u5728\u6216\u5DF2\u4E0D\u53EF\u7528\u3002");
  const eventKey = `${type}:${resourceType}:${resourceId}:${receiverId}`;
  const existing = await context.store.find("notifications", { event_key: eventKey }, 1);
  if (existing.length) return;
  await context.store.add("notifications", {
    couple_id: couple._id,
    receiver_id: receiverId,
    event_key: eventKey,
    type,
    resource_type: resourceType,
    resource_id: resourceId,
    preview,
    read_at: null,
    created_at: context.now
  }, randomId("ntf"));
}
async function audit(context, action, resourceType, resourceId, changedFields) {
  await context.store.add("audit_logs", {
    couple_id: context.user.couple_id,
    actor_id: context.user.user_id,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    request_id: context.requestId,
    changed_fields: changedFields,
    created_at: context.now
  }, randomId("audit"));
}
function page(items, payload) {
  const size = clampPageSize(payload);
  const offset = typeof payload.cursor === "string" && /^\d+$/.test(payload.cursor) ? Number(payload.cursor) : 0;
  const result = items.slice(offset, offset + size);
  return { items: result, next_cursor: offset + size < items.length ? String(offset + size) : null };
}
function sortableTime(value, fallback) {
  return typeof value === "number" ? value : fallback;
}
async function findAll(store2, collection, where) {
  const records = [];
  let offset = 0;
  while (true) {
    const batch = await store2.find(collection, where, 100, offset);
    records.push(...batch);
    if (batch.length < 100) return records;
    offset += batch.length;
  }
}
async function authGet(context) {
  let couple = null;
  let memberList = [];
  if (context.user.couple_id) {
    couple = await context.store.get("couples", context.user.couple_id);
    if (couple) memberList = await members(context.store, couple);
  }
  return { user: { ...publicUser(context.user), archived_exports: (context.user.archived_couple_ids || []).filter((item) => item.export_until > context.now) }, couple: couple ? coupleView(couple, memberList) : null, is_new: !context.user.profile_completed };
}
async function updateProfile(context, payload) {
  const nickname = stringField(payload, "nickname", { required: true, min: 1, max: 24 });
  const avatarKey = enumField(payload, "avatar_key", AVATARS, "sage");
  const updated = await context.store.update("users", context.user._id, {
    nickname,
    avatar_key: avatarKey,
    profile_completed: true,
    updated_at: context.now
  });
  return publicUser(updated);
}
async function createCouple(context, payload) {
  if (context.user.couple_id) fail("ALREADY_BOUND", "\u5F53\u524D\u8D26\u53F7\u5DF2\u7ECF\u5C5E\u4E8E\u4E00\u4E2A\u7A7A\u95F4\u3002");
  const name = stringField(payload, "name", { required: true, min: 1, max: 30 });
  const startDate = dateField(payload, "start_date");
  const coupleId = randomId("cp");
  const couple = await context.store.add("couples", {
    name,
    member_ids: [context.user.user_id],
    created_by: context.user.user_id,
    start_date: startDate,
    timezone: "Asia/Shanghai",
    status: "waiting",
    archived_member_ids: [],
    archived_at: null,
    purge_at: null,
    version: 1,
    created_at: context.now,
    updated_at: context.now
  }, coupleId);
  await context.store.update("users", context.user._id, { couple_id: coupleId, updated_at: context.now });
  await audit({ ...context, user: { ...context.user, couple_id: coupleId } }, "couple.create", "couple", coupleId, ["name", "start_date"]);
  return coupleView(couple, [publicUser(context.user)]);
}
async function getCouple(context) {
  const couple = await requireCouple(context, true);
  const result = coupleView(couple, await members(context.store, couple));
  if (couple.status !== "archived" && couple.created_by === context.user.user_id) {
    const requests = await context.store.find("join_requests", { couple_id: couple._id, status: "pending" }, 20);
    const users = await context.store.find("users", {}, 100);
    result.pending_join_requests = requests.map((request) => ({
      ...request,
      applicant: publicUser(users.find((user) => user.user_id === request.applicant_id) || { _id: "missing", user_id: request.applicant_id })
    }));
  }
  return result;
}
async function updateCouple(context, payload) {
  const couple = await requireCouple(context);
  const version = expectedVersion(payload);
  assertVersion(couple, version);
  const patch = { updated_at: context.now, version: version + 1 };
  if (payload.name !== void 0) patch.name = stringField(payload, "name", { required: true, max: 30 });
  if (payload.start_date !== void 0) patch.start_date = dateField(payload, "start_date");
  if (payload.timezone !== void 0) {
    const timezone = stringField(payload, "timezone", { required: true, max: 64 });
    if (timezone !== "Asia/Shanghai") fail("VALIDATION_ERROR", "\u9996\u7248\u4EC5\u5F00\u653E Asia/Shanghai \u65F6\u533A\u3002");
    patch.timezone = timezone;
  }
  const updated = await context.store.update("couples", couple._id, patch);
  await audit(context, "couple.update", "couple", couple._id, Object.keys(patch).filter((key) => !["updated_at", "version"].includes(key)));
  return coupleView(updated, await members(context.store, updated));
}
async function createInvite(context) {
  const couple = await requireCouple(context);
  if (couple.member_ids.length >= 2) fail("COUPLE_FULL", "\u7A7A\u95F4\u5DF2\u7ECF\u6709\u4E24\u540D\u6210\u5458\u3002");
  const previous = await context.store.find("invitations", { couple_id: couple._id }, 100);
  for (const invitation2 of previous) {
    if (!invitation2.revoked_at && !invitation2.consumed_at) await context.store.update("invitations", invitation2._id, { revoked_at: context.now });
  }
  const code = randomInviteCode();
  const invitation = await context.store.add("invitations", {
    couple_id: couple._id,
    token_hash: sha256(code),
    created_by: context.user.user_id,
    expires_at: context.now + 24 * 60 * 60 * 1e3,
    revoked_at: null,
    consumed_at: null,
    created_at: context.now,
    updated_at: context.now
  }, randomId("inv"));
  return { invitation_id: invitation._id, code, expires_at: invitation.expires_at };
}
async function revokeInvite(context, payload) {
  const couple = await requireCouple(context);
  const invitationId = stringField(payload, "invitation_id", { required: true });
  const invitation = await context.store.get("invitations", invitationId);
  if (!invitation || invitation.couple_id !== couple._id || invitation.created_by !== context.user.user_id) fail("NOT_FOUND", "\u9080\u8BF7\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C\u3002");
  if (invitation.consumed_at) fail("INVALID_STATE", "\u9080\u8BF7\u5DF2\u7ECF\u5B8C\u6210\u4F7F\u7528\u3002");
  await context.store.update("invitations", invitation._id, { revoked_at: context.now, updated_at: context.now });
  return { revoked: true };
}
async function requestJoin(context, payload) {
  if (context.user.couple_id) fail("ALREADY_BOUND", "\u5F53\u524D\u8D26\u53F7\u5DF2\u7ECF\u5C5E\u4E8E\u4E00\u4E2A\u7A7A\u95F4\u3002");
  const code = stringField(payload, "code", { required: true, min: 10, max: 10 }).toUpperCase();
  const invitations = await context.store.find("invitations", { token_hash: sha256(code) }, 2);
  const invitation = invitations[0];
  if (!invitation || invitation.revoked_at || invitation.consumed_at || invitation.expires_at <= context.now) fail("INVITE_INVALID", "\u9080\u8BF7\u7801\u65E0\u6548\u3001\u5DF2\u8FC7\u671F\u6216\u5DF2\u64A4\u9500\u3002");
  const couple = await context.store.get("couples", invitation.couple_id);
  if (!couple || couple.status === "archived" || couple.member_ids.length >= 2) fail("INVITE_INVALID", "\u9080\u8BF7\u7801\u65E0\u6548\u3001\u5DF2\u8FC7\u671F\u6216\u5DF2\u64A4\u9500\u3002");
  const prior = await context.store.find("join_requests", { invitation_id: invitation._id, applicant_id: context.user.user_id }, 10);
  const existing = prior.find((item) => item.status === "pending");
  if (existing) return { join_request_id: existing._id, status: existing.status };
  const request = await context.store.add("join_requests", {
    couple_id: couple._id,
    invitation_id: invitation._id,
    applicant_id: context.user.user_id,
    status: "pending",
    expires_at: invitation.expires_at,
    decided_at: null,
    created_at: context.now,
    updated_at: context.now
  }, randomId("join"));
  await notify(context, invitation.created_by, "join_requested", "join_request", request._id, "\u6536\u5230\u4E00\u4EFD\u65B0\u7684\u52A0\u5165\u7533\u8BF7", couple._id);
  return { join_request_id: request._id, status: "pending" };
}
async function confirmJoin(context, payload) {
  const couple = await requireCouple(context);
  const requestId = stringField(payload, "join_request_id", { required: true });
  const request = await context.store.get("join_requests", requestId);
  if (!request || request.couple_id !== couple._id) fail("NOT_FOUND", "\u52A0\u5165\u7533\u8BF7\u4E0D\u5B58\u5728\u3002");
  const invitation = await context.store.get("invitations", request.invitation_id);
  if (!invitation || invitation.created_by !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u9080\u8BF7\u53D1\u8D77\u4EBA\u53EF\u4EE5\u786E\u8BA4\u52A0\u5165\u3002");
  if (request.status !== "pending" || request.expires_at <= context.now || invitation.revoked_at || invitation.consumed_at) fail("INVALID_STATE", "\u52A0\u5165\u7533\u8BF7\u5DF2\u5931\u6548\u3002");
  if (couple.member_ids.length >= 2) fail("COUPLE_FULL", "\u7A7A\u95F4\u5DF2\u7ECF\u6709\u4E24\u540D\u6210\u5458\u3002");
  const applicants = await context.store.find("users", { user_id: request.applicant_id }, 2);
  const applicant = applicants[0];
  if (!applicant || applicant.couple_id) fail("ALREADY_BOUND", "\u7533\u8BF7\u4EBA\u5DF2\u7ECF\u52A0\u5165\u5176\u4ED6\u7A7A\u95F4\u3002");
  const updatedCouple = await context.store.update("couples", couple._id, {
    member_ids: [...couple.member_ids, applicant.user_id],
    status: "active",
    version: couple.version + 1,
    updated_at: context.now
  });
  await context.store.update("users", applicant._id, { couple_id: couple._id, updated_at: context.now });
  await context.store.update("join_requests", request._id, { status: "approved", decided_at: context.now, updated_at: context.now });
  await context.store.update("invitations", invitation._id, { consumed_at: context.now, updated_at: context.now });
  await notify(context, applicant.user_id, "couple_joined", "couple", couple._id, "\u53CC\u4EBA\u7A7A\u95F4\u5DF2\u7ECF\u5EFA\u7ACB");
  return coupleView(updatedCouple, await members(context.store, updatedCouple));
}
async function rejectJoin(context, payload) {
  const couple = await requireCouple(context);
  const request = await context.store.get("join_requests", stringField(payload, "join_request_id", { required: true }));
  if (!request || request.couple_id !== couple._id) fail("NOT_FOUND", "\u52A0\u5165\u7533\u8BF7\u4E0D\u5B58\u5728\u3002");
  const invitation = await context.store.get("invitations", request.invitation_id);
  if (!invitation || invitation.created_by !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u9080\u8BF7\u53D1\u8D77\u4EBA\u53EF\u4EE5\u62D2\u7EDD\u52A0\u5165\u3002");
  if (request.status !== "pending") fail("INVALID_STATE", "\u7533\u8BF7\u5DF2\u7ECF\u5904\u7406\u3002");
  await context.store.update("join_requests", request._id, { status: "rejected", decided_at: context.now, updated_at: context.now });
  return { status: "rejected" };
}
async function taskList(context, payload) {
  const couple = await requireCouple(context);
  const scope = enumField(payload, "scope", ["mine", "all", "completed"], "mine");
  let tasks = (await context.store.find("tasks", { couple_id: couple._id }, 100)).filter((item) => !item.deleted_at);
  if (scope === "mine") tasks = tasks.filter((item) => item.status !== "done" && item.status !== "cancelled" && (!item.assignee_id || item.assignee_id === context.user.user_id));
  if (scope === "completed") tasks = tasks.filter((item) => item.status === "done");
  if (scope === "all") tasks = tasks.filter((item) => item.status !== "cancelled");
  tasks.sort((a, b) => {
    const aOpen = a.status === "done" ? 1 : 0;
    const bOpen = b.status === "done" ? 1 : 0;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return sortableTime(a.due_at, Number.MAX_SAFE_INTEGER) - sortableTime(b.due_at, Number.MAX_SAFE_INTEGER) || b.created_at - a.created_at;
  });
  return page(tasks, payload);
}
async function taskGet(context, payload) {
  return assertResource(context, "tasks", stringField(payload, "task_id", { required: true }));
}
async function taskCreate(context, payload) {
  const couple = await requireCouple(context);
  const sourceWishId = payload.source_wish_id ? stringField(payload, "source_wish_id", { required: true }) : null;
  if (sourceWishId) {
    await assertResource(context, "wishes", sourceWishId);
    const existing = (await context.store.find("tasks", { couple_id: couple._id, source_wish_id: sourceWishId }, 1))[0];
    if (existing && !existing.deleted_at) return existing;
  }
  const title = stringField(payload, "title", { required: true, max: 80 });
  const description = stringField(payload, "description", { max: 1e3 });
  const assigneeId = payload.assignee_id === null || payload.assignee_id === "" || payload.assignee_id === void 0 ? null : stringField(payload, "assignee_id", { required: true });
  if (assigneeId && !couple.member_ids.includes(assigneeId)) fail("VALIDATION_ERROR", "\u8D1F\u8D23\u4EBA\u5FC5\u987B\u662F\u5F53\u524D\u7A7A\u95F4\u6210\u5458\u3002");
  const record = await context.store.add("tasks", {
    couple_id: couple._id,
    title,
    description,
    creator_id: context.user.user_id,
    assignee_id: assigneeId,
    due_at: optionalNumber(payload, "due_at"),
    priority: enumField(payload, "priority", ["normal", "important"], "normal"),
    status: "todo",
    completed_by: null,
    completed_at: null,
    source_wish_id: sourceWishId,
    version: 1,
    deleted_at: null,
    created_at: context.now,
    updated_at: context.now
  }, randomId("task"));
  if (assigneeId) await notify(context, assigneeId, "task_assigned", "task", record._id, `\u65B0\u5F85\u529E\uFF1A${title}`);
  await audit(context, "task.create", "task", record._id, ["title", "description", "assignee_id", "due_at", "priority"]);
  return record;
}
async function taskUpdate(context, payload) {
  const task = await assertResource(context, "tasks", stringField(payload, "task_id", { required: true }));
  if (task.creator_id !== context.user.user_id && task.assignee_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u521B\u5EFA\u8005\u6216\u8D1F\u8D23\u4EBA\u53EF\u4EE5\u7F16\u8F91\u4EFB\u52A1\u3002");
  if (task.status === "cancelled") fail("INVALID_STATE", "\u5DF2\u53D6\u6D88\u4EFB\u52A1\u4E0D\u80FD\u7F16\u8F91\u3002");
  const version = expectedVersion(payload);
  assertVersion(task, version);
  const couple = await requireCouple(context);
  const patch = { version: version + 1, updated_at: context.now };
  if (payload.title !== void 0) patch.title = stringField(payload, "title", { required: true, max: 80 });
  if (payload.description !== void 0) patch.description = stringField(payload, "description", { max: 1e3 });
  if (payload.assignee_id !== void 0) {
    const assignee = payload.assignee_id === null || payload.assignee_id === "" ? null : stringField(payload, "assignee_id", { required: true });
    if (assignee && !couple.member_ids.includes(assignee)) fail("VALIDATION_ERROR", "\u8D1F\u8D23\u4EBA\u5FC5\u987B\u662F\u5F53\u524D\u7A7A\u95F4\u6210\u5458\u3002");
    patch.assignee_id = assignee;
  }
  if (payload.due_at !== void 0) patch.due_at = optionalNumber(payload, "due_at");
  if (payload.priority !== void 0) patch.priority = enumField(payload, "priority", ["normal", "important"]);
  const updated = await context.store.update("tasks", task._id, patch);
  await audit(context, "task.update", "task", task._id, Object.keys(patch).filter((key) => !["updated_at", "version"].includes(key)));
  return updated;
}
async function taskTransition(context, payload) {
  const task = await assertResource(context, "tasks", stringField(payload, "task_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(task, version);
  const target = enumField(payload, "target_status", TASK_STATUSES);
  const allowed = { todo: ["doing", "done", "cancelled"], doing: ["done", "cancelled"], done: ["todo"], cancelled: [] };
  if (!allowed[task.status]?.includes(target)) fail("INVALID_STATE", "\u5F53\u524D\u72B6\u6001\u4E0D\u5141\u8BB8\u6267\u884C\u8FD9\u4E2A\u64CD\u4F5C\u3002");
  if (target === "cancelled" && task.creator_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u521B\u5EFA\u8005\u53EF\u4EE5\u53D6\u6D88\u4EFB\u52A1\u3002");
  if (["doing", "done", "todo"].includes(target) && task.assignee_id && task.assignee_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u8D1F\u8D23\u4EBA\u53EF\u4EE5\u53D8\u66F4\u4EFB\u52A1\u8FDB\u5EA6\u3002");
  const patch = {
    status: target,
    completed_by: target === "done" ? context.user.user_id : null,
    completed_at: target === "done" ? context.now : null,
    version: version + 1,
    updated_at: context.now
  };
  const updated = await context.store.update("tasks", task._id, patch);
  if (target === "done") await notify(context, task.creator_id, "task_completed", "task", task._id, `\u5F85\u529E\u5DF2\u5B8C\u6210\uFF1A${task.title}`);
  await audit(context, "task.transition", "task", task._id, ["status", "completed_by", "completed_at"]);
  return updated;
}
async function taskDelete(context, payload) {
  const task = await assertResource(context, "tasks", stringField(payload, "task_id", { required: true }));
  if (task.creator_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u521B\u5EFA\u8005\u53EF\u4EE5\u5220\u9664\u4EFB\u52A1\u3002");
  const version = expectedVersion(payload);
  assertVersion(task, version);
  await context.store.update("tasks", task._id, { deleted_at: context.now, version: version + 1, updated_at: context.now });
  await audit(context, "task.delete", "task", task._id, ["deleted_at"]);
  return { deleted: true };
}
async function approvalList(context, payload) {
  const couple = await requireCouple(context);
  const scope = enumField(payload, "scope", ["pending", "sent", "all"], "pending");
  let records = await context.store.find("approvals", { couple_id: couple._id }, 100);
  records = records.map((item) => item.status === "pending" && item.reply_deadline && item.reply_deadline <= context.now ? { ...item, status: "expired" } : item);
  if (scope === "pending") records = records.filter((item) => item.approver_id === context.user.user_id && item.status === "pending");
  if (scope === "sent") records = records.filter((item) => item.applicant_id === context.user.user_id);
  records.sort((a, b) => b.created_at - a.created_at);
  return page(records, payload);
}
async function approvalGet(context, payload) {
  return assertResource(context, "approvals", stringField(payload, "approval_id", { required: true }));
}
async function approvalSubmit(context, payload) {
  const couple = await requireCouple(context);
  if (couple.member_ids.length !== 2) fail("INVALID_STATE", "\u7B49\u5F85\u53E6\u4E00\u540D\u6210\u5458\u52A0\u5165\u540E\u624D\u80FD\u63D0\u4EA4\u7533\u8BF7\u3002");
  const approverId = couple.member_ids.find((id) => id !== context.user.user_id);
  if (!approverId) fail("INVALID_STATE", "\u6CA1\u6709\u53EF\u7528\u7684\u5BA1\u6279\u4EBA\u3002");
  const startAt = optionalNumber(payload, "start_at");
  const endAt = optionalNumber(payload, "end_at");
  if (startAt && endAt && endAt < startAt) fail("VALIDATION_ERROR", "\u7ED3\u675F\u65F6\u95F4\u4E0D\u80FD\u65E9\u4E8E\u5F00\u59CB\u65F6\u95F4\u3002");
  const record = await context.store.add("approvals", {
    couple_id: couple._id,
    template_key: enumField(payload, "template_key", ["date", "outing", "entertainment", "purchase", "other"], "other"),
    title: stringField(payload, "title", { required: true, max: 80 }),
    content: stringField(payload, "content", { max: 1e3 }),
    applicant_id: context.user.user_id,
    approver_id: approverId,
    start_at: startAt,
    end_at: endAt,
    reply_deadline: optionalNumber(payload, "reply_deadline"),
    status: "pending",
    decision_comment: "",
    decided_at: null,
    version: 1,
    created_at: context.now,
    updated_at: context.now
  }, randomId("approval"));
  await notify(context, approverId, "approval_received", "approval", record._id, `\u6536\u5230\u7533\u8BF7\uFF1A${record.title}`);
  await audit(context, "approval.submit", "approval", record._id, ["title", "content", "start_at", "end_at", "reply_deadline"]);
  return record;
}
async function approvalDecide(context, payload) {
  const record = await assertResource(context, "approvals", stringField(payload, "approval_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(record, version);
  if (record.status !== "pending") fail("INVALID_STATE", "\u7533\u8BF7\u5DF2\u7ECF\u5904\u7406\u3002");
  if (record.reply_deadline && record.reply_deadline <= context.now) fail("INVALID_STATE", "\u7533\u8BF7\u5DF2\u8D85\u8FC7\u56DE\u590D\u671F\u9650\u3002");
  if (record.approver_id !== context.user.user_id || record.applicant_id === context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u6307\u5B9A\u5BA1\u6279\u4EBA\u53EF\u4EE5\u5904\u7406\u7533\u8BF7\u3002");
  const decision = enumField(payload, "decision", ["approved", "rejected"]);
  const updated = await context.store.update("approvals", record._id, {
    status: decision,
    decision_comment: stringField(payload, "decision_comment", { max: 500 }),
    decided_at: context.now,
    version: version + 1,
    updated_at: context.now
  });
  await notify(context, record.applicant_id, "approval_decided", "approval", record._id, decision === "approved" ? "\u7533\u8BF7\u5DF2\u540C\u610F" : "\u7533\u8BF7\u9700\u8981\u518D\u5546\u91CF");
  await audit(context, "approval.decide", "approval", record._id, ["status", "decision_comment", "decided_at"]);
  return updated;
}
async function approvalCancel(context, payload) {
  const record = await assertResource(context, "approvals", stringField(payload, "approval_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(record, version);
  if (record.status !== "pending") fail("INVALID_STATE", "\u7533\u8BF7\u5DF2\u7ECF\u5904\u7406\u3002");
  if (record.applicant_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u7533\u8BF7\u4EBA\u53EF\u4EE5\u64A4\u56DE\u3002");
  const updated = await context.store.update("approvals", record._id, { status: "cancelled", version: version + 1, updated_at: context.now });
  await audit(context, "approval.cancel", "approval", record._id, ["status"]);
  return updated;
}
function eventFields(payload) {
  const allDay = booleanField(payload, "all_day", false);
  const fields = {
    title: stringField(payload, "title", { required: true, max: 80 }),
    description: stringField(payload, "description", { max: 1e3 }),
    type: enumField(payload, "type", ["date", "life", "anniversary", "other"], "other"),
    all_day: allDay
  };
  if (allDay) {
    fields.date_start = dateField(payload, "date_start", true);
    fields.date_end = dateField(payload, "date_end") || fields.date_start;
    if (String(fields.date_end) < String(fields.date_start)) fail("VALIDATION_ERROR", "\u7ED3\u675F\u65E5\u671F\u4E0D\u80FD\u65E9\u4E8E\u5F00\u59CB\u65E5\u671F\u3002");
    fields.start_at = null;
    fields.end_at = null;
  } else {
    fields.start_at = optionalNumber(payload, "start_at");
    fields.end_at = optionalNumber(payload, "end_at");
    if (!fields.start_at) fail("VALIDATION_ERROR", "\u5B9A\u65F6\u65E5\u7A0B\u5FC5\u987B\u586B\u5199\u5F00\u59CB\u65F6\u95F4\u3002");
    if (fields.end_at && Number(fields.end_at) < Number(fields.start_at)) fail("VALIDATION_ERROR", "\u7ED3\u675F\u65F6\u95F4\u4E0D\u80FD\u65E9\u4E8E\u5F00\u59CB\u65F6\u95F4\u3002");
    fields.date_start = null;
    fields.date_end = null;
  }
  return fields;
}
async function eventList(context, payload) {
  const couple = await requireCouple(context);
  const from = dateField(payload, "from_date") || "0000-01-01";
  const to = dateField(payload, "to_date") || "9999-12-31";
  const timezone = couple.timezone || "Asia/Shanghai";
  const events = (await context.store.find("events", { couple_id: couple._id }, 100)).filter((item) => {
    if (item.deleted_at) return false;
    const start = item.all_day ? item.date_start : localDate(item.start_at, timezone);
    const end = item.all_day ? item.date_end : localDate(item.end_at || item.start_at, timezone);
    return start <= to && end >= from;
  }).sort((a, b) => String(a.date_start || a.start_at).localeCompare(String(b.date_start || b.start_at)));
  return page(events, payload);
}
async function eventGet(context, payload) {
  return assertResource(context, "events", stringField(payload, "event_id", { required: true }));
}
async function eventCreate(context, payload) {
  const couple = await requireCouple(context);
  const sourceApprovalId = payload.source_approval_id ? stringField(payload, "source_approval_id") : null;
  const sourceWishId = payload.source_wish_id ? stringField(payload, "source_wish_id") : null;
  if (sourceApprovalId) {
    const source = await assertResource(context, "approvals", sourceApprovalId);
    if (source.status !== "approved") fail("INVALID_STATE", "\u53EA\u6709\u5DF2\u540C\u610F\u7684\u7533\u8BF7\u53EF\u4EE5\u8F6C\u4E3A\u65E5\u7A0B\u3002");
    const existing = (await context.store.find("events", { couple_id: couple._id, source_approval_id: sourceApprovalId }, 1))[0];
    if (existing && !existing.deleted_at) return existing;
  }
  if (sourceWishId) {
    await assertResource(context, "wishes", sourceWishId);
    const existing = (await context.store.find("events", { couple_id: couple._id, source_wish_id: sourceWishId }, 1))[0];
    if (existing && !existing.deleted_at) return existing;
  }
  const record = await context.store.add("events", {
    couple_id: couple._id,
    ...eventFields(payload),
    creator_id: context.user.user_id,
    source_approval_id: sourceApprovalId,
    source_wish_id: sourceWishId,
    version: 1,
    deleted_at: null,
    created_at: context.now,
    updated_at: context.now
  }, randomId("event"));
  for (const memberId of couple.member_ids) await notify(context, memberId, "event_created", "event", record._id, `\u65B0\u589E\u65E5\u7A0B\uFF1A${record.title}`);
  await audit(context, "event.create", "event", record._id, ["title", "all_day", "start_at", "date_start"]);
  return record;
}
async function eventUpdate(context, payload) {
  const event = await assertResource(context, "events", stringField(payload, "event_id", { required: true }));
  if (event.creator_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u521B\u5EFA\u8005\u53EF\u4EE5\u7F16\u8F91\u65E5\u7A0B\u3002");
  const version = expectedVersion(payload);
  assertVersion(event, version);
  const updated = await context.store.update("events", event._id, { ...eventFields(payload), version: version + 1, updated_at: context.now });
  await audit(context, "event.update", "event", event._id, ["title", "description", "all_day", "start_at", "date_start"]);
  return updated;
}
async function eventDelete(context, payload) {
  const event = await assertResource(context, "events", stringField(payload, "event_id", { required: true }));
  if (event.creator_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u521B\u5EFA\u8005\u53EF\u4EE5\u5220\u9664\u65E5\u7A0B\u3002");
  const version = expectedVersion(payload);
  assertVersion(event, version);
  await context.store.update("events", event._id, { deleted_at: context.now, version: version + 1, updated_at: context.now });
  return { deleted: true };
}
async function anniversaryList(context) {
  const couple = await requireCouple(context);
  const today = localDate(context.now, couple.timezone);
  return (await context.store.find("anniversaries", { couple_id: couple._id }, 100)).filter((item) => !item.deleted_at).map((item) => ({ ...item, ...nextAnniversary(item.original_date, today) })).sort((a, b) => a.days_until - b.days_until);
}
async function anniversaryCreate(context, payload) {
  const couple = await requireCouple(context);
  return context.store.add("anniversaries", {
    couple_id: couple._id,
    title: stringField(payload, "title", { required: true, max: 80 }),
    original_date: dateField(payload, "original_date", true),
    recurrence: "yearly",
    leap_day_policy: "february_28",
    creator_id: context.user.user_id,
    version: 1,
    deleted_at: null,
    created_at: context.now,
    updated_at: context.now
  }, randomId("ann"));
}
async function anniversaryUpdate(context, payload) {
  const record = await assertResource(context, "anniversaries", stringField(payload, "anniversary_id", { required: true }));
  if (record.creator_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u521B\u5EFA\u8005\u53EF\u4EE5\u7F16\u8F91\u7EAA\u5FF5\u65E5\u3002");
  const version = expectedVersion(payload);
  assertVersion(record, version);
  return context.store.update("anniversaries", record._id, {
    title: stringField(payload, "title", { required: true, max: 80 }),
    original_date: dateField(payload, "original_date", true),
    version: version + 1,
    updated_at: context.now
  });
}
async function anniversaryDelete(context, payload) {
  const record = await assertResource(context, "anniversaries", stringField(payload, "anniversary_id", { required: true }));
  if (record.creator_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u521B\u5EFA\u8005\u53EF\u4EE5\u5220\u9664\u7EAA\u5FF5\u65E5\u3002");
  const version = expectedVersion(payload);
  assertVersion(record, version);
  await context.store.update("anniversaries", record._id, { deleted_at: context.now, version: version + 1, updated_at: context.now });
  return { deleted: true };
}
async function wishList(context, payload) {
  const couple = await requireCouple(context);
  const status = payload.status ? enumField(payload, "status", WISH_STATUSES) : null;
  let records = (await context.store.find("wishes", { couple_id: couple._id }, 100)).filter((item) => !item.deleted_at);
  if (status) records = records.filter((item) => item.status === status);
  records.sort((a, b) => b.created_at - a.created_at);
  return page(records, payload);
}
async function wishGet(context, payload) {
  return assertResource(context, "wishes", stringField(payload, "wish_id", { required: true }));
}
async function wishCreate(context, payload) {
  const couple = await requireCouple(context);
  return context.store.add("wishes", {
    couple_id: couple._id,
    title: stringField(payload, "title", { required: true, max: 80 }),
    description: stringField(payload, "description", { max: 1e3 }),
    category: enumField(payload, "category", WISH_CATEGORIES, "do"),
    status: "pending",
    target_date: dateField(payload, "target_date"),
    creator_id: context.user.user_id,
    completed_by: null,
    completed_at: null,
    completion_note: "",
    version: 1,
    deleted_at: null,
    created_at: context.now,
    updated_at: context.now
  }, randomId("wish"));
}
async function wishUpdate(context, payload) {
  const record = await assertResource(context, "wishes", stringField(payload, "wish_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(record, version);
  if (record.status === "archived") fail("INVALID_STATE", "\u5DF2\u5F52\u6863\u7684\u613F\u671B\u4E0D\u80FD\u7F16\u8F91\u3002");
  const nextStatus = enumField(payload, "status", ["pending", "planned", "archived"], record.status);
  if (record.status === "completed" && nextStatus !== "archived") fail("INVALID_STATE", "\u5DF2\u5B8C\u6210\u7684\u613F\u671B\u53EA\u80FD\u5F52\u6863\u3002");
  return context.store.update("wishes", record._id, {
    title: stringField(payload, "title", { required: true, max: 80 }),
    description: stringField(payload, "description", { max: 1e3 }),
    category: enumField(payload, "category", WISH_CATEGORIES, record.category),
    target_date: dateField(payload, "target_date"),
    status: nextStatus,
    version: version + 1,
    updated_at: context.now
  });
}
async function wishComplete(context, payload) {
  const record = await assertResource(context, "wishes", stringField(payload, "wish_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(record, version);
  if (!["pending", "planned"].includes(record.status)) fail("INVALID_STATE", "\u5F53\u524D\u613F\u671B\u4E0D\u80FD\u6807\u8BB0\u5B8C\u6210\u3002");
  return context.store.update("wishes", record._id, {
    status: "completed",
    completed_by: context.user.user_id,
    completed_at: context.now,
    completion_note: stringField(payload, "completion_note", { max: 300 }),
    version: version + 1,
    updated_at: context.now
  });
}
async function wishDelete(context, payload) {
  const record = await assertResource(context, "wishes", stringField(payload, "wish_id", { required: true }));
  if (record.creator_id !== context.user.user_id) fail("FORBIDDEN", "\u53EA\u6709\u521B\u5EFA\u8005\u53EF\u4EE5\u5220\u9664\u613F\u671B\u3002");
  const version = expectedVersion(payload);
  assertVersion(record, version);
  await context.store.update("wishes", record._id, { deleted_at: context.now, version: version + 1, updated_at: context.now });
  return { deleted: true };
}
async function notificationList(context, payload) {
  await requireCouple(context, true);
  const records = (await context.store.find("notifications", { receiver_id: context.user.user_id }, 100)).sort((a, b) => b.created_at - a.created_at);
  return page(records, payload);
}
async function notificationMarkRead(context, payload) {
  const id = stringField(payload, "notification_id", { required: true });
  const record = await context.store.get("notifications", id);
  if (!record || record.receiver_id !== context.user.user_id) fail("NOT_FOUND", "\u6D88\u606F\u4E0D\u5B58\u5728\u3002");
  await context.store.update("notifications", id, { read_at: context.now });
  return { read: true };
}
async function dashboardGet(context) {
  const couple = await requireCouple(context);
  const today = localDate(context.now, couple.timezone);
  const tomorrow = (/* @__PURE__ */ new Date(`${today}T00:00:00Z`)).getTime() + 864e5;
  const endOfToday = tomorrow - 1;
  const tasks = (await context.store.find("tasks", { couple_id: couple._id }, 100)).filter((item) => !item.deleted_at && !["done", "cancelled"].includes(item.status));
  const approvals = (await context.store.find("approvals", { couple_id: couple._id }, 100)).filter((item) => item.approver_id === context.user.user_id && item.status === "pending" && (!item.reply_deadline || item.reply_deadline > context.now));
  const events = (await context.store.find("events", { couple_id: couple._id }, 100)).filter((item) => !item.deleted_at && (item.all_day ? item.date_end >= today : (item.end_at || item.start_at) >= context.now)).sort((a, b) => String(a.date_start || a.start_at).localeCompare(String(b.date_start || b.start_at))).slice(0, 3);
  const anniversaries = await anniversaryList(context);
  const notifications = await context.store.find("notifications", { receiver_id: context.user.user_id, read_at: null }, 100);
  return {
    couple: coupleView(couple, await members(context.store, couple)),
    today_tasks: tasks.filter((item) => item.due_at ? item.due_at <= endOfToday : true).slice(0, 5),
    pending_approvals: approvals.slice(0, 5),
    upcoming_events: events,
    next_anniversary: anniversaries[0] || null,
    unread_count: notifications.length,
    together_days: togetherDays(couple.start_date || null, today)
  };
}
var EXPORT_COLLECTIONS = ["tasks", "approvals", "events", "anniversaries", "wishes", "notifications"];
async function dataExport(context, payload) {
  let couple = null;
  const requestedId = payload.couple_id ? stringField(payload, "couple_id", { required: true }) : null;
  if (context.user.couple_id && (!requestedId || requestedId === context.user.couple_id)) couple = await requireCouple(context, true);
  else {
    const references = (context.user.archived_couple_ids || []).filter((item) => item.export_until > context.now);
    const reference = requestedId ? references.find((item) => item.couple_id === requestedId) : references.sort((a, b) => b.export_until - a.export_until)[0];
    if (!reference) fail("NOT_FOUND", "\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u5386\u53F2\u7A7A\u95F4\uFF0C\u621630\u5929\u53EA\u8BFB\u671F\u5DF2\u7ED3\u675F\u3002");
    couple = await context.store.get("couples", reference.couple_id);
    if (!couple || couple.status !== "archived" || !couple.archived_member_ids?.includes(context.user.user_id)) fail("NOT_FOUND", "\u5386\u53F2\u7A7A\u95F4\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u5BFC\u51FA\u3002");
  }
  if (payload.collection) {
    const collection = enumField(payload, "collection", EXPORT_COLLECTIONS);
    const size = clampPageSize(payload);
    const offset = typeof payload.cursor === "string" && /^\d+$/.test(payload.cursor) ? Number(payload.cursor) : 0;
    const where = collection === "notifications" ? { receiver_id: context.user.user_id } : { couple_id: couple._id };
    const records = await context.store.find(collection, where, size + 1, offset);
    const items = records.slice(0, size).map(({ _openid, token_hash, openid, ...safe }) => safe);
    return {
      schema_version: 1,
      exported_at: new Date(context.now).toISOString(),
      timezone: couple.timezone,
      couple: coupleView(couple, await members(context.store, couple)),
      collection,
      items,
      next_cursor: records.length > size ? String(offset + size) : null
    };
  }
  const data = {};
  for (const collection of EXPORT_COLLECTIONS) {
    const records = await context.store.find(collection, collection === "notifications" ? { receiver_id: context.user.user_id } : { couple_id: couple._id }, 100);
    data[collection] = records.map(({ _openid, token_hash, openid, ...safe }) => safe);
  }
  return {
    schema_version: 1,
    exported_at: new Date(context.now).toISOString(),
    timezone: couple.timezone,
    couple: coupleView(couple, await members(context.store, couple)),
    data
  };
}
async function archiveCouple(context) {
  const couple = await requireCouple(context);
  const archivedMemberIds = [...couple.member_ids];
  const users = await context.store.find("users", {}, 100);
  const exportUntil = context.now + 30 * 864e5;
  const archivedMembers = archivedMemberIds.map((memberId) => {
    const member = users.find((item) => item.user_id === memberId);
    return member ? publicUser(member) : { user_id: memberId, nickname: "\u5DF2\u5220\u9664\u7528\u6237", avatar_key: "sage" };
  });
  for (const memberId of archivedMemberIds) {
    const user = users.find((item) => item.user_id === memberId);
    if (user) {
      const previous = (user.archived_couple_ids || []).filter((item) => item.couple_id !== couple._id && item.export_until > context.now);
      await context.store.update("users", user._id, { couple_id: null, archived_couple_ids: [...previous, { couple_id: couple._id, export_until: exportUntil }], updated_at: context.now });
    }
    await notify(context, memberId, "couple_archived", "couple", couple._id, "\u53CC\u4EBA\u7A7A\u95F4\u5DF2\u5F52\u6863");
  }
  const invitations = await findAll(context.store, "invitations", { couple_id: couple._id });
  for (const invitation of invitations) if (!invitation.consumed_at) await context.store.update("invitations", invitation._id, { revoked_at: context.now, updated_at: context.now });
  await context.store.update("couples", couple._id, {
    member_ids: [],
    archived_member_ids: archivedMemberIds,
    archived_members: archivedMembers,
    status: "archived",
    archived_at: context.now,
    purge_at: exportUntil,
    version: couple.version + 1,
    updated_at: context.now
  });
  return { archived: true, couple_id: couple._id, export_until: exportUntil };
}
async function accountDelete(context) {
  const affectedCoupleIds = new Set((context.user.archived_couple_ids || []).map((item) => item.couple_id));
  if (context.user.couple_id) {
    affectedCoupleIds.add(context.user.couple_id);
    await archiveCouple(context);
  }
  const anonymousId = `deleted_${sha256(context.user.user_id).slice(0, 12)}`;
  const identityFields = ["creator_id", "assignee_id", "applicant_id", "approver_id", "completed_by", "actor_id"];
  for (const coupleId of affectedCoupleIds) {
    for (const collection of ["tasks", "approvals", "events", "anniversaries", "wishes", "audit_logs"]) {
      const records = await findAll(context.store, collection, { couple_id: coupleId });
      for (const record of records) {
        const patch = {};
        for (const field of identityFields) if (record[field] === context.user.user_id) patch[field] = anonymousId;
        if (Object.keys(patch).length) await context.store.update(collection, record._id, patch);
      }
    }
    const couple = await context.store.get("couples", coupleId);
    if (couple?.archived_members) {
      const archivedMembers = couple.archived_members.map((member) => member.user_id === context.user.user_id ? { user_id: anonymousId, nickname: "\u5DF2\u5220\u9664\u7528\u6237", avatar_key: "sage", status: "deleted" } : member);
      await context.store.update("couples", coupleId, { archived_members: archivedMembers, archived_member_ids: (couple.archived_member_ids || []).map((id) => id === context.user.user_id ? anonymousId : id), updated_at: context.now });
    }
  }
  const ownNotifications = await findAll(context.store, "notifications", { receiver_id: context.user.user_id });
  for (const notification of ownNotifications) await context.store.delete("notifications", notification._id);
  const dedupRecords = await findAll(context.store, "request_dedup", { actor_id: context.user.user_id });
  for (const record of dedupRecords) await context.store.delete("request_dedup", record._id);
  if (context.user.identity_id) await context.store.delete("identities", context.user.identity_id);
  await context.store.delete("users", context.user._id);
  return { deleted: true };
}
var actions = {
  "auth.get": { write: false, handler: authGet },
  "user.updateProfile": { write: true, handler: updateProfile },
  "couple.create": { write: true, handler: createCouple },
  "couple.get": { write: false, handler: getCouple },
  "couple.update": { write: true, handler: updateCouple },
  "couple.archive": { write: true, handler: archiveCouple },
  "invite.create": { write: true, handler: createInvite },
  "invite.revoke": { write: true, handler: revokeInvite },
  "join.request": { write: true, handler: requestJoin },
  "join.confirm": { write: true, handler: confirmJoin },
  "join.reject": { write: true, handler: rejectJoin },
  "dashboard.get": { write: false, handler: dashboardGet },
  "task.list": { write: false, handler: taskList },
  "task.get": { write: false, handler: taskGet },
  "task.create": { write: true, handler: taskCreate },
  "task.update": { write: true, handler: taskUpdate },
  "task.transition": { write: true, handler: taskTransition },
  "task.delete": { write: true, handler: taskDelete },
  "approval.list": { write: false, handler: approvalList },
  "approval.get": { write: false, handler: approvalGet },
  "approval.submit": { write: true, handler: approvalSubmit },
  "approval.decide": { write: true, handler: approvalDecide },
  "approval.cancel": { write: true, handler: approvalCancel },
  "event.list": { write: false, handler: eventList },
  "event.get": { write: false, handler: eventGet },
  "event.create": { write: true, handler: eventCreate },
  "event.update": { write: true, handler: eventUpdate },
  "event.delete": { write: true, handler: eventDelete },
  "anniversary.list": { write: false, handler: anniversaryList },
  "anniversary.create": { write: true, handler: anniversaryCreate },
  "anniversary.update": { write: true, handler: anniversaryUpdate },
  "anniversary.delete": { write: true, handler: anniversaryDelete },
  "wish.list": { write: false, handler: wishList },
  "wish.get": { write: false, handler: wishGet },
  "wish.create": { write: true, handler: wishCreate },
  "wish.update": { write: true, handler: wishUpdate },
  "wish.complete": { write: true, handler: wishComplete },
  "wish.delete": { write: true, handler: wishDelete },
  "notification.list": { write: false, handler: notificationList },
  "notification.markRead": { write: true, handler: notificationMarkRead },
  "data.export": { write: false, handler: dataExport },
  "account.delete": { write: true, handler: accountDelete }
};
var DomainService = class {
  constructor(store2, now = () => Date.now()) {
    this.store = store2;
    this.now = now;
  }
  async execute(action, payload, user, requestId) {
    const definition = actions[action];
    if (!definition) fail("ACTION_NOT_FOUND", "\u8BF7\u6C42\u7684\u529F\u80FD\u5C1A\u672A\u5F00\u653E\u3002");
    if (user.status !== "active") fail("UNAUTHENTICATED", "\u8D26\u53F7\u5DF2\u6CE8\u9500\u6216\u4E0D\u53EF\u7528\u3002");
    const timestamp = this.now();
    if (!definition.write) return definition.handler({ store: this.store, user, requestId, now: timestamp }, payload);
    if (!requestId || requestId.length < 8 || requestId.length > 100) fail("VALIDATION_ERROR", "\u5199\u64CD\u4F5C\u5FC5\u987B\u63D0\u4F9B\u6709\u6548 request_id\u3002");
    if (action === "join.request") await this.assertJoinRateLimit(user, timestamp);
    const dedupId = sha256(`${user.user_id}:${action}:${requestId}`);
    const payloadHash = sha256(stableStringify(payload));
    try {
      return await this.store.runTransaction(async (transaction) => {
        const existing = await transaction.get("request_dedup", dedupId);
        if (existing) {
          if (existing.payload_hash !== payloadHash) fail("VERSION_CONFLICT", "\u540C\u4E00\u4E2A request_id \u4E0D\u80FD\u7528\u4E8E\u4E0D\u540C\u5185\u5BB9\u3002");
          return existing.result;
        }
        const txUser = await transaction.get("users", user._id) || user;
        const result = await definition.handler({ store: transaction, user: txUser, requestId, now: timestamp }, payload);
        await transaction.put("request_dedup", dedupId, {
          actor_id: user.user_id,
          action,
          request_id: requestId,
          payload_hash: payloadHash,
          result,
          created_at: timestamp,
          expires_at: timestamp + 7 * 864e5
        });
        return result;
      });
    } catch (error) {
      if (action === "join.request" && error instanceof DomainError && error.code === "INVITE_INVALID") await this.recordJoinFailure(user, timestamp);
      throw error;
    }
  }
  async assertJoinRateLimit(user, now) {
    const record = await this.store.get("invite_rate_limits", user.user_id);
    if (!record) return;
    const recent = (record.attempts || []).filter((timestamp) => timestamp > now - 15 * 60 * 1e3);
    if (recent.length >= 5) fail("RATE_LIMITED", "\u9080\u8BF7\u7801\u5C1D\u8BD5\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF715\u5206\u949F\u540E\u518D\u8BD5\u3002");
  }
  async recordJoinFailure(user, now) {
    const record = await this.store.get("invite_rate_limits", user.user_id);
    const attempts = (record?.attempts || []).filter((timestamp) => timestamp > now - 15 * 60 * 1e3);
    attempts.push(now);
    await this.store.put("invite_rate_limits", user.user_id, { attempts, updated_at: now });
  }
};
var compatibilityActions = {
  "identity.get": "auth.get",
  "identity.bootstrap": "auth.bootstrap"
};

// server/api/src/store.ts
var CloudStore = class _CloudStore {
  constructor(database, transaction = null) {
    this.database = database;
    this.transaction = transaction;
  }
  collection(name) {
    return (this.transaction || this.database).collection(name);
  }
  async get(collection, id) {
    try {
      const result = await this.collection(collection).doc(id).get();
      return result.data || null;
    } catch (error) {
      if (String(error?.errCode || error?.message || "").includes("DOCUMENT_NOT_FOUND")) return null;
      if (error?.errCode === -1) return null;
      throw error;
    }
  }
  async find(collection, where = {}, limit = 100, offset = 0) {
    let query = this.collection(collection);
    if (Object.keys(where).length) query = query.where(where);
    const result = await query.skip(offset).limit(Math.min(limit, 100)).get();
    return result.data || [];
  }
  async put(collection, id, data) {
    const { _id: _ignored, ...clean } = data;
    await this.collection(collection).doc(id).set({ data: clean });
    return { ...data, _id: id };
  }
  async add(collection, data, id = randomId("doc")) {
    return this.put(collection, id, data);
  }
  async update(collection, id, patch) {
    await this.collection(collection).doc(id).update({ data: patch });
    const updated = await this.get(collection, id);
    if (!updated) throw new Error(`Missing document after update ${collection}/${id}`);
    return updated;
  }
  async delete(collection, id) {
    await this.collection(collection).doc(id).remove();
  }
  async runTransaction(callback) {
    if (this.transaction) return callback(this);
    return this.database.runTransaction(async (transaction) => callback(new _CloudStore(this.database, transaction)));
  }
};

// server/api/src/index.ts
var cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var store = new CloudStore(cloud.database());
function parseAllowlist(raw) {
  return new Set(String(raw || "").split(",").map((value) => value.trim()).filter(Boolean));
}
function secureEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && import_node_crypto2.default.timingSafeEqual(a, b);
}
async function ensureIdentity(database, appid, openid, now) {
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
        return migratedUser;
      }
    }
    const hashedLegacy = await transaction.get("users", legacyIdentityId);
    const rawLegacy = await transaction.get("users", openid);
    const legacy = hashedLegacy || rawLegacy;
    const businessUserId = legacy?.user_id || randomId("usr");
    const user = {
      _id: businessUserId,
      identity_id: identityId,
      user_id: businessUserId,
      nickname: legacy?.nickname || "",
      avatar_key: legacy?.avatar_key || "sage",
      profile_completed: Boolean(legacy?.nickname),
      couple_id: null,
      status: "active",
      created_at: legacy?.created_at || legacy?.createdAt || now,
      updated_at: now
    };
    await transaction.put("users", businessUserId, user);
    await transaction.put("identities", identityId, { appid, openid, user_id: businessUserId, created_at: mapping?.created_at || now, updated_at: now });
    if (legacyMapping) await transaction.delete("identities", legacyIdentityId);
    if (hashedLegacy) await transaction.delete("users", legacyIdentityId);
    if (rawLegacy) await transaction.delete("users", openid);
    return user;
  });
}
function success(data, requestId, serverTime) {
  return { ok: true, data, request_id: requestId, server_time: serverTime };
}
function failure(error, requestId, serverTime) {
  if (error instanceof DomainError) {
    return {
      ok: false,
      error: { code: error.code, message: error.message, retryable: error.retryable },
      request_id: requestId,
      server_time: serverTime
    };
  }
  console.error("[couple-oa-api]", { request_id: requestId, error_name: error?.name || "UnknownError" });
  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "\u670D\u52A1\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", retryable: true },
    request_id: requestId,
    server_time: serverTime
  };
}
async function main(event = {}) {
  const serverTime = Date.now();
  const suppliedRequestId = typeof event.request_id === "string" ? event.request_id : typeof event.requestId === "string" ? event.requestId : "";
  const responseRequestId = suppliedRequestId || randomId("req");
  try {
    const context = cloud.getWXContext();
    if (!context.OPENID || !context.APPID) throw new DomainError("UNAUTHENTICATED", "\u65E0\u6CD5\u9A8C\u8BC1\u5FAE\u4FE1\u8EAB\u4EFD\uFF0C\u8BF7\u786E\u8BA4\u5C0F\u7A0B\u5E8F\u4E0E\u4E91\u73AF\u5883\u5DF2\u5173\u8054\u3002");
    const requestedAction = typeof event.action === "string" ? event.action : "";
    const normalized = compatibilityActions[requestedAction] || requestedAction;
    const isBootstrap = normalized === "auth.bootstrap";
    if (isBootstrap) {
      const configured = process.env.COUPLE_OA_BOOTSTRAP_TOKEN;
      const submitted = event.payload?.bootstrap_token ?? event.payload?.bootstrapToken;
      if (!configured) throw new DomainError("BOOTSTRAP_DISABLED", "\u5F00\u53D1\u521D\u59CB\u5316\u5165\u53E3\u672A\u5F00\u542F\u3002");
      if (!secureEqual(configured, submitted) || String(submitted).length < 24) throw new DomainError("BOOTSTRAP_TOKEN_INVALID", "\u5F00\u53D1\u521D\u59CB\u5316\u4EE4\u724C\u65E0\u6548\u3002");
    } else {
      const allowlist = parseAllowlist(process.env.COUPLE_OA_ALLOWED_OPENIDS);
      if (!allowlist.size) throw new DomainError("IDENTITY_ALLOWLIST_UNCONFIGURED", "\u5F00\u53D1\u73AF\u5883\u5C1A\u672A\u914D\u7F6E\u8EAB\u4EFD\u767D\u540D\u5355\u3002");
      if (!allowlist.has(context.OPENID)) throw new DomainError("IDENTITY_NOT_ALLOWED", "\u5F53\u524D\u5FAE\u4FE1\u8EAB\u4EFD\u672A\u83B7\u6388\u6743\uFF0C\u53EF\u8FDB\u5165\u53EA\u8BFB\u6F14\u793A\u6A21\u5F0F\u3002");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ensureIdentity,
  main,
  parseAllowlist
});
