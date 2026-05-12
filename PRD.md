# 干快快 - 建筑渗漏堵漏获客小程序 完整开发文档

> 本文档包含产品需求（PRD）和技术设计（TDD）的全部内容。
> 任何开发者或 AI 工具拿到本文档，应能从零完整实现本项目。

---

## 一、项目概述

### 1.1 项目名称
**干快快** —— 建筑渗漏堵漏获客微信小程序

### 1.2 一句话定位
通过门店/推荐人独立二维码引流，用户扫码提交维修需求，形成「获客 → 订单 → 跟进」的极简业务闭环。

### 1.3 核心业务流程
```
门店拿到独立二维码 → 用户扫码进入小程序（自动带上来源 sourceId）
→ 用户提交报修需求（手机号必填）→ 订单入库并绑定 sourceId
→ 管理员在后台看到新订单 → 联系用户 → 上门勘察 → 报价 → 施工 → 完成
→ 门店可查看自己带来的订单进度（手机号脱敏）
```

### 1.4 技术选型
| 项 | 选择 | 理由 |
|---|------|------|
| 前端 | 微信原生小程序（WXML + WXSS + JS） | 无框架依赖，开发者工具直接运行 |
| 后端 | 微信云开发（云函数 + 云数据库 + 云存储） | 零运维、免服务器、与微信深度集成 |
| 数据库 | 云数据库（NoSQL / MongoDB 风格） | 云开发内置，无需额外部署 |
| 文件存储 | 云存储 | 用于用户上传的漏水现场照片 |

### 1.5 不做的功能（MVP 阶段明确排除）
- 自动分佣
- 担保支付 / 在线支付
- AI 诊断 / AI 自动报价
- 复杂施工交付管理
- 多城市运营体系
- 用户注册/登录体系（直接用微信 openId 静默识别）

---

## 二、角色与权限

| 角色 | 进入方式 | 权限 |
|------|---------|------|
| **用户（User）** | 扫码或直接打开小程序 | 提交报修订单；查看自己提交的订单和进度 |
| **门店（Store）** | 打开小程序 → 门店入口 → 输入门店编号+验证码登录 | 只能查看自己 sourceId 带来的订单；看到的手机号是脱敏的（138****1234）；查看订单进度；不能修改订单状态 |
| **管理员（Admin）** | 打开小程序 → 管理入口 → 输入管理密码登录 | 查看全部订单（完整手机号）；修改订单状态；管理来源（创建/启用/禁用门店）；查看来源统计 |

### 认证方式说明
- **用户**：无需注册登录。小程序启动时自动调用 `wx.cloud.callFunction` 获取微信 `openId`，静默完成身份识别。
- **门店**：管理员预先在后台创建门店，系统自动生成 6 位验证码。门店人员输入「门店编号 + 验证码」登录。登录状态保存在本地 Storage。
- **管理员**：在数据库 `admins` 集合中预置一条记录，包含 `password` 字段。管理员输入密码登录，系统将当前 openId 绑定到该管理员记录上，后续接口通过 openId 鉴权。

---

## 三、数据库设计

共 3 个数据库集合（Collection），均使用云数据库。

### 3.1 orders（订单表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 云数据库自动生成的主键 |
| `orderNo` | string | 是 | 订单编号，格式：`GKK` + 年月日时分秒 + 4位随机数，例：`GKK202605121430001234` |
| `sourceId` | string | 是 | 来源标识，空字符串表示自然流量 |
| `openId` | string | 是 | 提交用户的微信 openId |
| `phone` | string | 是 | 手机号，11位，正则校验 `/^1[3-9]\d{9}$/` |
| `name` | string | 否 | 姓名，默认空字符串 |
| `address` | string | 否 | 维修地址，默认空字符串 |
| `description` | string | 否 | 问题描述，默认空字符串 |
| `images` | array\<string\> | 否 | 云存储文件 ID 数组，最多 6 张，默认空数组 |
| `status` | string | 是 | 订单状态，见下方状态枚举 |
| `remark` | string | 否 | 管理员备注，默认空字符串 |
| `createdAt` | number | 是 | 创建时间戳（毫秒），`Date.now()` |
| `updatedAt` | number | 是 | 更新时间戳（毫秒） |

