# A01–A20 验收记录

状态说明：`automated` 已由本地测试覆盖；`compiled` 已通过微信 CI 编译/演示模式截图；`pending-cloud`、`pending-device` 需账号持有人完成环境或真机检查。

| 编号 | 场景 | 当前状态 | 证据/待做 |
|---|---|---|---|
| A01 | 不同微信身份 | pending-cloud/device | 需两微信号白名单真机验证 |
| A02 | 未确认加入无业务数据 | automated + pending-cloud | `requestJoin` 不绑定用户；云端复验 |
| A03 | 并发加入不超过2人 | automated + pending-cloud | 单元测试覆盖胜者/失败者；云事务复验 |
| A04 | 过期/撤销/重复邀请 | automated | 过期、撤销测试；消费后二次确认失败 |
| A05 | 伪造身份/空间 | automated + pending-cloud | 身份只取云上下文；云端攻击用例待跑 |
| A06 | 前端直读写集合 | pending-cloud | 应用 `admin-only.rego` 后从调试台验证拒绝 |
| A07 | 重复创建任务 | automated | 同 `request_id` 只有1条，换 payload 报冲突 |
| A08 | 双人并发编辑 | automated + pending-cloud | 乐观版本冲突测试；双真机待验 |
| A09 | 任务完成/重开 | automated | 负责人权限、版本、完成者/时间由服务端写入 |
| A10 | 申请人自行批准 | automated | 显式 `FORBIDDEN` 测试 |
| A11 | 撤回与批准竞争 | automated + pending-cloud | 批准后旧版本撤回报冲突；云事务待验 |
| A12 | 已决定审批不可篡改 | automated | 状态机不提供已决定编辑动作 |
| A13 | 订阅拒绝/失败不影响业务 | automated | 订阅开关关闭，业务事务同步生成站内消息 |
| A14 | 定时任务重复 | code-reviewed + pending-cloud | 通知用确定文档 ID 幂等 set；触发器重放待验 |
| A15 | 全天/跨日/闰年 | automated + compiled | 跨日查询、2月29日和月视图均有覆盖 |
| A16 | 解绑后重新配对 | automated + pending-cloud | 旧空间只在旧成员30天导出引用中；云端待验 |
| A17 | 越权消息/导出 | automated + pending-cloud | 收件人和空间服务端限定；云端待验 |
| A18 | 删除与恢复备份 | pending-cloud | 需开发环境做备份→删除→时点恢复演练 |
| A19 | 断网/超时/异常 | code-reviewed + pending-device | 前端不假成功，原请求号可重试；真机断网待验 |
| A20 | iOS/Android 体验包 | pending-device | 两台真机、两微信号完整闭环后才能通过 |

**发布门槛：** A05/A06/A16/A17 任意失败，不得放入真实私人数据。任何 `pending-cloud`/`pending-device` 不能被本地内存测试替代。
