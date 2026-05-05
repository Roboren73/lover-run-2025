const { call } = require('../../utils/api');
const { statusLabel } = require('../../utils/status');

const STATUS_ORDER = ['NEW', 'FOLLOWING', 'APPOINTED', 'IN_PROGRESS', 'DONE', 'COMPLETED', 'CLOSED'];

Page({
  data: {
    list: [],
    loading: false,
    dashboard: { storeName: '', sourceId: '', total: 0, counts: {}, statusMap: {} },
    cells: [],
    activeStatus: ''
  },
  onShow() {
    this.loadDashboard();
    this.loadOrders();
  },
  loadDashboard() {
    call('store.dashboard').then((dashboard) => {
      const cells = STATUS_ORDER.map((status) => ({
        status,
        label: dashboard.statusMap[status] || status,
        count: dashboard.counts[status] || 0
      }));
      this.setData({ dashboard, cells });
    });
  },
  loadOrders() {
    this.setData({ loading: true });
    const payload = this.data.activeStatus ? { status: this.data.activeStatus } : {};
    call('store.orders', payload)
      .then((r) => this.setData({ list: (r.list || []).map((it) => ({ ...it, displayStatus: statusLabel(it.status) })) }))
      .finally(() => this.setData({ loading: false }));
  },
  onStatusTap(e) {
    const status = e.currentTarget.dataset.status;
    const next = this.data.activeStatus === status ? '' : status;
    this.setData({ activeStatus: next });
    this.loadOrders();
  },
  clearFilter() {
    this.setData({ activeStatus: '' });
    this.loadOrders();
  },
  goDetail(e) {
    wx.navigateTo({ url: `/pages/store-order-detail/index?id=${e.currentTarget.dataset.id}` });
  }
});