#### 订单状态枚举
| 状态值 | 中文 | 颜色建议 |
|--------|------|---------|
| `pending` | 待处理 | 黄色 #faad14 |
| `contacted` | 已联系 | 蓝色 #1890ff |
| `inspecting` | 上门勘察 | 紫色 #722ed1 |
| `quoting` | 报价中 | 青色 #13c2c2 |
| `constructing` | 施工中 | 绿色 #52c41a |
| `completed` | 已完成 | 绿色 #52c41a |
| `cancelled` | 已取消 | 灰色 #999999 |

### 3.2 sources（来源/门店表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 主键 |
| `sourceId` | string | 是 | 唯一来源标识，用于二维码参数，如 `STORE001` |
| `name` | string | 是 | 门店或推荐人名称 |
| `contactPhone` | string | 否 | 联系电话 |
| `authCode` | string | 是 | 门店登录验证码，6 位数字，创建时自动生成 |
| `type` | string | 是 | `store`（门店）或 `referrer`（推荐人） |
| `status` | string | 是 | `active`（启用）或 `disabled`（禁用） |
| `createdAt` | number | 是 | 创建时间戳 |

### 3.3 admins（管理员表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 主键 |
| `openId` | string | 否 | 管理员微信 openId，首次登录后自动写入 |
| `name` | string | 否 | 管理员名称 |
| `password` | string | 是 | 登录密码 |
| `lastLoginAt` | number | 否 | 最近登录时间戳 |
| `createdAt` | number | 否 | 创建时间戳 |

> **初始化**：项目首次使用前，需在云数据库 `admins` 集合中手动添加一条记录：
> ```json
> { "password": "你设定的管理密码", "name": "超级管理员" }
> ```

---

## 四、API 设计（云函数）

共 3 个云函数，每个函数通过 `action` 字段路由到不同操作。

### 4.1 云函数：`login`

负责获取用户 openId 和管理员密码验证。

#### 操作 1：获取 openId（默认）
- **触发**：不传 `action` 或 `action` 为空
- **入参**：无
- **出参**：`{ code: 0, openId: "用户的openId" }`
- **逻辑**：通过 `cloud.getWXContext()` 获取 `OPENID` 直接返回

#### 操作 2：管理员验证 (`action: 'verifyAdmin'`)
- **入参**：`{ action: 'verifyAdmin', password: '管理密码' }`
- **出参（成功）**：`{ code: 0, message: '登录成功' }`
- **出参（失败）**：`{ code: -1, message: '密码错误' }`
- **逻辑**：
  1. 用 `password` 查询 `admins` 集合
  2. 找不到 → 返回密码错误
  3. 找到 → 将当前 `OPENID` 写入该管理员记录的 `openId` 字段（后续所有管理接口通过 openId 鉴权）
  4. 返回成功

---

### 4.2 云函数：`order`

负责订单的全部 CRUD 操作。

#### 操作 1：提交订单 (`action: 'submit'`)
- **入参**：
  ```json
  {
    "action": "submit",
    "phone": "13800138000",     // 必填，11位手机号
    "name": "张三",              // 选填
    "address": "xx路xx号",       // 选填
    "description": "卫生间天花板渗水", // 选填
    "images": ["cloud://xxx"],   // 选填，云存储文件ID数组
    "sourceId": "STORE001"       // 选填，来源标识
  }
  ```
- **出参（成功）**：`{ code: 0, message: '提交成功', data: { _id: "xxx", orderNo: "GKK..." } }`
- **逻辑**：
  1. 校验手机号格式（`/^1[3-9]\d{9}$/`），不合法返回错误
  2. 生成订单号：`GKK` + `yyyyMMddHHmmss` + 4位随机数
  3. 写入 `orders` 集合，`status` 初始为 `pending`，`openId` 从 `cloud.getWXContext()` 获取
  4. 返回 `_id` 和 `orderNo`

#### 操作 2：获取订单列表 (`action: 'list'`)
- **入参**：
  ```json
  {
    "action": "list",
    "role": "user|store|admin",  // 角色
    "sourceId": "STORE001",      // 门店角色必填
    "status": "pending",         // 选填，按状态筛选
    "page": 1,                   // 页码，默认1
    "pageSize": 20               // 每页条数，默认20
  }
  ```
