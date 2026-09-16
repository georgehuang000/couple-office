import {
  JsonObject,
  DomainError,
  assertVersion,
  booleanField,
  clampPageSize,
  dateField,
  enumField,
  expectedVersion,
  fail,
  localDate,
  nextAnniversary,
  optionalNumber,
  randomId,
  randomInviteCode,
  sha256,
  stableStringify,
  stringField,
  togetherDays,
} from "./core";
import { Document, Store } from "./store";

export type Actor = Document & {
  user_id: string;
  nickname: string;
  avatar_key: string;
  couple_id: string | null;
  status: "active" | "deleted";
};

export type DomainContext = {
  store: Store;
  user: Actor;
  requestId: string;
  now: number;
};

type Handler = (context: DomainContext, payload: JsonObject) => Promise<unknown>;
type ActionDefinition = { write: boolean; handler: Handler };

const TASK_STATUSES = ["todo", "doing", "done", "cancelled"] as const;
const WISH_STATUSES = ["pending", "planned", "completed", "archived"] as const;
const WISH_CATEGORIES = ["eat", "go", "buy", "do"] as const;
const AVATARS = ["sage", "peach", "sun", "moon"] as const;

function publicUser(user: Document): JsonObject {
  return {
    user_id: user.user_id,
    nickname: user.nickname || "未设置称呼",
    avatar_key: user.avatar_key || "sage",
    couple_id: user.couple_id || null,
    status: user.status || "active",
  };
}

async function members(store: Store, couple: Document): Promise<JsonObject[]> {
  const users = await store.find("users", {}, 100);
  return couple.member_ids.map((id: string) => users.find((item) => item.user_id === id)).filter(Boolean).map(publicUser);
}

async function requireCouple(context: DomainContext, allowArchived = false): Promise<Document> {
  if (!context.user.couple_id) fail("NOT_FOUND", "当前还没有双人空间。");
  const couple = await context.store.get("couples", context.user.couple_id);
  if (!couple) fail("NOT_FOUND", "空间不存在或已不可用。");
  const isMember = couple.member_ids?.includes(context.user.user_id) || couple.archived_member_ids?.includes(context.user.user_id);
  if (!isMember) fail("NOT_FOUND", "空间不存在或已不可用。");
  if (!allowArchived && couple.status === "archived") fail("INVALID_STATE", "空间已归档，只能导出历史资料。");
  return couple;
}

function coupleView(couple: Document, memberList: JsonObject[] = []): JsonObject {
  return {
    _id: couple._id,
    name: couple.name,
    member_ids: couple.member_ids,
    members: memberList.length ? memberList : (couple.archived_members || []),
    created_by: couple.created_by,
    start_date: couple.start_date || null,
    timezone: couple.timezone || "Asia/Shanghai",
    status: couple.status,
    archived_at: couple.archived_at || null,
    purge_at: couple.purge_at || null,
    version: couple.version,
  };
}

async function assertResource(context: DomainContext, collection: string, id: string, allowDeleted = false): Promise<Document> {
  const couple = await requireCouple(context);
  const record = await context.store.get(collection, id);
  if (!record || record.couple_id !== couple._id || (!allowDeleted && record.deleted_at)) fail("NOT_FOUND", "内容不存在或无权访问。");
  return record;
}

async function notify(
  context: DomainContext,
  receiverId: string,
  type: string,
  resourceType: string,
  resourceId: string,
  preview: string,
  coupleIdOverride?: string,
): Promise<void> {
  if (receiverId === context.user.user_id) return;
  const couple = coupleIdOverride ? await context.store.get("couples", coupleIdOverride) : await requireCouple(context);
  if (!couple) fail("NOT_FOUND", "空间不存在或已不可用。");
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
    created_at: context.now,
  }, randomId("ntf"));
}

async function audit(context: DomainContext, action: string, resourceType: string, resourceId: string, changedFields: string[]): Promise<void> {
  await context.store.add("audit_logs", {
    couple_id: context.user.couple_id,
    actor_id: context.user.user_id,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    request_id: context.requestId,
    changed_fields: changedFields,
    created_at: context.now,
  }, randomId("audit"));
}

function page<T extends Document>(items: T[], payload: JsonObject): { items: T[]; next_cursor: string | null } {
  const size = clampPageSize(payload);
  const offset = typeof payload.cursor === "string" && /^\d+$/.test(payload.cursor) ? Number(payload.cursor) : 0;
  const result = items.slice(offset, offset + size);
  return { items: result, next_cursor: offset + size < items.length ? String(offset + size) : null };
}

