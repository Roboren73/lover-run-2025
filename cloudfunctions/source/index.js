const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  switch (action) {
    case 'list':
      return getSourceList(OPENID)
    case 'create':
      return createSource(OPENID, event)
    case 'update':
      return updateSource(OPENID, event)
    case 'verify':
      return verifyStore(event)
    case 'stats':
      return getStats(OPENID)
    default:
      return { code: -1, message: '未知操作' }
  }
}

// 获取来源列表（管理员）
async function getSourceList(openId) {
  const isAdmin = await checkAdmin(openId)
  if (!isAdmin) return { code: -1, message: '无权限' }

  try {
    const res = await db.collection('sources')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    return { code: 0, data: res.data }
  } catch (err) {
    return { code: -1, message: '查询失败: ' + err.message }
  }
}

// 创建来源（管理员）
async function createSource(openId, event) {
  const isAdmin = await checkAdmin(openId)
  if (!isAdmin) return { code: -1, message: '无权限' }

  const { sourceId, name, contactPhone, type, authCode } = event

  if (!sourceId || !name) {
    return { code: -1, message: '来源标识和名称为必填项' }
  }

  // 检查 sourceId 唯一性
  const existing = await db.collection('sources').where({ sourceId }).count()
  if (existing.total > 0) {
    return { code: -1, message: '来源标识已存在' }
  }

  try {
    const res = await db.collection('sources').add({
      data: {
        sourceId,
        name,
        contactPhone: contactPhone || '',
        type: type || 'store',
        authCode: authCode || generateAuthCode(),
        status: 'active',
        createdAt: Date.now()
      }
    })
    return { code: 0, message: '创建成功', data: { _id: res._id } }
  } catch (err) {
    return { code: -1, message: '创建失败: ' + err.message }
  }
}

// 更新来源（管理员）
async function updateSource(openId, event) {
  const isAdmin = await checkAdmin(openId)
  if (!isAdmin) return { code: -1, message: '无权限' }

  const { sourceDocId, name, contactPhone, status, authCode } = event

  const updateData = {}
  if (name !== undefined) updateData.name = name
  if (contactPhone !== undefined) updateData.contactPhone = contactPhone
  if (status !== undefined) updateData.status = status
  if (authCode !== undefined) updateData.authCode = authCode
  updateData.updatedAt = Date.now()

  try {
    await db.collection('sources').doc(sourceDocId).update({ data: updateData })
    return { code: 0, message: '更新成功' }
  } catch (err) {
    return { code: -1, message: '更新失败: ' + err.message }
  }
}

// 门店验证登录
async function verifyStore(event) {
  const { sourceId, authCode } = event

  if (!sourceId || !authCode) {
    return { code: -1, message: '请输入门店编号和验证码' }
  }

  try {
    const res = await db.collection('sources').where({
      sourceId,
      authCode,
      status: 'active'
    }).get()

    if (res.data.length === 0) {
      return { code: -1, message: '门店编号或验证码错误' }
    }

    const store = res.data[0]
    return {
      code: 0,
      message: '验证成功',
      data: {
        sourceId: store.sourceId,
        name: store.name,
        type: store.type
      }
    }
  } catch (err) {
    return { code: -1, message: '验证失败: ' + err.message }
  }
}

// 来源统计（管理员）
async function getStats(openId) {
  const isAdmin = await checkAdmin(openId)
  if (!isAdmin) return { code: -1, message: '无权限' }

  try {
    // 获取所有来源
    const sources = await db.collection('sources').get()
    const stats = []

    for (const source of sources.data) {
      const orderCount = await db.collection('orders')
        .where({ sourceId: source.sourceId })
        .count()

      const completedCount = await db.collection('orders')
        .where({ sourceId: source.sourceId, status: 'completed' })
        .count()

      stats.push({
        sourceId: source.sourceId,
        name: source.name,
        type: source.type,
        totalOrders: orderCount.total,
        completedOrders: completedCount.total
      })
    }

    // 总订单数
    const totalOrders = await db.collection('orders').count()

    return {
      code: 0,
      data: {
        totalOrders: totalOrders.total,
        sourceStats: stats
      }
    }
  } catch (err) {
    return { code: -1, message: '统计失败: ' + err.message }
  }
}

// 检查管理员权限
async function checkAdmin(openId) {
  const res = await db.collection('admins').where({ openId }).count()
  return res.total > 0
}

// 生成6位验证码
function generateAuthCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}