- **出参（成功）**：`{ code: 0, data: { list: [...], total: 100, page: 1, pageSize: 20 } }`
- **逻辑**：
  1. **role='user'**：只查 `openId` 等于当前用户的订单
  2. **role='store'**：只查 `sourceId` 匹配的订单，**返回前对手机号脱敏**（`138****0000`）
  3. **role='admin'**：先验证 openId 在 admins 集合中存在，然后查全部订单（手机号不脱敏）
  4. 按 `createdAt` 倒序，分页返回
  5. 同时返回总数 `total`

#### 操作 3：获取订单详情 (`action: 'detail'`)
- **入参**：
  ```json
  {
    "action": "detail",
    "orderId": "订单_id",
    "role": "user|store|admin",
    "sourceId": "STORE001"       // 门店角色需传
  }
  ```
- **出参（成功）**：`{ code: 0, data: { ...订单完整字段 } }`
- **逻辑**：
  1. 根据 `orderId` 查询单条订单
  2. **role='user'**：校验 `order.openId === 当前openId`，不匹配返回无权限
  3. **role='store'**：校验 `order.sourceId === 传入的sourceId`，不匹配返回无权限；手机号脱敏后返回
  4. **role='admin'**：校验管理员身份；返回完整信息（含完整手机号）

#### 操作 4：更新订单状态 (`action: 'updateStatus'`)
- **入参**：
  ```json
  {
    "action": "updateStatus",
    "orderId": "订单_id",
    "status": "contacted",       // 新状态，必须在状态枚举内
    "remark": "已电话联系客户"    // 选填，管理员备注
  }
  ```
- **出参（成功）**：`{ code: 0, message: '更新成功' }`
- **逻辑**：
  1. 校验当前 openId 是否在 `admins` 集合中，不是则返回无权限
  2. 校验 `status` 是否在合法枚举内
  3. 更新 `orders` 集合对应记录的 `status`、`updatedAt`，如有 `remark` 也更新

---

### 4.3 云函数：`source`

负责来源/门店的管理和统计。

#### 操作 1：获取来源列表 (`action: 'list'`)
- **权限**：仅管理员
- **入参**：`{ action: 'list' }`
- **出参**：`{ code: 0, data: [ ...来源记录数组 ] }`
- **逻辑**：校验管理员身份 → 查询 `sources` 集合全部记录，按 `createdAt` 倒序，最多返回 100 条

#### 操作 2：创建来源 (`action: 'create'`)
- **权限**：仅管理员
- **入参**：
  ```json
  {
    "action": "create",
    "sourceId": "STORE001",       // 必填，唯一标识
    "name": "朝阳区旗舰店",       // 必填
    "contactPhone": "13800138000", // 选填
    "type": "store"                // 选填，默认 store
  }
  ```
- **出参（成功）**：`{ code: 0, message: '创建成功', data: { _id: "xxx" } }`
- **逻辑**：
  1. 校验管理员身份
  2. 校验 `sourceId` 和 `name` 必填
  3. 校验 `sourceId` 唯一性（查 `sources` 集合）
  4. 自动生成 6 位数字 `authCode`（`100000 + random * 900000`）
  5. 写入 `sources` 集合，`status` 初始为 `active`

#### 操作 3：更新来源 (`action: 'update'`)
- **权限**：仅管理员
- **入参**：
  ```json
  {
    "action": "update",
    "sourceDocId": "来源记录的_id",
    "name": "新名称",             // 选填
    "contactPhone": "新电话",     // 选填
    "status": "disabled",         // 选填
    "authCode": "新验证码"        // 选填
  }
  ```
- **出参**：`{ code: 0, message: '更新成功' }`

#### 操作 4：门店验证登录 (`action: 'verify'`)
- **权限**：公开（任何人可调用）
- **入参**：`{ action: 'verify', sourceId: 'STORE001', authCode: '123456' }`
- **出参（成功）**：
  ```json
  {
    "code": 0,
    "message": "验证成功",
    "data": { "sourceId": "STORE001", "name": "朝阳区旗舰店", "type": "store" }
  }
  ```
