const ORDER_STATUS = ['NEW', 'FOLLOWING', 'APPOINTED', 'IN_PROGRESS', 'DONE', 'COMPLETED', 'CLOSED'];

const STORE_STATUS_MAP = {
  NEW: '待接单',
  FOLLOWING: '待勘查',
  APPOINTED: '已勘查',
  IN_PROGRESS: '施工中',
  DONE: '已完工',
  COMPLETED: '已完成',
  CLOSED: '已关闭'
};

function maskPhone(phone = '') {
  return String(phone).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function assertPhone(phone = '') {
  if (!/^1\d{10}$/.test(String(phone))) throw new Error('手机号格式错误');
}

function assertStatus(status) {
  if (!ORDER_STATUS.includes(status)) throw new Error('非法状态');
}

function sanitizeText(value = '', maxLen = 200) {
  return String(value || '').trim().slice(0, maxLen);
}

function sanitizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter((x) => typeof x === 'string' && x.trim()).slice(0, 9);
}

module.exports = {
  ORDER_STATUS,
  STORE_STATUS_MAP,
  maskPhone,
  assertPhone,
  assertStatus,
  sanitizeText,
  sanitizeImages
};
