# 实施记录

## 2026-09-15：P0 与最小 P1

- 范围：依据 `couple_oa_plan_v1.md` 第 18.2 节，仅建立原生 TypeScript 工程、可信身份最小云函数、统一调用与基础检查；未提前实现 P2 绑定或任何业务模块。
- 关键决策：使用 `wx.cloud.callFunction` 调用单一 `api` 云函数；云端通过 `getWXContext().OPENID` 识别调用者，前端不上传或信任 OpenID/userId/coupleId。
- 安全边界：没有 `COUPLE_OA_ALLOWED_OPENIDS` 时拒绝请求，避免“第一个访问者就是管理员”。用户文档以服务端 OpenID 为 `_id` 保存，但仅返回由 SHA-256 派生的业务 `userId`；客户端没有直接集合读写路径。
- 难点：白名单需要 OpenID、OpenID 又只能由可信云端上下文获取。为此实现仅由云端临时令牌打开的初始化入口；它不会返回 OpenID，账号持有人须在控制台登记两条记录后立刻删除令牌。Node 环境不能模拟微信上下文或 CloudBase 变量，因此用可注入的身份核心做单元测试；真实云部署、环境关联、双真机验证仍须账号持有人执行。
- 依赖取舍：没有引入第三方 UI、登录、数据库或服务端框架，避免与方案要求的原生 CloudBase 调用链冲突。现有 Conda 环境均为 Python 环境，本项目仅需 Node/TypeScript，未修改 Conda base 环境。
