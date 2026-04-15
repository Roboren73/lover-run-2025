/**
 * 权限与登录管理
 */
const api = require('./api')

// 确保已登录（获取 openId）
function ensureLogin() {
  const app = getApp()
  if (app.globalData.openId) {
    return Promise.resolve(app.globalData.openId)
  }
  return api.login().then(res => {
    app.globalData.openId = res.openId
    return res.openId
  })
}

// 保存来源 ID 到本地
function saveSourceId(sourceId) {
  if (sourceId) {
    const app = getApp()
    app.globalData.sourceId = sourceId
    wx.setStorageSync('sourceId', sourceId)
  }
}

// 获取来源 ID
function getSourceId() {
  const app = getApp()
  if (app.globalData.sourceId) return app.globalData.sourceId
  const stored = wx.getStorageSync('sourceId')
  if (stored) {
    app.globalData.sourceId = stored
  }
  return stored || ''
}

// 门店登录
function storeLogin(sourceId, authCode) {
  return api.verifyStore(sourceId, authCode).then(res => {
    const app = getApp()
    app.globalData.role = 'store'
    app.globalData.storeInfo = res.data
    wx.setStorageSync('storeRole', 'store')
    wx.setStorageSync('storeInfo', res.data)
    return res.data
  })
}

// 检查门店登录状态
function checkStoreLogin() {
  const app = getApp()
  if (app.globalData.role === 'store' && app.globalData.storeInfo) {
    return true
  }
  const role = wx.getStorageSync('storeRole')
  const info = wx.getStorageSync('storeInfo')
  if (role === 'store' && info) {
    app.globalData.role = 'store'
    app.globalData.storeInfo = info
    return true
  }
  return false
}

// 管理员登录
function adminLogin(password) {
  return api.verifyAdmin(password).then(res => {
    const app = getApp()
    app.globalData.role = 'admin'
    wx.setStorageSync('adminRole', 'admin')
    return res
  })
}

// 检查管理员登录状态
function checkAdminLogin() {
  const app = getApp()
  if (app.globalData.role === 'admin') return true
  const role = wx.getStorageSync('adminRole')
  if (role === 'admin') {
    app.globalData.role = 'admin'
    return true
  }
  return false
}

// 退出登录
function logout() {
  const app = getApp()
  app.globalData.role = null
  app.globalData.storeInfo = null
  wx.removeStorageSync('storeRole')
  wx.removeStorageSync('storeInfo')
  wx.removeStorageSync('adminRole')
}

module.exports = {
  ensureLogin,
  saveSourceId,
  getSourceId,
  storeLogin,
  checkStoreLogin,
  adminLogin,
  checkAdminLogin,
  logout
}
