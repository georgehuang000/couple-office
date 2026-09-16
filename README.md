# 两人事务所 V1

一个只服务两名固定用户的微信小程序。当前版本为 `1.0.0-beta.1`，采用原生 WXML/WXSS/TypeScript + CloudBase 事件云函数，实现了：

- 可信微信身份映射、预设头像和两人空间；
- 10 位邀请码、加入申请、发起人确认/拒绝与 24 小时过期；
- 待办、审批、站内消息、月日历、跨日日程、纪念日和心愿；
- 请求幂等、乐观版本、权限/状态机校验和服务端事务；
- 分页脱敏 JSON 导出、30 天解绑归档窗口、账号删除和共同数据去标识化；
- 审核员可使用的独立只读演示模式，不接触真实双人数据。

## 快速检查

需要 Node.js 20.19+（未修改 Conda base，也不需要 Python 环境）：

```powershell
npm ci
npm run predeploy:check
npm run wechat:compile
```

`npm run wechat:compile` 使用本机代码上传密钥做微信真实编译，编译产物写入已忽略的 `.build/`。

## 云环境

云端操作都必须显式给出环境 ID：

```powershell
npm run cloud:init -- --env <dev-env-id>
npm run cloud:deploy -- --env <dev-env-id>
npm run cloud:backup -- --env <dev-env-id>
```

生产环境的初始化、部署、恢复和清理还需 `--production --confirm-production <env-id>`。恢复与清理另有独立确认参数，详见 [手工配置和交付](docs/manual-setup.md)。

## 代码结构

- `miniprogram/`：原生小程序、只读演示数据与压缩运行时素材。
- `server/api/src/`：可注入存储层的领域服务和单一 API 云函数。
- `server/jobs/src/`：审批过期、幂等记录和 30 天归档数据清理。
- `cloudbase/`、`security/`：集合/索引清单和默认拒绝数据库直连的鉴权策略。
- `scripts/`：打包、微信编译、云环境管理、包体积检查和视觉截图。
- `docs/`：实施记录、手工检查点、API 契约、A01–A20 验收和设计 QA。

AppID 已写入 `project.config.json`。私钥、备份、导出文件、43MB 原始资产包与参考图均被 Git/小程序包排除。
