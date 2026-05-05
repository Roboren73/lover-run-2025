# 干快快 - 第一阶段MVP方案

## 1. 项目目标
- 让用户通过**合作门店/推荐人二维码**进入小程序并自动绑定来源（sourceId）。
- 让用户以**手机号唯一必填**快速提交渗漏/堵漏需求。
- 让每条订单与来源强绑定，形成可追踪获客闭环。
- 门店仅查看自己来源订单且手机号脱敏，管理员查看全量和统计。

## 2. MVP范围
### 必做
- 二维码来源追踪：扫码参数 scene/sourceId。
- 线索提交：手机号必填；姓名、地址、描述、图片可选。
- 订单管理：创建订单、状态流转、来源归属。
- 门店端列表与详情（权限隔离 + 手机号脱敏）。
- 管理端订单全量 + 来源统计。

### 明确不做
- 分佣结算、支付担保、AI诊断报价、复杂施工管理、多城市复杂体系。

## 3. 页面清单
### 用户端
1. `pages/lead-form` 线索提交页（默认首页）
2. `pages/success` 提交成功页

### 门店端
3. `pages/store-orders` 门店订单列表
4. `pages/store-order-detail` 门店订单详情（脱敏手机号）

### 管理端
5. `pages/admin-dashboard` 来源统计看板
6. `pages/admin-orders` 管理员订单列表
7. `pages/admin-order-detail` 管理员订单详情（完整手机号）

## 4. 角色与权限
- `CUSTOMER`：可提交线索。
- `STORE`：仅看自己 sourceId 对应订单，手机号脱敏。
- `ADMIN`：看全量订单、完整信息、统计。

## 5. 数据表设计
### `sources`
- `id` (string, PK)
- `type` (STORE | REFERRER)
- `name` (string)
- `ownerUserId` (string)
- `status` (ACTIVE | DISABLED)
- `createdAt` (date)

### `orders`
- `id` (string, PK)
- `sourceId` (string, 必填, index)
- `phone` (string, 必填)
- `name` (string, 可空)
- `address` (string, 可空)
- `description` (string, 可空)
- `images` (string[], 可空)
- `status` (NEW | FOLLOWING | APPOINTED | CLOSED)
- `createdAt`/`updatedAt` (date)

### `users`
- `id` (string, openid)
- `role` (CUSTOMER | STORE | ADMIN)
- `sourceId` (string, 对 STORE 必填)
- `displayName` (string)

## 6. API设计
- `POST /lead/submit`
  - 入参：`sourceId, phone, name?, address?, description?, images?`
  - 校验：手机号必填、sourceId必填
- `GET /store/orders`
  - 鉴权：STORE
  - 返回：当前门店 sourceId 的订单列表（phoneMasked）
- `GET /store/orders/:id`
  - 鉴权：STORE
  - 校验订单归属 sourceId
- `PATCH /admin/orders/:id/status`
  - 鉴权：ADMIN
- `GET /admin/orders`
  - 鉴权：ADMIN
- `GET /admin/stats/sources`
  - 鉴权：ADMIN

## 7. 项目目录结构
- `miniprogram/` 小程序前端
- `cloudfunctions/api` 统一API云函数（HTTP路由风格）
- `cloudfunctions/gen-qrcode` 生成门店固定码
- `docs/` 方案文档与接口文档

## 8. 开发顺序
1. 数据模型与权限模型落地
2. 提交线索闭环（扫码->表单->入库）
3. 门店订单查看（隔离+脱敏）
4. 管理端订单与统计
5. 固定二维码生成工具
6. 联调与测试清单

## 9. 主要风险点
- 来源参数丢失：必须在 `App.onLaunch/onShow` 统一解析并缓存。
- 权限越权：后端按 openid + role 二次校验，前端只做展示控制。
- 脱敏泄漏：门店接口层返回 `phoneMasked`，不下发完整手机号。
- 二维码数量增长：source 独立表 + 固定 scene 规则（`s_<sourceId>`）可扩展。