- **出参（失败）**：`{ code: -1, message: "门店编号或验证码错误" }`
- **逻辑**：查询 `sources` 集合，同时匹配 `sourceId`、`authCode`、`status='active'`

#### 操作 5：来源统计 (`action: 'stats'`)
- **权限**：仅管理员
- **入参**：`{ action: 'stats' }`
- **出参**：
  ```json
  {
    "code": 0,
    "data": {
      "totalOrders": 150,
      "sourceStats": [
        { "sourceId": "STORE001", "name": "朝阳区旗舰店", "type": "store", "totalOrders": 80, "completedOrders": 30 },
        { "sourceId": "STORE002", "name": "海淀区分店", "type": "store", "totalOrders": 70, "completedOrders": 25 }
      ]
    }
  }
  ```
- **逻辑**：遍历所有来源，分别统计每个来源的总订单数和已完成订单数

---

## 五、页面设计（共 9 个页面）

### 5.0 全局配置

**app.json**：
```json
{
  "pages": [
    "pages/index/index",
    "pages/submit/submit",
    "pages/my-orders/my-orders",
    "pages/order-detail/order-detail",
    "pages/store-login/store-login",
    "pages/store-orders/store-orders",
    "pages/admin/admin",
    "pages/admin-orders/admin-orders",
    "pages/admin-sources/admin-sources"
  ],
  "window": {
    "navigationBarBackgroundColor": "#1890ff",
    "navigationBarTitleText": "干快快",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f5f5"
  },
  "style": "v2"
}
```

**app.js**：
- `onLaunch` 中调用 `wx.cloud.init({ traceUser: true })` 初始化云开发
- `globalData` 包含：`openId`（用户标识）、`sourceId`（来源标识）、`role`（当前角色：user/store/admin）、`storeInfo`（门店信息）

**主题色**：`#1890ff`（蓝色），全局背景色 `#f5f5f5`

---

### 5.1 首页（pages/index/index）

**导航栏标题**：干快快 - 专业渗漏维修

**功能**：
1. 从二维码 / 小程序码中解析 `sourceId` 参数，保存到本地 Storage
2. 静默登录获取 openId
3. 展示服务介绍和流程说明
4. 提供入口按钮

**sourceId 解析逻辑**：
- 普通二维码：`onLoad(options)` 中直接读 `options.sourceId`
- 小程序码：读 `options.scene`，URL 解码后解析 `s=STORE001` 格式
- 都没有：从本地 Storage 读取之前保存的 sourceId
- 保存：同时存到 `globalData.sourceId` 和 `wx.setStorageSync('sourceId', ...)`

**页面结构**：
```
┌────────────────────────┐
│   蓝色渐变 Banner      │
│   🔧                   │
│   干快快                │
│   专业建筑渗漏维修服务   │
│   漏水不用愁，干快快帮你修│
├────────────────────────┤
│ 白色卡片：我们的服务     │
│ 🏠 屋面防水  🚿 卫生间堵漏│
│ 🏗️ 外墙渗漏  🏢 地下室防水│
├────────────────────────┤
│ 白色卡片：服务流程       │
│ ① 提交需求 → ② 专人联系 │
│ → ③ 上门勘察 → ④ 施工修复│
├────────────────────────┤
│ 【 立即报修 】 大按钮    │
│     查看我的订单（链接）  │
├────────────────────────┤
│  门店入口 | 管理入口     │
└────────────────────────┘
```

**按钮跳转**：
- 「立即报修」→ `/pages/submit/submit`
- 「查看我的订单」→ `/pages/my-orders/my-orders`
- 「门店入口」→ `/pages/store-login/store-login`
- 「管理入口」→ `/pages/admin/admin`

---

### 5.2 提交需求页（pages/submit/submit）

**导航栏标题**：提交报修需求

**功能**：用户填写报修信息并提交

**表单字段**：
| 字段 | 组件 | 必填 | 校验 |
|------|------|------|------|
| 手机号 | `<input type="number" maxlength="11">` | 是（红色*号标记） | `/^1[3-9]\d{9}$/` |
| 姓名 | `<input type="text">` | 否（显示"选填"） | 无 |
| 地址 | `<input type="text">` | 否 | 无 |
| 问题描述 | `<textarea>` | 否 | 无 |
| 现场照片 | 图片上传区域 | 否 | 最多 6 张 |

