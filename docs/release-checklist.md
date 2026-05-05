# 上线前检查清单（Phase-1）

## 配置
- [ ] `miniprogram/app.js` 中 `DEFAULT_ENV_ID` 已替换为正式云环境ID。
- [ ] `miniprogram/project.config.json` 中 `appid` 已替换为正式小程序 AppID。
- [ ] `miniprogram/config.js` 中 `servicePhone` 已替换为正式客服电话。

## 云函数
- [ ] 已部署 `cloudfunctions/api`。
- [ ] 已部署 `cloudfunctions/gen-qrcode`。
- [ ] 云函数依赖安装完成且版本一致。

## 数据
- [ ] `users` 集合已配置 ADMIN/STORE 账号。
- [ ] `sources` 集合已配置门店来源。
- [ ] 使用 `admin-sources` 页面可创建来源并生成固定二维码。

## 合规
- [ ] 用户协议页可访问。
- [ ] 隐私政策页可访问。
- [ ] 提交页未勾选协议时无法提交。
- [ ] 微信平台已配置类目、隐私说明、主体材料。

## 质量
- [ ] 执行 `npm run test` 通过。
- [ ] 执行 `npm run check` 通过。
- [ ] 执行 `npm run release:check` 通过。
