"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/jobs/src/index.ts
var index_exports = {};
__export(index_exports, {
  main: () => main
});
module.exports = __toCommonJS(index_exports);
var cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
async function removeWhere(database, collection, where) {
  let removed = 0;
  while (true) {
    const batch = await database.collection(collection).where(where).limit(100).get();
    if (!batch.data?.length) return removed;
    for (const record of batch.data) {
      await database.collection(collection).doc(record._id).remove();
      removed += 1;
    }
  }
}
async function main() {
  const database = cloud.database();
  const command = database.command;
  const now = Date.now();
  const summary = { expired_approvals: 0, removed_dedup: 0, purged_couples: 0 };
  const approvals = await database.collection("approvals").where({ status: "pending", reply_deadline: command.lte(now) }).limit(100).get();
  for (const approval of approvals.data || []) {
    await database.collection("approvals").doc(approval._id).update({ data: { status: "expired", version: Number(approval.version || 0) + 1, updated_at: now } });
    if (approval.applicant_id) {
      const notificationId = `expire_${String(approval._id).replace(/[^a-zA-Z0-9_-]/g, "_")}_${String(approval.applicant_id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      await database.collection("notifications").doc(notificationId).set({ data: { couple_id: approval.couple_id, receiver_id: approval.applicant_id, event_key: `approval_expired:${approval._id}:${approval.applicant_id}`, type: "approval_expired", resource_type: "approval", resource_id: approval._id, preview: "\u7533\u8BF7\u5DF2\u8FC7\u56DE\u590D\u671F\u9650", read_at: null, created_at: now } });
    }
    summary.expired_approvals += 1;
  }
  summary.removed_dedup = await removeWhere(database, "request_dedup", { expires_at: command.lte(now) });
  const couples = await database.collection("couples").where({ status: "archived", purge_at: command.lte(now) }).limit(20).get();
  for (const couple of couples.data || []) {
    for (const collection of ["tasks", "approvals", "events", "anniversaries", "wishes", "notifications", "audit_logs", "invitations", "join_requests"]) {
      await removeWhere(database, collection, { couple_id: couple._id });
    }
    await database.collection("couples").doc(couple._id).remove();
    summary.purged_couples += 1;
  }
  return { ok: true, server_time: now, ...summary };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