function sortableTime(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

async function findAll(store: Store, collection: string, where: Record<string, unknown>): Promise<Document[]> {
  const records: Document[] = [];
  let offset = 0;
  while (true) {
    const batch = await store.find(collection, where, 100, offset);
    records.push(...batch);
    if (batch.length < 100) return records;
    offset += batch.length;
  }
}

async function authGet(context: DomainContext): Promise<JsonObject> {
  let couple: Document | null = null;
  let memberList: JsonObject[] = [];
  if (context.user.couple_id) {
    couple = await context.store.get("couples", context.user.couple_id);
    if (couple) memberList = await members(context.store, couple);
  }
  return { user: { ...publicUser(context.user), archived_exports: (context.user.archived_couple_ids || []).filter((item: any) => item.export_until > context.now) }, couple: couple ? coupleView(couple, memberList) : null, is_new: !context.user.profile_completed };
}

async function updateProfile(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const nickname = stringField(payload, "nickname", { required: true, min: 1, max: 24 });
  const avatarKey = enumField(payload, "avatar_key", AVATARS, "sage");
  const updated = await context.store.update("users", context.user._id, {
    nickname,
    avatar_key: avatarKey,
    profile_completed: true,
    updated_at: context.now,
  });
  return publicUser(updated);
}

async function createCouple(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  if (context.user.couple_id) fail("ALREADY_BOUND", "当前账号已经属于一个空间。");
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
    updated_at: context.now,
  }, coupleId);
  await context.store.update("users", context.user._id, { couple_id: coupleId, updated_at: context.now });
  await audit({ ...context, user: { ...context.user, couple_id: coupleId } }, "couple.create", "couple", coupleId, ["name", "start_date"]);
  return coupleView(couple, [publicUser(context.user)]);
}

async function getCouple(context: DomainContext): Promise<JsonObject> {
  const couple = await requireCouple(context, true);
  const result: JsonObject = coupleView(couple, await members(context.store, couple));
  if (couple.status !== "archived" && couple.created_by === context.user.user_id) {
    const requests = (await context.store.find("join_requests", { couple_id: couple._id, status: "pending" }, 20));
    const users = await context.store.find("users", {}, 100);
    result.pending_join_requests = requests.map((request) => ({
      ...request,
      applicant: publicUser(users.find((user) => user.user_id === request.applicant_id) || { _id: "missing", user_id: request.applicant_id }),
    }));
  }
  return result;
}

async function updateCouple(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const couple = await requireCouple(context);
  const version = expectedVersion(payload);
  assertVersion(couple, version);
  const patch: JsonObject = { updated_at: context.now, version: version + 1 };
  if (payload.name !== undefined) patch.name = stringField(payload, "name", { required: true, max: 30 });
  if (payload.start_date !== undefined) patch.start_date = dateField(payload, "start_date");
  if (payload.timezone !== undefined) {
    const timezone = stringField(payload, "timezone", { required: true, max: 64 });
    if (timezone !== "Asia/Shanghai") fail("VALIDATION_ERROR", "首版仅开放 Asia/Shanghai 时区。");
    patch.timezone = timezone;
  }
  const updated = await context.store.update("couples", couple._id, patch);
  await audit(context, "couple.update", "couple", couple._id, Object.keys(patch).filter((key) => !["updated_at", "version"].includes(key)));
  return coupleView(updated, await members(context.store, updated));
}

async function createInvite(context: DomainContext): Promise<JsonObject> {
  const couple = await requireCouple(context);
  if (couple.member_ids.length >= 2) fail("COUPLE_FULL", "空间已经有两名成员。");
  const previous = await context.store.find("invitations", { couple_id: couple._id }, 100);
  for (const invitation of previous) {
    if (!invitation.revoked_at && !invitation.consumed_at) await context.store.update("invitations", invitation._id, { revoked_at: context.now });
  }
  const code = randomInviteCode();
  const invitation = await context.store.add("invitations", {
    couple_id: couple._id,
    token_hash: sha256(code),
    created_by: context.user.user_id,
    expires_at: context.now + 24 * 60 * 60 * 1000,
    revoked_at: null,
    consumed_at: null,
    created_at: context.now,
    updated_at: context.now,
  }, randomId("inv"));
  return { invitation_id: invitation._id, code, expires_at: invitation.expires_at };
}

async function revokeInvite(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const couple = await requireCouple(context);
  const invitationId = stringField(payload, "invitation_id", { required: true });
  const invitation = await context.store.get("invitations", invitationId);
  if (!invitation || invitation.couple_id !== couple._id || invitation.created_by !== context.user.user_id) fail("NOT_FOUND", "邀请不存在或无权操作。");
  if (invitation.consumed_at) fail("INVALID_STATE", "邀请已经完成使用。");
  await context.store.update("invitations", invitation._id, { revoked_at: context.now, updated_at: context.now });
  return { revoked: true };
}

