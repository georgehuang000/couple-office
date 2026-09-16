const assert = require("node:assert/strict");
const test = require("node:test");
const { DomainService, MemoryStore, sha256 } = require("../.build/server-testing.cjs");

const NOW = Date.parse("2026-09-16T04:00:00Z");
const user = (name, coupleId = "cp_1") => ({ _id: `identity_${name}`, user_id: name, nickname: name, avatar_key: "sage", couple_id: coupleId, status: "active", profile_completed: true, created_at: NOW, updated_at: NOW });
const couple = (status = "active", members = ["u1", "u2"]) => ({ _id: "cp_1", name: "两人事务所", member_ids: members, archived_member_ids: [], created_by: "u1", start_date: "2026-09-01", timezone: "Asia/Shanghai", status, version: 1, created_at: NOW, updated_at: NOW });

function activeStore(extra = {}) {
  return new MemoryStore({ users: [user("u1"), user("u2")], couples: [couple()], ...extra });
}

test("task writes are idempotent and reject request-id payload reuse", async () => {
  const store = activeStore();
  const service = new DomainService(store, () => NOW);
  const actor = user("u1");
  const first = await service.execute("task.create", { title: "买菜", priority: "normal" }, actor, "request-task-0001");
  const again = await service.execute("task.create", { title: "买菜", priority: "normal" }, actor, "request-task-0001");
  assert.equal(first._id, again._id);
  assert.equal(store.snapshot().tasks.length, 1);
  await assert.rejects(service.execute("task.create", { title: "改成别的" }, actor, "request-task-0001"), { code: "VERSION_CONFLICT" });
});

test("task state machine enforces assignee permission and optimistic version", async () => {
  const store = activeStore({ tasks: [{ _id: "task_1", couple_id: "cp_1", title: "任务", description: "", creator_id: "u1", assignee_id: "u2", status: "todo", priority: "normal", version: 1, deleted_at: null, created_at: NOW, updated_at: NOW }] });
  const service = new DomainService(store, () => NOW);
  await assert.rejects(service.execute("task.transition", { task_id: "task_1", target_status: "done", expected_version: 1 }, user("u1"), "request-transition-1"), { code: "FORBIDDEN" });
  const done = await service.execute("task.transition", { task_id: "task_1", target_status: "done", expected_version: 1 }, user("u2"), "request-transition-2");
  assert.equal(done.status, "done");
  await assert.rejects(service.execute("task.transition", { task_id: "task_1", target_status: "todo", expected_version: 1 }, user("u2"), "request-transition-3"), { code: "VERSION_CONFLICT" });
});

test("task editing is limited to its creator or assignee", async () => {
  const outsider = user("u3");
  const store = new MemoryStore({
    users: [user("u1"), user("u2"), outsider],
    couples: [couple("active", ["u1", "u2", "u3"])],
    tasks: [{ _id: "task_edit", couple_id: "cp_1", title: "任务", description: "", creator_id: "u1", assignee_id: "u2", status: "todo", priority: "normal", version: 1, deleted_at: null, created_at: NOW, updated_at: NOW }],
  });
  const service = new DomainService(store, () => NOW);
  await assert.rejects(service.execute("task.update", { task_id: "task_edit", title: "越权修改", expected_version: 1 }, outsider, "request-edit-outsider"), { code: "FORBIDDEN" });
  const updated = await service.execute("task.update", { task_id: "task_edit", title: "负责人修改", expected_version: 1 }, user("u2"), "request-edit-assignee");
  assert.equal(updated.title, "负责人修改");
});

