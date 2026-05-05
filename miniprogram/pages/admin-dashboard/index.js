const { call } = require('../../utils/api');
const { formatDateTime } = require('../../utils/format');

const STATUS_ORDER = ['NEW', 'FOLLOWING', 'APPOINTED', 'IN_PROGRESS', 'DONE', 'COMPLETED', 'CLOSED'];

Page({
  data: {
    total: 0,
    statusCards: [],
    topSources: [],
    logs: { total: 0, latestAtText: '-', byEventText: '' }
  },
  onShow() { this.load(); },
  async load() {
    const [dash, logs] = await Promise.all([
      call('admin.dashboard'),
      call('admin.logs.summary')
    ]);
    const statusCards = STATUS_ORDER.map((status) => ({ status, count: dash.statusCounts[status] || 0 }));
    const byEventText = Object.keys(logs.byEvent || {}).map((k) => `${k}:${logs.byEvent[k]}`).join(' / ');
    this.setData({
      total: dash.total || 0,
      statusCards,
      topSources: dash.topSources || [],
      logs: {
        total: logs.total || 0,
        latestAtText: formatDateTime(logs.latestAt),
        byEventText
      }
    });
  },
  goSources() {
    wx.navigateTo({ url: "/pages/admin-sources/index" });
  }
});