**图片上传逻辑**：
1. 点击 "+" 调用 `wx.chooseMedia({ mediaType: ['image'], sourceType: ['album', 'camera'] })`
2. 选择的图片显示为预览缩略图（200rpx × 200rpx）
3. 每张图片右上角有 "×" 删除按钮
4. 点击图片可全屏预览 `wx.previewImage`
5. 提交时先将图片上传到云存储 `wx.cloud.uploadFile`，路径格式 `order-images/{时间戳}-{序号}.{扩展名}`
6. 上传完成后获取 `fileID` 数组，随表单一起提交

**提交逻辑**：
1. 校验手机号非空 + 格式正确
2. 显示 loading
3. 如有图片 → 并行上传到云存储，获取 fileID 数组
4. 从本地 Storage 读取 `sourceId`
5. 调用云函数 `order`（action: submit）
6. 成功 → 弹出提示「我们会尽快与您联系，请保持手机畅通」→ 返回上一页
7. 失败 → toast 错误信息
8. 提交中按钮置灰，防止重复提交

---

### 5.3 我的订单页（pages/my-orders/my-orders）

**导航栏标题**：我的订单
**启用下拉刷新**：是

**功能**：用户查看自己提交过的订单列表

**数据加载**：
- 调用 `order` 云函数（action: list, role: 'user'）
- 分页加载，每页 20 条
- 下拉刷新：重置 page=1，重新加载
- 上拉触底：加载下一页

**列表项展示**：
```
┌────────────────────────┐
│ GKK20260512...    [待处理]│ ← 订单号 + 状态标签（彩色）
│ 手机：13800138000       │
│ 地址：xx路（如有）        │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ 2026-05-12 14:30  详情 >│ ← 时间 + 跳转链接
└────────────────────────┘
```

**空状态**：显示「暂无订单记录」

**点击跳转**：`/pages/order-detail/order-detail?id={_id}&role=user`

---

### 5.4 订单详情页（pages/order-detail/order-detail）

**导航栏标题**：订单详情

**功能**：展示单条订单的完整信息，根据角色控制信息显示

**入参（页面参数）**：
- `id`：订单 `_id`
- `role`：`user` / `store` / `admin`
- `sourceId`：门店角色时需要传

**数据加载**：调用 `order` 云函数（action: detail）

**页面结构**：
```
┌────────────────────────┐
│     [待处理]             │ ← 大字状态，带颜色
│   订单号：GKK...         │
├────────────────────────┤
│ 报修信息                 │
│ 手机号    13800138000    │ ← 门店看到的是 138****0000
│ 姓名      张三（如有）    │
│ 地址      xx路（如有）    │
│ 问题描述   xxx（如有）    │
│ 提交时间   2026-05-12    │
│ 更新时间   2026-05-12    │
│ 备注       xxx（如有）    │
├────────────────────────┤
│ 现场照片（如有图片）      │
│ [图1] [图2] [图3]       │ ← 点击可全屏预览
└────────────────────────┘
```

---

### 5.5 门店登录页（pages/store-login/store-login）

**导航栏标题**：门店登录

**功能**：门店人员输入门店编号和验证码登录

**进入逻辑**：`onLoad` 先检查是否已登录（`checkStoreLogin()`），已登录则直接跳转到门店订单页

**页面结构**：
```
┌────────────────────────┐
│     门店登录             │
│ 请输入管理员分配的        │
│ 门店编号和验证码          │
├────────────────────────┤
│ 门店编号  [_________]    │
│ 验证码    [_________]    │ ← password 模式
├────────────────────────┤
│    【 登录 】            │
└────────────────────────┘
```

**登录逻辑**：
1. 调用 `source` 云函数（action: verify, sourceId, authCode）
2. 成功 → 保存门店信息到 globalData 和 Storage → 跳转 `/pages/store-orders/store-orders`（用 `redirectTo` 不留返回栈）
3. 失败 → toast 提示

**登录状态保存**：
- `wx.setStorageSync('storeRole', 'store')`
- `wx.setStorageSync('storeInfo', { sourceId, name, type })`

---

### 5.6 门店订单页（pages/store-orders/store-orders）