test("event and anniversary updates are creator-only", async () => {
  const store = activeStore({
    events: [{ _id: "event_1", couple_id: "cp_1", title: "散步", description: "", type: "life", all_day: true, date_start: "2026-09-16", date_end: "2026-09-16", start_at: null, end_at: null, creator_id: "u1", version: 1, deleted_at: null, created_at: NOW, updated_at: NOW }],
    anniversaries: [{ _id: "ann_1", couple_id: "cp_1", title: "纪念日", original_date: "2025-09-16", creator_id: "u1", version: 1, deleted_at: null, created_at: NOW, updated_at: NOW }],
  });
  const service = new DomainService(store, () => NOW);
  await assert.rejects(service.execute("event.update", { event_id: "event_1", title: "修改", description: "", type: "life", all_day: true, date_start: "2026-09-16", date_end: "2026-09-16", expected_version: 1 }, user("u2"), "request-event-outsider"), { code: "FORBIDDEN" });
  await assert.rejects(service.execute("anniversary.update", { anniversary_id: "ann_1", title: "修改", original_date: "2025-09-16", expected_version: 1 }, user("u2"), "request-ann-outsider"), { code: "FORBIDDEN" });
});

test("approval decision wins over a concurrent stale cancellation", async () => {
  const store = activeStore({ approvals: [{ _id: "approval_1", couple_id: "cp_1", template_key: "date", title: "去散步", content: "", applicant_id: "u1", approver_id: "u2", start_at: null, end_at: null, reply_deadline: NOW + 10000, status: "pending", decision_comment: "", decided_at: null, version: 1, created_at: NOW, updated_at: NOW }] });
  const service = new DomainService(store, () => NOW);
  const approved = await service.execute("approval.decide", { approval_id: "approval_1", decision: "approved", decision_comment: "", expected_version: 1 }, user("u2"), "request-approval-1");
  assert.equal(approved.status, "approved");
  await assert.rejects(service.execute("approval.cancel", { approval_id: "approval_1", expected_version: 1 }, user("u1"), "request-approval-2"), { code: "VERSION_CONFLICT" });
});

test("only one applicant can consume an invitation", async () => {
  const code = "ABCDEFGH23";
  const creator = user("u1"); creator.couple_id = "cp_1";
  const u2 = user("u2", null); const u3 = user("u3", null);
  const store = new MemoryStore({ users: [creator, u2, u3], couples: [couple("waiting", ["u1"])], invitations: [{ _id: "inv_1", couple_id: "cp_1", token_hash: sha256(code), created_by: "u1", expires_at: NOW + 100000, revoked_at: null, consumed_at: null, created_at: NOW, updated_at: NOW }] });
  const service = new DomainService(store, () => NOW);
  const req2 = await service.execute("join.request", { code }, u2, "request-join-u2");
  const req3 = await service.execute("join.request", { code }, u3, "request-join-u3");
  const joined = await service.execute("join.confirm", { join_request_id: req2.join_request_id }, creator, "request-confirm-u2");
  assert.deepEqual(joined.member_ids, ["u1", "u2"]);
  await assert.rejects(service.execute("join.confirm", { join_request_id: req3.join_request_id }, creator, "request-confirm-u3"), { code: "INVALID_STATE" });
});

test("expired and revoked invitation codes cannot create join requests", async () => {
  const code = "ABCDEFGH23";
  const baseUsers = [user("u1"), user("u2", null)]; baseUsers[0].couple_id = "cp_1";
  for (const invitation of [
    { expires_at: NOW - 1, revoked_at: null },
    { expires_at: NOW + 10000, revoked_at: NOW - 1 },
  ]) {
    const store = new MemoryStore({ users: baseUsers, couples: [couple("waiting", ["u1"])], invitations: [{ _id: "inv_bad", couple_id: "cp_1", token_hash: sha256(code), created_by: "u1", consumed_at: null, created_at: NOW, updated_at: NOW, ...invitation }] });
    const service = new DomainService(store, () => NOW);
    await assert.rejects(service.execute("join.request", { code }, user("u2", null), `request-invalid-${invitation.expires_at}`), { code: "INVITE_INVALID" });
    assert.equal(store.snapshot().join_requests?.length || 0, 0);
  }
});

