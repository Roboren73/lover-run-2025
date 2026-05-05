# 云函数 API Actions（phase-1）

## 公开提交
- `auth.me`
- `lead.submit`
  - required: `sourceId`, `phone`
  - optional: `name`, `address`, `description`, `images[]`
  - sanitize: `name(30)`, `address(120)`, `description(500)`, `images<=9`

## 门店
- `store.orders`
  - 仅 STORE，自动按账号 sourceId 过滤
  - 返回脱敏手机号 `phoneMasked`
- `store.order.detail`
  - 仅 STORE，且必须是本人 sourceId 的订单

## 管理端
- `admin.dashboard`
- `admin.orders`
- `admin.order.detail`
- `admin.order.updateStatus` (`NEW|FOLLOWING|APPOINTED|IN_PROGRESS|DONE|COMPLETED|CLOSED`)
- `admin.stats.sources`
- `admin.logs.summary`
- `admin.sources.create`


## 运维日志
- 关键行为会写入 `operation_logs`：`lead_submit`、`admin_update_status`、`admin_create_source`。