**导航栏标题**：门店订单
**启用下拉刷新**：是

**进入逻辑**：`onLoad` 检查门店登录状态，未登录跳转回门店登录页

**页面结构**：
```
┌────────────────────────┐
│ 朝阳区旗舰店        [退出]│ ← 门店名 + 退出按钮
├────────────────────────┤
│[全部][待处理][已联系][施工中][已完成]│ ← 状态筛选横栏
├────────────────────────┤
│ 订单卡片列表（同我的订单） │
│ 手机号显示为 138****0000  │ ← 脱敏！
└────────────────────────┘
```

**状态筛选**：点击筛选标签，重置 page=1，重新按状态加载

**退出**：清除 Storage 中的门店信息 → 跳转回门店登录页

**点击跳转**：`/pages/order-detail/order-detail?id={_id}&role=store&sourceId={sourceId}`

---

### 5.7 管理后台首页（pages/admin/admin）

**导航栏标题**：管理后台

**两种状态**：

#### 未登录状态：
```
┌────────────────────────┐
│     管理后台             │
│   请输入管理员密码        │
├────────────────────────┤
│ 管理密码  [_________]    │ ← password 模式
├────────────────────────┤
│    【 登录 】            │
└────────────────────────┘
```

#### 已登录状态：
```
┌────────────────────────┐
│ 管理后台           [退出]│
├────────────────────────┤
│ 数据概览                 │
│   150           3       │
│  总订单数     来源渠道数   │
├────────────────────────┤
│ 来源统计                 │
│ 朝阳区旗舰店  STORE001   │
│              80单 完成30  │
│ 海淀区分店   STORE002    │
│              70单 完成25  │
├────────────────────────┤
│ [订单管理 >]             │
│ [来源管理 >]             │
└────────────────────────┘
```

**登录逻辑**：
1. 先确保 openId 已获取（`ensureLogin`）
2. 调用 `login` 云函数（action: verifyAdmin, password）
3. 成功 → 保存管理员状态到 Storage → 切换为已登录视图 → 加载统计数据
4. 失败 → toast 提示

**统计数据**：调用 `source` 云函数（action: stats）

**跳转**：
- 订单管理 → `/pages/admin-orders/admin-orders`
- 来源管理 → `/pages/admin-sources/admin-sources`

---

### 5.8 订单管理页（pages/admin-orders/admin-orders）

**导航栏标题**：订单管理
**启用下拉刷新**：是

**进入逻辑**：检查管理员登录状态

**页面结构**：
```
┌────────────────────────┐
│[全部][待处理][已联系][勘察][报价][施工][完成][取消]│ ← 横向滚动筛选
├────────────────────────┤
│ 订单卡片（含完整手机号）  │
│ 手机：13800138000       │
│ 来源：STORE001          │ ← 额外显示来源标识
│                  [修改状态]│ ← 操作按钮
├────────────────────────┤
│ ...更多订单卡片          │
└────────────────────────┘
```

**修改状态**：
1. 点击「修改状态」→ 弹出 `wx.showActionSheet`，列出所有状态选项
2. 选择后调用 `order` 云函数（action: updateStatus）
3. 成功 → toast 提示 + 刷新列表

**点击订单跳转**：`/pages/order-detail/order-detail?id={_id}&role=admin`

---

### 5.9 来源管理页（pages/admin-sources/admin-sources）

**导航栏标题**：来源管理
**启用下拉刷新**：是

**页面结构**：
```
┌────────────────────────┐
│ [+ 新增来源] / [取消]    │ ← 切换按钮
├────────────────────────┤
│ 新增表单（点击后展开）    │
│ * 来源标识 [STORE001]    │
│ * 名称    [朝阳区旗舰店]  │
│   联系电话 [138...]      │
│   类型  ○门店  ○推荐人    │
│       【创建】           │
├────────────────────────┤
│ 朝阳区旗舰店 [门店] 启用   │
│ 编号：STORE001           │
│ 验证码：123456           │
│ 电话：13800138000        │
│ 创建：2026-05-12         │
│        [复制信息] [禁用]  │
├────────────────────────┤
│ ...更多来源卡片          │
└────────────────────────┘
```

