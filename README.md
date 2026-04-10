# 干快快 - 建筑渗漏堵漏获客小程序

微信小程序 + 微信云开发，极简获客闭环。

## 功能

- **用户端**：扫码进入 → 提交维修需求 → 查看订单进度
- **门店端**：验证登录 → 查看自己带来的订单（手机号脱敏）
- **管理端**：订单管理 → 来源管理 → 数据统计

## 项目结构

```
miniprogram/           # 小程序前端
  pages/
    index/             # 首页（用户扫码入口）
    submit/            # 提交报修需求
    my-orders/         # 我的订单
    order-detail/      # 订单详情
    store-login/       # 门店登录
    store-orders/      # 门店订单列表
    admin/             # 管理后台
    admin-orders/      # 订单管理
    admin-sources/     # 来源管理
  utils/
    api.js             # 云函数调用封装
    auth.js            # 权限与登录管理
    util.js            # 工具函数
cloudfunctions/        # 云函数
  login/               # 登录 & 管理员验证
  order/               # 订单 CRUD
  source/              # 来源管理 & 统计
```

## 快速开始

1. 在微信公众平台注册小程序，获取 AppID
2. 将 `project.config.json` 中的 `appid` 替换为你的 AppID
3. 用微信开发者工具打开项目
4. 开通云开发，创建以下数据库集合：`orders`、`sources`、`admins`
5. 在 `admins` 集合中手动添加一条记录：`{ password: "你的管理密码" }`
6. 上传并部署所有云函数
7. 预览或发布小程序

## 二维码方案

每个门店/推荐人的小程序码路径：
```
pages/index/index?sourceId=STORE001
```
在管理后台「来源管理」中创建来源后，可复制来源信息生成对应二维码。