async function requestJoin(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  if (context.user.couple_id) fail("ALREADY_BOUND", "当前账号已经属于一个空间。");
  const code = stringField(payload, "code", { required: true, min: 10, max: 10 }).toUpperCase();
  const invitations = await context.store.find("invitations", { token_hash: sha256(code) }, 2);
  const invitation = invitations[0];
  if (!invitation || invitation.revoked_at || invitation.consumed_at || invitation.expires_at <= context.now) fail("INVITE_INVALID", "邀请码无效、已过期或已撤销。");
  const couple = await context.store.get("couples", invitation.couple_id);
  if (!couple || couple.status === "archived" || couple.member_ids.length >= 2) fail("INVITE_INVALID", "邀请码无效、已过期或已撤销。");
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
    updated_at: context.now,
  }, randomId("join"));
  await notify(context, invitation.created_by, "join_requested", "join_request", request._id, "收到一份新的加入申请", couple._id);
  return { join_request_id: request._id, status: "pending" };
}

async function confirmJoin(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const couple = await requireCouple(context);
  const requestId = stringField(payload, "join_request_id", { required: true });
  const request = await context.store.get("join_requests", requestId);
  if (!request || request.couple_id !== couple._id) fail("NOT_FOUND", "加入申请不存在。");
  const invitation = await context.store.get("invitations", request.invitation_id);
  if (!invitation || invitation.created_by !== context.user.user_id) fail("FORBIDDEN", "只有邀请发起人可以确认加入。");
  if (request.status !== "pending" || request.expires_at <= context.now || invitation.revoked_at || invitation.consumed_at) fail("INVALID_STATE", "加入申请已失效。");
  if (couple.member_ids.length >= 2) fail("COUPLE_FULL", "空间已经有两名成员。");
  const applicants = await context.store.find("users", { user_id: request.applicant_id }, 2);
  const applicant = applicants[0];
  if (!applicant || applicant.couple_id) fail("ALREADY_BOUND", "申请人已经加入其他空间。");
  const updatedCouple = await context.store.update("couples", couple._id, {
    member_ids: [...couple.member_ids, applicant.user_id],
    status: "active",
    version: couple.version + 1,
    updated_at: context.now,
  });
  await context.store.update("users", applicant._id, { couple_id: couple._id, updated_at: context.now });
  await context.store.update("join_requests", request._id, { status: "approved", decided_at: context.now, updated_at: context.now });
  await context.store.update("invitations", invitation._id, { consumed_at: context.now, updated_at: context.now });
  await notify(context, applicant.user_id, "couple_joined", "couple", couple._id, "双人空间已经建立");
  return coupleView(updatedCouple, await members(context.store, updatedCouple));
}

async function rejectJoin(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const couple = await requireCouple(context);
  const request = await context.store.get("join_requests", stringField(payload, "join_request_id", { required: true }));
  if (!request || request.couple_id !== couple._id) fail("NOT_FOUND", "加入申请不存在。");
  const invitation = await context.store.get("invitations", request.invitation_id);
  if (!invitation || invitation.created_by !== context.user.user_id) fail("FORBIDDEN", "只有邀请发起人可以拒绝加入。");
  if (request.status !== "pending") fail("INVALID_STATE", "申请已经处理。");
  await context.store.update("join_requests", request._id, { status: "rejected", decided_at: context.now, updated_at: context.now });
  return { status: "rejected" };
}