**创建来源**：
1. 填写表单 → 调用 `source` 云函数（action: create）
2. 成功 → toast + 关闭表单 + 刷新列表

**复制信息**：将门店编号 + 验证码 + 小程序路径复制到剪贴板，格式：
```
门店编号: STORE001
验证码: 123456
小程序路径: pages/index/index?sourceId=STORE001
```

**启用/禁用**：调用 `source` 云函数（action: update, status: 'active'/'disabled'）

---

## 六、工具模块设计

### 6.1 utils/api.js（云函数调用封装）

封装统一的 `callCloud(name, data)` 函数：
- 调用 `wx.cloud.callFunction({ name, data })`
- 判断返回结果的 `code === 0` 表示成功，否则 reject
- 对外暴露具体方法：`login`, `submitOrder`, `getOrderList`, `getOrderDetail`, `updateOrderStatus`, `getSourceList`, `createSource`, `updateSource`, `verifyStore`, `getSourceStats`, `verifyAdmin`

### 6.2 utils/auth.js（权限与登录管理）

| 函数 | 说明 |
|------|------|
| `ensureLogin()` | 确保已获取 openId，有缓存直接返回，没有则调云函数获取 |
| `saveSourceId(id)` | 保存 sourceId 到 globalData + Storage |
| `getSourceId()` | 读取 sourceId，优先 globalData，其次 Storage |
| `storeLogin(sourceId, authCode)` | 门店登录，成功后保存到 globalData + Storage |
| `checkStoreLogin()` | 检查门店是否已登录 |
| `adminLogin(password)` | 管理员登录 |
| `checkAdminLogin()` | 检查管理员是否已登录 |
| `logout()` | 清除所有登录状态（globalData + Storage） |

### 6.3 utils/util.js（工具函数）

| 函数 | 说明 |
|------|------|
| `generateOrderNo()` | 生成订单号：`GKK` + yyyyMMddHHmmss + 4位随机 |
| `maskPhone(phone)` | 手机号脱敏：`138****1234` |
| `formatTime(timestamp)` | 时间戳 → `2026-05-12 14:30` |
| `formatDate(timestamp)` | 时间戳 → `2026-05-12` |
| `getStatusText(status)` | 状态枚举值 → 中文（如 `pending` → `待处理`） |
| `isValidPhone(phone)` | 手机号正则校验 |
| `STATUS_MAP` | 状态映射对象 |

---

## 七、项目文件结构

```
项目根目录/
├── app.js                              # 小程序入口，初始化云开发，定义 globalData
├── app.json                            # 页面路由、全局窗口配置
├── app.wxss                            # 全局样式（按钮、卡片、表单、状态标签等）
├── sitemap.json                        # 站点地图配置
├── project.config.json                 # 微信开发者工具项目配置
├── pages/
│   ├── index/                          # 首页
│   │   ├── index.js / index.json / index.wxml / index.wxss
│   ├── submit/                         # 提交需求
│   │   ├── submit.js / submit.json / submit.wxml / submit.wxss
│   ├── my-orders/                      # 我的订单
│   │   ├── my-orders.js / my-orders.json / my-orders.wxml / my-orders.wxss
│   ├── order-detail/                   # 订单详情
│   │   ├── order-detail.js / order-detail.json / order-detail.wxml / order-detail.wxss
│   ├── store-login/                    # 门店登录
│   │   ├── store-login.js / store-login.json / store-login.wxml / store-login.wxss
│   ├── store-orders/                   # 门店订单
│   │   ├── store-orders.js / store-orders.json / store-orders.wxml / store-orders.wxss
│   ├── admin/                          # 管理后台
│   │   ├── admin.js / admin.json / admin.wxml / admin.wxss
│   ├── admin-orders/                   # 订单管理
│   │   ├── admin-orders.js / admin-orders.json / admin-orders.wxml / admin-orders.wxss
│   └── admin-sources/                  # 来源管理
│       ├── admin-sources.js / admin-sources.json / admin-sources.wxml / admin-sources.wxss
├── utils/
│   ├── api.js                          # 云函数调用封装
│   ├── auth.js                         # 权限与登录管理
│   └── util.js                         # 工具函数
└── cloudfunctions/
    ├── login/                          # 登录云函数
    │   ├── index.js
    │   └── package.json
    ├── order/                          # 订单云函数
    │   ├── index.js
    │   └── package.json
    └── source/                         # 来源云函数
        ├── index.js
        └── package.json
```

