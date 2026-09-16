# 手工配置与交付

## 1. 创建开发云环境

1. 在微信开发者工具中扫码重新登录（当前云访问 token 已过期）。
2. 为 AppID `wx3efc253d50e263b6` 创建一个只放测试数据的 CloudBase 开发环境，记录精确环境 ID。
3. 将环境 ID 写入 `miniprogram/config/env.ts` 的 `CLOUDBASE_ENV_ID`。环境 ID 不是密钥，但不要把开发/生产的实际切换修改合并回通用分支。
4. 确认套餐、费用、到期时间、超额开关和告警。首次开发环境不放真实私人数据。

## 2. 初始化集合、索引和权限

CloudBase CLI 需先登录：

```powershell
npx tcb login
npm run cloud:init -- --env <dev-env-id>
```

`cloud:init` 会根据 `cloudbase/indexes.json` 创建集合/索引，并应用 `security/admin-only.rego`：终端可调用云函数，但不允许客户端直读/直写文档数据库。该策略会取代旧网关鉴权，执行后必须在控制台回读确认。

## 3. 部署云函数

```powershell
npm run cloud:deploy -- --env <dev-env-id>
```

这会先构建 TypeScript，再部署 Node.js 20.19 的 `api` 和每天 03:10 运行的 `scheduleJobs`。在控制台检查两个函数的运行时、依赖安装、时区和定时触发器。

## 4. 登记两个测试微信身份

1. 在 `api` 云函数临时设置随机且不少于 24 位的 `COUPLE_OA_BOOTSTRAP_TOKEN`。
2. 两个微信账号分别在引导页展开“开发身份初始化”，输入令牌。
3. 在 `identities` 集合读取两条记录的 `openid` 字段，逗号分隔写入 `COUPLE_OA_ALLOWED_OPENIDS`。
4. 删除 `COUPLE_OA_BOOTSTRAP_TOKEN`，重新部署 `api`。再次验证未在白名单的账号只能看只读演示，不会创建业务用户。

## 5. 备份、恢复和清理

```powershell
npm run cloud:backup -- --env <env-id>
npm run cloud:restore -- --env <env-id> --time "2026-09-16 10:00:00" --tables '<CloudBase恢复表JSON>' --confirm-restore <env-id>
npm run cloud:cleanup -- --env <dev-env-id> --confirm-cleanup <dev-env-id>
```

备份使用 CloudBase CLI 3.8.2 的 `db nosql dump`，下载到已忽略的 `backups/`。恢复使用官方时点恢复；先执行 `npx tcb db nosql backup time -e <env-id>` 查询可用时间，再执行 `npx tcb db nosql backup collection --time "..." -e <env-id>` 预览可恢复表，最后将精确 JSON 映射传给脚本。

生产环境的初始化/部署/恢复/清理必须额外携带：

```text
--production --confirm-production <exact-prod-env-id>
```

清理会删除声明集合里的全部文档，保留集合与索引；只用于明确的测试环境重置。

## 6. 上传体验版

1. 完成 `docs/acceptance.md` 中所有开发云环境与双真机项。
2. 在微信后台将当前出口 IP 加入代码上传白名单。
3. 运行：

```powershell
npm run predeploy:check
npm run wechat:compile
npm run upload:experience
```

上传脚本固定使用版本 `1.0.0-beta.1`、AppID `wx3efc253d50e263b6` 和本机 `private.wx3efc253d50e263b6.key`。它只上传体验版，不提审、不发布、不开通付费套餐。
