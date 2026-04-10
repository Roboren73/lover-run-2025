const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  // 管理员验证
  if (action === 'verifyAdmin') {
    return verifyAdmin(OPENID, event.password)
  }

  // 默认：返回 openId
  return { code: 0, openId: OPENID }
}

async function verifyAdmin(openId, password) {
  try {
    const res = await db.collection('admins').where({ password }).get()
    if (res.data.length === 0) {
      return { code: -1, message: '密码错误' }
    }
    // 更新管理员的 openId（方便后续鉴权）
    await db.collection('admins').doc(res.data[0]._id).update({
      data: { openId, lastLoginAt: Date.now() }
    })
    return { code: 0, message: '登录成功' }
  } catch (err) {
    return { code: -1, message: '验证失败: ' + err.message }
  }
}
