# API 契约

所有请求通过 `wx.cloud.callFunction({ name: "api" })` 发送：

```json
{ "action": "task.create", "request_id": "req_...", "payload": {} }
```

成功和失败响应分别为：

```json
{ "ok": true, "data": {}, "request_id": "req_...", "server_time": 0 }
{ "ok": false, "error": { "code": "VERSION_CONFLICT", "message": "...", "retryable": false }, "request_id": "req_...", "server_time": 0 }
```

写操作必须重用原请求的 `request_id`进行重试；同一请求号不得搭配不同 payload。更新/状态迁移必须携带 `expected_version`。客户端不发送 OpenID，也不能指定当前空间或消息收件人。

已实现动作：

`auth.get/bootstrap`、`user.updateProfile`、`couple.create/get/update/archive`、`invite.create/revoke`、`join.request/confirm/reject`、`dashboard.get`、`task.list/get/create/update/transition/delete`、`approval.list/get/submit/decide/cancel`、`event.list/get/create/update/delete`、`anniversary.list/create/update/delete`、`wish.list/get/create/update/complete/delete`、`notification.list/markRead`、`data.export`、`account.delete`。

`identity.get` 和 `identity.bootstrap` 保留为兼容别名。业务对象全部使用 `snake_case`，类型定义位于 `shared/contracts.ts`。

常用错误码：`VALIDATION_ERROR`、`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`INVALID_STATE`、`VERSION_CONFLICT`、`ALREADY_BOUND`、`COUPLE_FULL`、`INVITE_INVALID`、`RATE_LIMITED`、`IDENTITY_NOT_ALLOWED`、`IDENTITY_ALLOWLIST_UNCONFIGURED`、`INTERNAL_ERROR`。
