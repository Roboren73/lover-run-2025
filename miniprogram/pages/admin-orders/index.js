const { call } = require('../../utils/api');
const { statusLabel } = require('../../utils/status');

const STATUS_OPTIONS = ['', 'NEW', 'FOLLOWING', 'APPOINTED', 'IN_PROGRESS', 'DONE', 'COMPLETED', 'CLOSED'];

Page({
  data: {
    list: [],
    loading: false,
    status: '',
    sourceId: '',
    page: 1,
    pageSize: 20,
    statusOptions: STATUS_OPTIONS,
    statusIndex: 0
  },
  onShow() { this.load(true); },
  onStatusChange(e) {
    const idx = Number(e.detail.value || 0);
    this.setData({ statusIndex: idx, status: STATUS_OPTIONS[idx] || '' });
  },
  onSourceInput(e) { this.setData({ sourceId: e.detail.value }); },
  search() { this.load(true); },
  load(reset = false) {
    const page = reset ? 1 : this.data.page;
    const { status, sourceId, pageSize } = this.data;
    const payload = { page, pageSize };
    if (status) payload.status = status;
    if (sourceId) payload.sourceId = sourceId.trim();

    this.setData({ loading: true });
    call('admin.orders', payload)
      .then((r) => {
        const incoming = (r.list || []).map((it) => ({ ...it, displayStatus: statusLabel(it.status) }));
        const nextList = reset ? incoming : this.data.list.concat(incoming);
        this.setData({ list: nextList, page: page + 1 });
      })
      .finally(() => this.setData({ loading: false }));
  },
  resetFilter() {
    this.setData({ status: '', sourceId: '', statusIndex: 0 });
    this.load(true);
  },
  loadMore() { this.load(false); },
  goDetail(e) { wx.navigateTo({ url: `/pages/admin-order-detail/index?id=${e.currentTarget.dataset.id}` }); }
});