---

## 八、二维码方案

### 生成规则
每个门店/推荐人的小程序入口路径：
```
pages/index/index?sourceId=STORE001
```

### 两种二维码格式兼容
1. **普通小程序码**：路径中直接带 `sourceId` 参数 → `onLoad(options)` 读 `options.sourceId`
2. **小程序码（getUnlimited）**：使用 `scene` 参数，格式 `s=STORE001` → 需 URL 解码后解析

### 管理后台操作流程
1. 管理员登录后台 → 来源管理 → 新增来源（如 STORE001）
2. 系统自动生成 6 位验证码
3. 点击「复制信息」获取门店编号 + 验证码 + 路径
4. 用微信官方工具或接口生成对应路径的小程序码
5. 将小程序码和验证码交给门店

---

## 九、全局样式规范

### 颜色
| 用途 | 色值 |
|------|------|
| 主色 / 按钮 / 链接 | `#1890ff` |
| 页面背景 | `#f5f5f5` |
| 卡片背景 | `#ffffff` |
| 主文字 | `#333333` |
| 次文字 | `#666666` |
| 辅助文字 | `#999999` |
| 危险 / 删除 | `#ff4d4f` |
| 成功 | `#52c41a` |
| 边框 | `#e8e8e8` |

### 组件规范
| 组件 | 样式 |
|------|------|
| 卡片 `.card` | 白色背景，圆角 16rpx，padding 30rpx，阴影 `0 2rpx 12rpx rgba(0,0,0,0.05)` |
| 主按钮 `.btn-primary` | 蓝底白字，圆角 12rpx，高 96rpx（大按钮圆角 48rpx） |
| 表单输入 `.form-input` | 高 80rpx，边框 2rpx solid #e8e8e8，圆角 8rpx |
| 状态标签 `.status-tag` | 圆角 6rpx，字号 22rpx，白字彩底（颜色见状态枚举） |

---

## 十、开发顺序建议

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | 项目骨架：`app.js`、`app.json`、`app.wxss`、`project.config.json`、`sitemap.json` | 无 |
| 2 | 工具模块：`utils/util.js`、`utils/api.js`、`utils/auth.js` | 步骤 1 |
| 3 | 云函数：`login` → `order` → `source` | 步骤 2 |
| 4 | 用户页面：首页 → 提交需求 → 我的订单 → 订单详情 | 步骤 3 |
| 5 | 门店页面：门店登录 → 门店订单 | 步骤 3 |
| 6 | 管理页面：管理后台 → 订单管理 → 来源管理 | 步骤 3 |
| 7 | 联调测试：全流程走通 | 步骤 4-6 |

---

## 十一、部署上线清单

1. 在微信公众平台（mp.weixin.qq.com）注册小程序账号
2. 获取 AppID → 填入 `project.config.json` 的 `appid` 字段
3. 用微信开发者工具打开项目根目录
4. 开通云开发（按量付费即可）
5. 在云数据库中创建 3 个集合：`orders`、`sources`、`admins`
6. 在 `admins` 集合中添加初始管理员记录：`{ "password": "你的密码", "name": "管理员" }`
7. 右键每个云函数文件夹 →「在云端安装依赖并上传」（共 3 个）
8. 本地编译预览 → 全流程测试
9. 上传代码 → 提交审核 → 审核通过后发布

---

## 十二、后续扩展方向（仅预留，当前不实现）

1. **个人推荐二维码裂变**：`sources.type` 已支持 `referrer` 类型
2. **自动分佣**：可在 `orders` 表加 `commission` 字段
3. **在线支付 / 担保交易**：可加 `paymentStatus` 字段
4. **漏水案例库**：新建 `cases` 集合
5. **AI 智能诊断 / 自动报价**：可对接第三方 AI 接口
6. **多城市渠道管理**：在 `sources` 表加 `city` 字段

---

> 本文档完整描述了「干快快」小程序 MVP 的全部需求、技术方案和实现细节。
> 交给任何 AI 开发工具时，请说：**「请根据这份文档从零实现完整项目」**。