test("wish conversion to a task is deduplicated by source", async () => {
  const store = activeStore({ wishes: [{ _id: "wish_1", couple_id: "cp_1", title: "看樱花", description: "", category: "go", status: "pending", target_date: null, creator_id: "u1", version: 1, deleted_at: null, created_at: NOW, updated_at: NOW }] });
  const service = new DomainService(store, () => NOW);
  const a = await service.execute("task.create", { title: "看樱花", source_wish_id: "wish_1" }, user("u1"), "request-wish-task-1");
  const b = await service.execute("task.create", { title: "看樱花", source_wish_id: "wish_1" }, user("u1"), "request-wish-task-2");
  assert.equal(a._id, b._id);
  assert.equal(store.snapshot().tasks.length, 1);
});

test("an applicant cannot approve their own request", async () => {
  const store = activeStore({ approvals: [{ _id: "approval_self", couple_id: "cp_1", template_key: "other", title: "申请", content: "", applicant_id: "u1", approver_id: "u2", reply_deadline: null, status: "pending", version: 1, created_at: NOW, updated_at: NOW }] });
  const service = new DomainService(store, () => NOW);
  await assert.rejects(service.execute("approval.decide", { approval_id: "approval_self", decision: "approved", expected_version: 1 }, user("u1"), "request-self-approval"), { code: "FORBIDDEN" });
});

test("cross-day all-day events are returned for every covered date", async () => {
  const store = activeStore({ events: [{ _id: "event_trip", couple_id: "cp_1", title: "旅行", description: "", type: "date", all_day: true, date_start: "2026-09-15", date_end: "2026-09-17", start_at: null, end_at: null, creator_id: "u1", version: 1, deleted_at: null, created_at: NOW, updated_at: NOW }] });
  const service = new DomainService(store, () => NOW);
  const page = await service.execute("event.list", { from_date: "2026-09-16", to_date: "2026-09-16" }, user("u1"), "read-event-page");
  assert.equal(page.items.length, 1);
});

test("memory transactions roll back all mutations when a callback fails", async () => {
  const store = activeStore();
  await assert.rejects(store.runTransaction(async (transaction) => { await transaction.update("couples", "cp_1", { name: "不应保存" }); throw new Error("simulated transaction failure"); }));
  assert.equal((await store.get("couples", "cp_1")).name, "两人事务所");
});

test("export is paginated and removes sensitive fields", async () => {
  const tasks = Array.from({ length: 55 }, (_, index) => ({ _id: `task_${index}`, couple_id: "cp_1", title: `T${index}`, creator_id: "u1", openid: "secret", _openid: "secret", token_hash: "secret", status: "todo", version: 1, created_at: NOW + index }));
  const service = new DomainService(activeStore({ tasks }), () => NOW);
  const first = await service.execute("data.export", { collection: "tasks", page_size: 50 }, user("u1"), "read-export-1");
  assert.equal(first.items.length, 50); assert.equal(first.next_cursor, "50");
  assert.equal("openid" in first.items[0], false); assert.equal("token_hash" in first.items[0], false);
  const second = await service.execute("data.export", { collection: "tasks", page_size: 50, cursor: first.next_cursor }, user("u1"), "read-export-2");
  assert.equal(second.items.length, 5); assert.equal(second.next_cursor, null);
});

test("account deletion archives the space and de-identifies shared records", async () => {
  const store = activeStore({ tasks: [{ _id: "task_1", couple_id: "cp_1", title: "共同任务", creator_id: "u1", assignee_id: "u2", status: "done", completed_by: "u1", version: 1, deleted_at: null, created_at: NOW, updated_at: NOW }] });
  const service = new DomainService(store, () => NOW);
  await service.execute("account.delete", {}, user("u1"), "request-delete-account");
  const snapshot = store.snapshot();
  assert.equal(snapshot.users.some((item) => item.user_id === "u1"), false);
  assert.equal(snapshot.couples[0].status, "archived");
  assert.match(snapshot.tasks[0].creator_id, /^deleted_/);
  assert.match(snapshot.tasks[0].completed_by, /^deleted_/);
  const remaining = snapshot.users.find((item) => item.user_id === "u2");
  assert.equal(remaining.couple_id, null);
  assert.equal(remaining.archived_couple_ids[0].couple_id, "cp_1");
});
