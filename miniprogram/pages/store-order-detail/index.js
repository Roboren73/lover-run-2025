const { call } = require('../../utils/api');
const { statusLabel } = require('../../utils/status');
const { formatDateTime } = require('../../utils/format');

Page({
  data: { item: null },
  onLoad(options) { this.orderId = options.id; },
  onShow() {
    if (!this.orderId) return;
    call('store.order.detail', { orderId: this.orderId }).then((item) => this.setData({
      item: {
        ...item,
        displayStatus: statusLabel(item.status),
        createdAtText: formatDateTime(item.createdAt),
        updatedAtText: formatDateTime(item.updatedAt)
      }
    }));
  },
  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    const urls = this.data.item?.images || [];
    if (!current || !urls.length) return;
    wx.previewImage({ current, urls });
  }
});
