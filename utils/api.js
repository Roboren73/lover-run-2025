/**
 * 云函数调用封装
 */

function callCloud(name, data) {
  return wx.cloud.callFunction({
    name,
    data
  }).then(res => {
    if (res.result && res.result.code === 0) {
      return res.result
    }
    const errMsg = (res.result && res.result.message) || '请求失败'
    return Promise.reject(new Error(errMsg))
  })
}

// ========== 登录 ==========
function login() {
  return callCloud('login', {})
}

// ========== 订单 ==========
function submitOrder(data) {
  return callCloud('order', { action: 'submit', ...data })
}

function getOrderList(params) {
  return callCloud('order', { action: 'list', ...params })
}

function getOrderDetail(orderId, role = 'user', sourceId = '') {
  const params = { action: 'detail', orderId, role }
  if (sourceId) params.sourceId = sourceId
  return callCloud('order', params)
}

function updateOrderStatus(orderId, status, remark) {
  return callCloud('order', { action: 'updateStatus', orderId, status, remark })
}

// ========== 来源 ==========
function getSourceList() {
  return callCloud('source', { action: 'list' })
}

function createSource(data) {
  return callCloud('source', { action: 'create', ...data })
}

function updateSource(sourceDocId, data) {
  return callCloud('source', { action: 'update', sourceDocId, ...data })
}

function verifyStore(sourceId, authCode) {
  return callCloud('source', { action: 'verify', sourceId, authCode })
}

function getSourceStats() {
  return callCloud('source', { action: 'stats' })
}

function genQRCode(sourceId) {
  return callCloud('source', { action: 'genCode', sourceId })
}

// ========== 管理员 ==========
function verifyAdmin(password) {
  return callCloud('login', { action: 'verifyAdmin', password })
}

module.exports = {
  login,
  submitOrder,
  getOrderList,
  getOrderDetail,
  updateOrderStatus,
  getSourceList,
  createSource,
  updateSource,
  verifyStore,
  getSourceStats,
  genQRCode,
  verifyAdmin
}
