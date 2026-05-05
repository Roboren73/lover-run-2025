const { call } = require('../../utils/api');
const { statusLabel } = require('../../utils/status');
const { formatDateTime } = require('../../utils/format');

const statusList = ['NEW', 'FOLLOWING', 'APPOINTED', 'IN_PROGRESS', 'DONE', 'COMPLETED', 'CLOSED'];
Page({
  data: { item: null, statusList, statusOptions: [] },
  onLoad(options) {
    this.orderId = options.id;
    this.setData({ statusOptions: statusList.map((s) => ({ key: s, label: statusLabel(s) })) });
  },
  onShow() { this.load(); },
  load() {
    if (!this.orderId) return;
    call('admin.order.detail', { orderId: this.orderId }).then((item) => {
      this.setData({
        item: {
          ...item,
          displayStatus: statusLabel(item.status),
          createdAtText: formatDateTime(item.createdAt),
          updatedAtText: formatDateTime(item.updatedAt)
        }
      });
    });
  },
  changeStatus(e) {
    const status = e.currentTarget.dataset.status;
    call('admin.order.updateStatus', { orderId: this.orderId, status }).then(() => {
      wx.showToast({ title: '状态已更新' });
      this.load();
    });
  },
  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    const urls = this.data.item?.images || [];
    if (!current || !urls.length) return;
    wx.previewImage({ current, urls });
  }
});
