# 干快快（微信小程序）

建筑渗漏 / 堵漏业务的极简获客MVP。

## 第一阶段目标
- 扫码进小程序并自动识别 sourceId
- 手机号必填提交线索
- 每条订单绑定 sourceId
- 门店仅看自己订单且手机号脱敏
- 管理员看全量订单和来源统计

## 目录
- `docs/mvp-phase1.md`：MVP需求与方案
- `docs/api-actions.md`：云函数 action 列表
- `miniprogram/`：小程序端代码
- `cloudfunctions/api`：核心业务API
- `cloudfunctions/gen-qrcode`：固定二维码生成
- `scripts/seed.js`：演示数据初始化

## 部署前必改
1. 修改 `miniprogram/app.js` 的 `DEFAULT_ENV_ID` 为你的云开发环境ID。
2. 修改 `miniprogram/project.config.json` 的 `appid` 为你的小程序 AppID。

## 快速部署步骤（开发版）
1. 在微信开发者工具导入 `miniprogram/` 目录。
2. 在云开发面板开通环境并确认环境ID。
3. 上传并部署 `cloudfunctions/api` 与 `cloudfunctions/gen-qrcode`。
4. 初始化集合：`users`, `sources`, `orders`。
5. 可选：运行 `scripts/seed.js` 写入演示 `source` 和账号。
6. 给门店账号在 `users` 集合写入 `role=STORE` 与对应 `sourceId`；管理员写 `role=ADMIN`。

## 提审前检查
- 提交页：手机号必填、sourceId 必填校验通过
- 门店页：只能看到本人 sourceId 订单，手机号为脱敏形式
- 管理页：可见全量订单、来源统计、可改状态


## 本地校验
- 运行 `node tests/helpers.test.js` 校验手机号/状态/脱敏等基础规则。


## 开发校验命令
- `npm run test`：运行基础单测（helpers/status）。
- `npm run check`：运行关键脚本语法检查。


## 上线合规清单（微信小程序）
- 配置并公示《用户服务协议》《隐私政策》页面。
- 提交线索前增加协议勾选同意。
- 后台补充客服电话、公司主体、投诉通道等审核信息。
- 在微信公众平台完成类目、隐私接口用途说明与审核资料。

- 小程序 `app.js` 已接入 `onNeedPrivacyAuthorization`，触发隐私授权时可拉起隐私协议。

- `npm run release:check`：检查环境ID/AppID等上线前关键占位符。
- 详细清单见 `docs/release-checklist.md`。


## 订单状态枚举
`NEW`, `FOLLOWING`, `APPOINTED`, `IN_PROGRESS`, `DONE`, `COMPLETED`, `CLOSED`

- `npm run release:apply`：配合环境变量一次性写入 `envId/appid/servicePhone`。
- 示例：`WX_ENV_ID=xxx WX_APP_ID=wxxxxx SERVICE_PHONE=138xxxx node scripts/apply-release-config.js`。
