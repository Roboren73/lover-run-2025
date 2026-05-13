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
    case 'genCode':
      return genQRCode(OPENID, event)
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

// 生成小程序码（管理员）
async function genQRCode(openId, event) {
  const isAdmin = await checkAdmin(openId)
  if (!isAdmin) return { code: -1, message: '无权限' }

  const { sourceId } = event
  if (!sourceId) return { code: -1, message: '缺少来源标识' }

  try {
    // 使用云调用生成小程序码
    // scene 参数最长 32 字符，用 s= 前缀传递 sourceId
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: 's=' + sourceId,
      page: 'pages/index/index',
      width: 430,
      autoColor: false,
      lineColor: { r: 24, g: 144, b: 255 },
      isHyaline: false
    })

    if (result.errCode !== 0 && result.errCode !== undefined) {
      return { code: -1, message: '生成失败: ' + (result.errMsg || '未知错误') }
    }

    // 将图片 buffer 上传到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath: `qrcodes/${sourceId}-${Date.now()}.png`,
      fileContent: result.buffer
    })

    return {
      code: 0,
      message: '生成成功',
      data: { fileID: uploadResult.fileID }
    }
  } catch (err) {
    // 如果 openapi 不可用，返回明确的错误提示
    if (err.message && err.message.includes('openapi')) {
      return {
        code: -1,
        message: '生成失败：请确认云函数已部署 config.json 并开通 openapi 权限。部署方法：右键 source 文件夹 →「上传并部署：云端安装依赖」'
      }
    }
    return { code: -1, message: '生成失败: ' + err.message }
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
