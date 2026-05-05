const STATUS_LABELS = {
  NEW: '待接单',
  FOLLOWING: '待勘查',
  APPOINTED: '已勘查',
  IN_PROGRESS: '施工中',
  DONE: '已完工',
  COMPLETED: '已完成',
  CLOSED: '已关闭'
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '-';
}

module.exports = { STATUS_LABELS, statusLabel };
