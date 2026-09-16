# 两人事务所（couple-oa）

当前仓库实现方案中的 **P0 能力验证** 与 **最小 P1 工程骨架**：原生 TypeScript 小程序、四个导航壳、统一云函数调用封装，以及服务端从微信可信上下文识别调用者。

尚未实现双人绑定、待办、审批、日历、愿望、通知、导出或任何真实业务数据读写。

## 本地检查

需要 Node.js 20+ 与 TypeScript 编译器（本机或 `npx tsc`）：

```powershell
npm run typecheck
npm test
npm run predeploy:check
```

## 导入微信开发者工具

1. 导入此仓库根目录；在项目详情填入自己的小程序 AppID。
2. 在 `miniprogram/config/env.ts` 填写已关联的 CloudBase 环境 ID；该文件不能提交真实凭据（环境 ID 可提交，但建议按环境维护）。
3. 在云开发控制台创建并部署 `cloudfunctions/api`，并安装其中的依赖。
4. 为云函数配置环境变量 `COUPLE_OA_ALLOWED_OPENIDS`，值为逗号分隔的开发白名单 OpenID。未配置时，客户端会明确显示“环境尚未完成配置”，不会把首个访问者当管理员。
5. 使用两台不同微信账号真机分别调用“验证当前身份”；两次返回的 `userId` 应不同，且均不得暴露 OpenID。

详见 [手工配置与真机验证](docs/manual-setup.md)。

