/**
 * 工具函数
 */

// 生成订单号: GKK + 年月日时分秒 + 4位随机数
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

// 手机号脱敏: 138****1234
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4)
}

// 格式化时间戳为可读字符串
function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 订单状态映射
const STATUS_MAP = {
  pending: '待处理',
  contacted: '已联系',
  inspecting: '上门勘察',
  quoting: '报价中',
  constructing: '施工中',
  completed: '已完成',
  cancelled: '已取消'
}

function getStatusText(status) {
  return STATUS_MAP[status] || status
}

// 验证手机号
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone)
}

module.exports = {
  generateOrderNo,
  maskPhone,
  formatTime,
  formatDate,
  getStatusText,
  isValidPhone,
  STATUS_MAP
}