async function taskList(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const couple = await requireCouple(context);
  const scope = enumField(payload, "scope", ["mine", "all", "completed"] as const, "mine");
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

async function taskGet(context: DomainContext, payload: JsonObject): Promise<Document> {
  return assertResource(context, "tasks", stringField(payload, "task_id", { required: true }));
}

async function taskCreate(context: DomainContext, payload: JsonObject): Promise<Document> {
  const couple = await requireCouple(context);
  const sourceWishId = payload.source_wish_id ? stringField(payload, "source_wish_id", { required: true }) : null;
  if (sourceWishId) {
    await assertResource(context, "wishes", sourceWishId);
    const existing = (await context.store.find("tasks", { couple_id: couple._id, source_wish_id: sourceWishId }, 1))[0];
    if (existing && !existing.deleted_at) return existing;
  }
  const title = stringField(payload, "title", { required: true, max: 80 });
  const description = stringField(payload, "description", { max: 1000 });
  const assigneeId = payload.assignee_id === null || payload.assignee_id === "" || payload.assignee_id === undefined ? null : stringField(payload, "assignee_id", { required: true });
  if (assigneeId && !couple.member_ids.includes(assigneeId)) fail("VALIDATION_ERROR", "负责人必须是当前空间成员。");
  const record = await context.store.add("tasks", {
    couple_id: couple._id,
    title,
    description,
    creator_id: context.user.user_id,
    assignee_id: assigneeId,
    due_at: optionalNumber(payload, "due_at"),
    priority: enumField(payload, "priority", ["normal", "important"] as const, "normal"),
    status: "todo",
    completed_by: null,
    completed_at: null,
    source_wish_id: sourceWishId,
    version: 1,
    deleted_at: null,
    created_at: context.now,
    updated_at: context.now,
  }, randomId("task"));
  if (assigneeId) await notify(context, assigneeId, "task_assigned", "task", record._id, `新待办：${title}`);
  await audit(context, "task.create", "task", record._id, ["title", "description", "assignee_id", "due_at", "priority"]);
  return record;
}

async function taskUpdate(context: DomainContext, payload: JsonObject): Promise<Document> {
  const task = await assertResource(context, "tasks", stringField(payload, "task_id", { required: true }));
  if (task.creator_id !== context.user.user_id && task.assignee_id !== context.user.user_id) fail("FORBIDDEN", "只有创建者或负责人可以编辑任务。");
  if (task.status === "cancelled") fail("INVALID_STATE", "已取消任务不能编辑。");
  const version = expectedVersion(payload);
  assertVersion(task, version);
  const couple = await requireCouple(context);
  const patch: JsonObject = { version: version + 1, updated_at: context.now };
  if (payload.title !== undefined) patch.title = stringField(payload, "title", { required: true, max: 80 });
  if (payload.description !== undefined) patch.description = stringField(payload, "description", { max: 1000 });
  if (payload.assignee_id !== undefined) {
    const assignee = payload.assignee_id === null || payload.assignee_id === "" ? null : stringField(payload, "assignee_id", { required: true });
    if (assignee && !couple.member_ids.includes(assignee)) fail("VALIDATION_ERROR", "负责人必须是当前空间成员。");
    patch.assignee_id = assignee;
  }
  if (payload.due_at !== undefined) patch.due_at = optionalNumber(payload, "due_at");
  if (payload.priority !== undefined) patch.priority = enumField(payload, "priority", ["normal", "important"] as const);
  const updated = await context.store.update("tasks", task._id, patch);
  await audit(context, "task.update", "task", task._id, Object.keys(patch).filter((key) => !["updated_at", "version"].includes(key)));
  return updated;
}

async function taskTransition(context: DomainContext, payload: JsonObject): Promise<Document> {
  const task = await assertResource(context, "tasks", stringField(payload, "task_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(task, version);
  const target = enumField(payload, "target_status", TASK_STATUSES);
  const allowed: Record<string, string[]> = { todo: ["doing", "done", "cancelled"], doing: ["done", "cancelled"], done: ["todo"], cancelled: [] };
  if (!allowed[task.status]?.includes(target)) fail("INVALID_STATE", "当前状态不允许执行这个操作。");
  if (target === "cancelled" && task.creator_id !== context.user.user_id) fail("FORBIDDEN", "只有创建者可以取消任务。");
  if (["doing", "done", "todo"].includes(target) && task.assignee_id && task.assignee_id !== context.user.user_id) fail("FORBIDDEN", "只有负责人可以变更任务进度。");
  const patch: JsonObject = {
    status: target,
    completed_by: target === "done" ? context.user.user_id : null,
    completed_at: target === "done" ? context.now : null,
    version: version + 1,
    updated_at: context.now,
  };
  const updated = await context.store.update("tasks", task._id, patch);
  if (target === "done") await notify(context, task.creator_id, "task_completed", "task", task._id, `待办已完成：${task.title}`);
  await audit(context, "task.transition", "task", task._id, ["status", "completed_by", "completed_at"]);
  return updated;
}

async function taskDelete(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const task = await assertResource(context, "tasks", stringField(payload, "task_id", { required: true }));
  if (task.creator_id !== context.user.user_id) fail("FORBIDDEN", "只有创建者可以删除任务。");
  const version = expectedVersion(payload);
  assertVersion(task, version);
  await context.store.update("tasks", task._id, { deleted_at: context.now, version: version + 1, updated_at: context.now });
  await audit(context, "task.delete", "task", task._id, ["deleted_at"]);
  return { deleted: true };
}

async function approvalList(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const couple = await requireCouple(context);
  const scope = enumField(payload, "scope", ["pending", "sent", "all"] as const, "pending");
  let records = await context.store.find("approvals", { couple_id: couple._id }, 100);
  records = records.map((item) => item.status === "pending" && item.reply_deadline && item.reply_deadline <= context.now ? { ...item, status: "expired" } : item);
  if (scope === "pending") records = records.filter((item) => item.approver_id === context.user.user_id && item.status === "pending");
  if (scope === "sent") records = records.filter((item) => item.applicant_id === context.user.user_id);
  records.sort((a, b) => b.created_at - a.created_at);
  return page(records, payload);
}

async function approvalGet(context: DomainContext, payload: JsonObject): Promise<Document> {
  return assertResource(context, "approvals", stringField(payload, "approval_id", { required: true }));
}

async function approvalSubmit(context: DomainContext, payload: JsonObject): Promise<Document> {
  const couple = await requireCouple(context);
  if (couple.member_ids.length !== 2) fail("INVALID_STATE", "等待另一名成员加入后才能提交申请。");
  const approverId = couple.member_ids.find((id: string) => id !== context.user.user_id);
  if (!approverId) fail("INVALID_STATE", "没有可用的审批人。");
  const startAt = optionalNumber(payload, "start_at");
  const endAt = optionalNumber(payload, "end_at");
  if (startAt && endAt && endAt < startAt) fail("VALIDATION_ERROR", "结束时间不能早于开始时间。");
  const record = await context.store.add("approvals", {
    couple_id: couple._id,
    template_key: enumField(payload, "template_key", ["date", "outing", "entertainment", "purchase", "other"] as const, "other"),
    title: stringField(payload, "title", { required: true, max: 80 }),
    content: stringField(payload, "content", { max: 1000 }),
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
    updated_at: context.now,
  }, randomId("approval"));
  await notify(context, approverId, "approval_received", "approval", record._id, `收到申请：${record.title}`);
  await audit(context, "approval.submit", "approval", record._id, ["title", "content", "start_at", "end_at", "reply_deadline"]);
  return record;
}

async function approvalDecide(context: DomainContext, payload: JsonObject): Promise<Document> {
  const record = await assertResource(context, "approvals", stringField(payload, "approval_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(record, version);
  if (record.status !== "pending") fail("INVALID_STATE", "申请已经处理。");
  if (record.reply_deadline && record.reply_deadline <= context.now) fail("INVALID_STATE", "申请已超过回复期限。");
  if (record.approver_id !== context.user.user_id || record.applicant_id === context.user.user_id) fail("FORBIDDEN", "只有指定审批人可以处理申请。");
  const decision = enumField(payload, "decision", ["approved", "rejected"] as const);
  const updated = await context.store.update("approvals", record._id, {
    status: decision,
    decision_comment: stringField(payload, "decision_comment", { max: 500 }),
    decided_at: context.now,
    version: version + 1,
    updated_at: context.now,
  });
  await notify(context, record.applicant_id, "approval_decided", "approval", record._id, decision === "approved" ? "申请已同意" : "申请需要再商量");
  await audit(context, "approval.decide", "approval", record._id, ["status", "decision_comment", "decided_at"]);
  return updated;
}

async function approvalCancel(context: DomainContext, payload: JsonObject): Promise<Document> {
  const record = await assertResource(context, "approvals", stringField(payload, "approval_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(record, version);
  if (record.status !== "pending") fail("INVALID_STATE", "申请已经处理。");
  if (record.applicant_id !== context.user.user_id) fail("FORBIDDEN", "只有申请人可以撤回。");
  const updated = await context.store.update("approvals", record._id, { status: "cancelled", version: version + 1, updated_at: context.now });
  await audit(context, "approval.cancel", "approval", record._id, ["status"]);
  return updated;
}

function eventFields(payload: JsonObject): JsonObject {
  const allDay = booleanField(payload, "all_day", false);
  const fields: JsonObject = {
    title: stringField(payload, "title", { required: true, max: 80 }),
    description: stringField(payload, "description", { max: 1000 }),
    type: enumField(payload, "type", ["date", "life", "anniversary", "other"] as const, "other"),
    all_day: allDay,
  };
  if (allDay) {
    fields.date_start = dateField(payload, "date_start", true);
    fields.date_end = dateField(payload, "date_end") || fields.date_start;
    if (String(fields.date_end) < String(fields.date_start)) fail("VALIDATION_ERROR", "结束日期不能早于开始日期。");
    fields.start_at = null;
    fields.end_at = null;
  } else {
    fields.start_at = optionalNumber(payload, "start_at");
    fields.end_at = optionalNumber(payload, "end_at");
    if (!fields.start_at) fail("VALIDATION_ERROR", "定时日程必须填写开始时间。");
    if (fields.end_at && Number(fields.end_at) < Number(fields.start_at)) fail("VALIDATION_ERROR", "结束时间不能早于开始时间。");
    fields.date_start = null;
    fields.date_end = null;
  }
  return fields;
}

async function eventList(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
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

async function eventGet(context: DomainContext, payload: JsonObject): Promise<Document> {
  return assertResource(context, "events", stringField(payload, "event_id", { required: true }));
}

async function eventCreate(context: DomainContext, payload: JsonObject): Promise<Document> {
  const couple = await requireCouple(context);
  const sourceApprovalId = payload.source_approval_id ? stringField(payload, "source_approval_id") : null;
  const sourceWishId = payload.source_wish_id ? stringField(payload, "source_wish_id") : null;
  if (sourceApprovalId) {
    const source = await assertResource(context, "approvals", sourceApprovalId);
    if (source.status !== "approved") fail("INVALID_STATE", "只有已同意的申请可以转为日程。");
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
    updated_at: context.now,
  }, randomId("event"));
  for (const memberId of couple.member_ids) await notify(context, memberId, "event_created", "event", record._id, `新增日程：${record.title}`);
  await audit(context, "event.create", "event", record._id, ["title", "all_day", "start_at", "date_start"]);
  return record;
}

async function eventUpdate(context: DomainContext, payload: JsonObject): Promise<Document> {
  const event = await assertResource(context, "events", stringField(payload, "event_id", { required: true }));
  if (event.creator_id !== context.user.user_id) fail("FORBIDDEN", "只有创建者可以编辑日程。");
  const version = expectedVersion(payload);
  assertVersion(event, version);
  const updated = await context.store.update("events", event._id, { ...eventFields(payload), version: version + 1, updated_at: context.now });
  await audit(context, "event.update", "event", event._id, ["title", "description", "all_day", "start_at", "date_start"]);
  return updated;
}

async function eventDelete(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const event = await assertResource(context, "events", stringField(payload, "event_id", { required: true }));
  if (event.creator_id !== context.user.user_id) fail("FORBIDDEN", "只有创建者可以删除日程。");
  const version = expectedVersion(payload);
  assertVersion(event, version);
  await context.store.update("events", event._id, { deleted_at: context.now, version: version + 1, updated_at: context.now });
  return { deleted: true };
}

async function anniversaryList(context: DomainContext): Promise<Document[]> {
  const couple = await requireCouple(context);
  const today = localDate(context.now, couple.timezone);
  return (await context.store.find("anniversaries", { couple_id: couple._id }, 100)).filter((item) => !item.deleted_at).map((item) => ({ ...item, ...nextAnniversary(item.original_date, today) })).sort((a, b) => a.days_until - b.days_until);
}

async function anniversaryCreate(context: DomainContext, payload: JsonObject): Promise<Document> {
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
    updated_at: context.now,
  }, randomId("ann"));
}

async function anniversaryUpdate(context: DomainContext, payload: JsonObject): Promise<Document> {
  const record = await assertResource(context, "anniversaries", stringField(payload, "anniversary_id", { required: true }));
  if (record.creator_id !== context.user.user_id) fail("FORBIDDEN", "只有创建者可以编辑纪念日。");
  const version = expectedVersion(payload);
  assertVersion(record, version);
  return context.store.update("anniversaries", record._id, {
    title: stringField(payload, "title", { required: true, max: 80 }),
    original_date: dateField(payload, "original_date", true),
    version: version + 1,
    updated_at: context.now,
  });
}

async function anniversaryDelete(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const record = await assertResource(context, "anniversaries", stringField(payload, "anniversary_id", { required: true }));
  if (record.creator_id !== context.user.user_id) fail("FORBIDDEN", "只有创建者可以删除纪念日。");
  const version = expectedVersion(payload);
  assertVersion(record, version);
  await context.store.update("anniversaries", record._id, { deleted_at: context.now, version: version + 1, updated_at: context.now });
  return { deleted: true };
}

async function wishList(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const couple = await requireCouple(context);
  const status = payload.status ? enumField(payload, "status", WISH_STATUSES) : null;
  let records = (await context.store.find("wishes", { couple_id: couple._id }, 100)).filter((item) => !item.deleted_at);
  if (status) records = records.filter((item) => item.status === status);
  records.sort((a, b) => b.created_at - a.created_at);
  return page(records, payload);
}

async function wishGet(context: DomainContext, payload: JsonObject): Promise<Document> {
  return assertResource(context, "wishes", stringField(payload, "wish_id", { required: true }));
}

async function wishCreate(context: DomainContext, payload: JsonObject): Promise<Document> {
  const couple = await requireCouple(context);
  return context.store.add("wishes", {
    couple_id: couple._id,
    title: stringField(payload, "title", { required: true, max: 80 }),
    description: stringField(payload, "description", { max: 1000 }),
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
    updated_at: context.now,
  }, randomId("wish"));
}

async function wishUpdate(context: DomainContext, payload: JsonObject): Promise<Document> {
  const record = await assertResource(context, "wishes", stringField(payload, "wish_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(record, version);
  if (record.status === "archived") fail("INVALID_STATE", "已归档的愿望不能编辑。");
  const nextStatus = enumField(payload, "status", ["pending", "planned", "archived"] as const, record.status);
  if (record.status === "completed" && nextStatus !== "archived") fail("INVALID_STATE", "已完成的愿望只能归档。");
  return context.store.update("wishes", record._id, {
    title: stringField(payload, "title", { required: true, max: 80 }),
    description: stringField(payload, "description", { max: 1000 }),
    category: enumField(payload, "category", WISH_CATEGORIES, record.category),
    target_date: dateField(payload, "target_date"),
    status: nextStatus,
    version: version + 1,
    updated_at: context.now,
  });
}

async function wishComplete(context: DomainContext, payload: JsonObject): Promise<Document> {
  const record = await assertResource(context, "wishes", stringField(payload, "wish_id", { required: true }));
  const version = expectedVersion(payload);
  assertVersion(record, version);
  if (!['pending', 'planned'].includes(record.status)) fail("INVALID_STATE", "当前愿望不能标记完成。");
  return context.store.update("wishes", record._id, {
    status: "completed",
    completed_by: context.user.user_id,
    completed_at: context.now,
    completion_note: stringField(payload, "completion_note", { max: 300 }),
    version: version + 1,
    updated_at: context.now,
  });
}

async function wishDelete(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const record = await assertResource(context, "wishes", stringField(payload, "wish_id", { required: true }));
  if (record.creator_id !== context.user.user_id) fail("FORBIDDEN", "只有创建者可以删除愿望。");
  const version = expectedVersion(payload);
  assertVersion(record, version);
  await context.store.update("wishes", record._id, { deleted_at: context.now, version: version + 1, updated_at: context.now });
  return { deleted: true };
}

async function notificationList(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  await requireCouple(context, true);
  const records = (await context.store.find("notifications", { receiver_id: context.user.user_id }, 100)).sort((a, b) => b.created_at - a.created_at);
  return page(records, payload);
}

async function notificationMarkRead(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  const id = stringField(payload, "notification_id", { required: true });
  const record = await context.store.get("notifications", id);
  if (!record || record.receiver_id !== context.user.user_id) fail("NOT_FOUND", "消息不存在。");
  await context.store.update("notifications", id, { read_at: context.now });
  return { read: true };
}

async function dashboardGet(context: DomainContext): Promise<JsonObject> {
  const couple = await requireCouple(context);
  const today = localDate(context.now, couple.timezone);
  const tomorrow = new Date(`${today}T00:00:00Z`).getTime() + 86_400_000;
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
    together_days: togetherDays(couple.start_date || null, today),
  };
}

const EXPORT_COLLECTIONS = ["tasks", "approvals", "events", "anniversaries", "wishes", "notifications"];

async function dataExport(context: DomainContext, payload: JsonObject): Promise<JsonObject> {
  let couple: Document | null = null;
  const requestedId = payload.couple_id ? stringField(payload, "couple_id", { required: true }) : null;
  if (context.user.couple_id && (!requestedId || requestedId === context.user.couple_id)) couple = await requireCouple(context, true);
  else {
    const references = (context.user.archived_couple_ids || []).filter((item: any) => item.export_until > context.now);
    const reference = requestedId ? references.find((item: any) => item.couple_id === requestedId) : references.sort((a: any, b: any) => b.export_until - a.export_until)[0];
    if (!reference) fail("NOT_FOUND", "没有可导出的历史空间，或30天只读期已结束。");
    couple = await context.store.get("couples", reference.couple_id);
    if (!couple || couple.status !== "archived" || !couple.archived_member_ids?.includes(context.user.user_id)) fail("NOT_FOUND", "历史空间不存在或无权导出。");
  }
  if (payload.collection) {
    const collection = enumField(payload, "collection", EXPORT_COLLECTIONS as readonly string[]);
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
      next_cursor: records.length > size ? String(offset + size) : null,
    };
  }
  const data: JsonObject = {};
  for (const collection of EXPORT_COLLECTIONS) {
    const records = await context.store.find(collection, collection === "notifications" ? { receiver_id: context.user.user_id } : { couple_id: couple._id }, 100);
    data[collection] = records.map(({ _openid, token_hash, openid, ...safe }) => safe);
  }
  return {
    schema_version: 1,
    exported_at: new Date(context.now).toISOString(),
    timezone: couple.timezone,
    couple: coupleView(couple, await members(context.store, couple)),
    data,
  };
}

async function archiveCouple(context: DomainContext): Promise<JsonObject> {
  const couple = await requireCouple(context);
  const archivedMemberIds = [...couple.member_ids];
  const users = await context.store.find("users", {}, 100);
  const exportUntil = context.now + 30 * 86_400_000;
  const archivedMembers = archivedMemberIds.map((memberId) => {
    const member = users.find((item) => item.user_id === memberId);
    return member ? publicUser(member) : { user_id: memberId, nickname: "已删除用户", avatar_key: "sage" };
  });
  for (const memberId of archivedMemberIds) {
    const user = users.find((item) => item.user_id === memberId);
    if (user) {
      const previous = (user.archived_couple_ids || []).filter((item: any) => item.couple_id !== couple._id && item.export_until > context.now);
      await context.store.update("users", user._id, { couple_id: null, archived_couple_ids: [...previous, { couple_id: couple._id, export_until: exportUntil }], updated_at: context.now });
    }
    await notify(context, memberId, "couple_archived", "couple", couple._id, "双人空间已归档");
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
    updated_at: context.now,
  });
  return { archived: true, couple_id: couple._id, export_until: exportUntil };
}

async function accountDelete(context: DomainContext): Promise<JsonObject> {
  const affectedCoupleIds = new Set<string>((context.user.archived_couple_ids || []).map((item: any) => item.couple_id));
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
        const patch: JsonObject = {};
        for (const field of identityFields) if (record[field] === context.user.user_id) patch[field] = anonymousId;
        if (Object.keys(patch).length) await context.store.update(collection, record._id, patch);
      }
    }
    const couple = await context.store.get("couples", coupleId);
    if (couple?.archived_members) {
      const archivedMembers = couple.archived_members.map((member: any) => member.user_id === context.user.user_id ? { user_id: anonymousId, nickname: "已删除用户", avatar_key: "sage", status: "deleted" } : member);
      await context.store.update("couples", coupleId, { archived_members: archivedMembers, archived_member_ids: (couple.archived_member_ids || []).map((id: string) => id === context.user.user_id ? anonymousId : id), updated_at: context.now });
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

const actions: Record<string, ActionDefinition> = {
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
  "account.delete": { write: true, handler: accountDelete },
};

export class DomainService {
  constructor(private readonly store: Store, private readonly now = () => Date.now()) {}

  async execute(action: string, payload: JsonObject, user: Actor, requestId: string): Promise<unknown> {
    const definition = actions[action];
    if (!definition) fail("ACTION_NOT_FOUND", "请求的功能尚未开放。");
    if (user.status !== "active") fail("UNAUTHENTICATED", "账号已注销或不可用。");
    const timestamp = this.now();
    if (!definition.write) return definition.handler({ store: this.store, user, requestId, now: timestamp }, payload);
    if (!requestId || requestId.length < 8 || requestId.length > 100) fail("VALIDATION_ERROR", "写操作必须提供有效 request_id。");
    if (action === "join.request") await this.assertJoinRateLimit(user, timestamp);
    const dedupId = sha256(`${user.user_id}:${action}:${requestId}`);
    const payloadHash = sha256(stableStringify(payload));
    try {
      return await this.store.runTransaction(async (transaction) => {
        const existing = await transaction.get("request_dedup", dedupId);
        if (existing) {
          if (existing.payload_hash !== payloadHash) fail("VERSION_CONFLICT", "同一个 request_id 不能用于不同内容。");
          return existing.result;
        }
        const txUser = (await transaction.get("users", user._id) || user) as Actor;
        const result = await definition.handler({ store: transaction, user: txUser, requestId, now: timestamp }, payload);
        await transaction.put("request_dedup", dedupId, {
          actor_id: user.user_id,
          action,
          request_id: requestId,
          payload_hash: payloadHash,
          result,
          created_at: timestamp,
          expires_at: timestamp + 7 * 86_400_000,
        });
        return result;
      });
    } catch (error) {
      if (action === "join.request" && error instanceof DomainError && error.code === "INVITE_INVALID") await this.recordJoinFailure(user, timestamp);
      throw error;
    }
  }

  private async assertJoinRateLimit(user: Actor, now: number): Promise<void> {
    const record = await this.store.get("invite_rate_limits", user.user_id);
    if (!record) return;
    const recent = (record.attempts || []).filter((timestamp: number) => timestamp > now - 15 * 60 * 1000);
    if (recent.length >= 5) fail("RATE_LIMITED", "邀请码尝试次数过多，请15分钟后再试。");
  }

  private async recordJoinFailure(user: Actor, now: number): Promise<void> {
    const record = await this.store.get("invite_rate_limits", user.user_id);
    const attempts = (record?.attempts || []).filter((timestamp: number) => timestamp > now - 15 * 60 * 1000);
    attempts.push(now);
    await this.store.put("invite_rate_limits", user.user_id, { attempts, updated_at: now });
  }
}

export const compatibilityActions: Record<string, string> = {
  "identity.get": "auth.get",
  "identity.bootstrap": "auth.bootstrap",
};
