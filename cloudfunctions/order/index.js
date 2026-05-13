const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  switch (action) {
    case 'submit':
      return submitOrder(OPENID, event)
    case 'list':
      return getOrderList(OPENID, event)
    case 'detail':
      return getOrderDetail(OPENID, event)
    case 'updateStatus':
      return updateOrderStatus(OPENID, event)
    default:
      return { code: -1, message: '未知操作' }
  }
}

// 提交订单
async function submitOrder(openId, event) {
  const { phone, name, address, description, images, sourceId } = event

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { code: -1, message: '请输入正确的手机号' }
  }

  const now = Date.now()
  const orderNo = generateOrderNo()

  try {
    const res = await db.collection('orders').add({
      data: {
        orderNo,
        sourceId: sourceId || '',
        openId,
        phone,
        name: name || '',
        address: address || '',
        description: description || '',
        images: images || [],
        status: 'pending',
        remark: '',
        createdAt: now,
        updatedAt: now
      }
    })
    return { code: 0, message: '提交成功', data: { _id: res._id, orderNo } }
  } catch (err) {
    return { code: -1, message: '提交失败: ' + err.message }
  }
}

// 获取订单列表
async function getOrderList(openId, event) {
  const { role, sourceId, page = 1, pageSize = 20, status } = event

  let query = {}

  if (role === 'admin') {
    // 管理员：验证身份
    const isAdmin = await checkAdmin(openId)
    if (!isAdmin) return { code: -1, message: '无权限' }
    if (status) query.status = status
  } else if (role === 'store') {
    // 门店：只看自己来源的
    if (!sourceId) return { code: -1, message: '缺少来源标识' }
    query.sourceId = sourceId
    if (status) query.status = status
  } else {
    // 普通用户：只看自己的
    query.openId = openId
  }

  try {
    const countRes = await db.collection('orders').where(query).count()
    const total = countRes.total

    const listRes = await db.collection('orders')
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    let list = listRes.data

    // 门店角色：手机号脱敏
    if (role === 'store') {
      list = list.map(item => ({
        ...item,
        phone: maskPhone(item.phone)
      }))
    }

    return { code: 0, data: { list, total, page, pageSize } }
  } catch (err) {
    return { code: -1, message: '查询失败: ' + err.message }
  }
}

// 获取订单详情
async function getOrderDetail(openId, event) {
  const { orderId, role, sourceId } = event

  try {
    const res = await db.collection('orders').doc(orderId).get()

    if (!res.data) {
      return { code: -1, message: '订单不存在' }
    }

    const order = res.data

    if (role === 'admin') {
      const isAdmin = await checkAdmin(openId)
      if (!isAdmin) return { code: -1, message: '无权限' }
      // 管理员看完整信息
    } else if (role === 'store') {
      // 门店只能看自己来源的，手机号脱敏
      if (order.sourceId !== sourceId) {
        return { code: -1, message: '无权限查看此订单' }
      }
      order.phone = maskPhone(order.phone)
    } else {
      // 普通用户只能看自己的
      if (order.openId !== openId) {
        return { code: -1, message: '无权限查看此订单' }
      }
    }

    return { code: 0, data: order }
  } catch (err) {
    return { code: -1, message: '查询失败: ' + err.message }
  }
}

// 更新订单状态（管理员）
async function updateOrderStatus(openId, event) {
  const { orderId, status, remark } = event

  const isAdmin = await checkAdmin(openId)
  if (!isAdmin) return { code: -1, message: '无权限' }

  const validStatuses = ['pending', 'contacted', 'inspecting', 'quoting', 'constructing', 'completed', 'cancelled']
  if (!validStatuses.includes(status)) {
    return { code: -1, message: '无效状态' }
  }

  try {
    const updateData = { status, updatedAt: Date.now() }
    if (remark !== undefined) updateData.remark = remark

    await db.collection('orders').doc(orderId).update({ data: updateData })
    return { code: 0, message: '更新成功' }
  } catch (err) {
    return { code: -1, message: '更新失败: ' + err.message }
  }
}

// 检查是否为管理员
async function checkAdmin(openId) {
  const res = await db.collection('admins').where({ openId }).count()
  return res.total > 0
}

// 手机号脱敏
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4)
}

// 生成订单号
function generateOrderNo() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `GKK${y}${m}${d}${h}${min}${s}${rand}`
}
