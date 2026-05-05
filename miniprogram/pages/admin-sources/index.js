const { call } = require('../../utils/api');

Page({
  data: {
    sourceId: '',
    name: '',
    created: false,
    qrImage: ''
  },
  onSourceInput(e) { this.setData({ sourceId: e.detail.value.trim() }); },
  onNameInput(e) { this.setData({ name: e.detail.value.trim() }); },
  async createSource() {
    const { sourceId, name } = this.data;
    if (!sourceId || !name) return wx.showToast({ title: '请填写来源ID和名称', icon: 'none' });
    await call('admin.sources.create', { sourceId, name });
    this.setData({ created: true });
    wx.showToast({ title: '来源已创建' });
  },
  async genQrcode() {
    const { sourceId } = this.data;
    if (!sourceId) return wx.showToast({ title: '请先填写来源ID', icon: 'none' });
    const res = await wx.cloud.callFunction({ name: 'gen-qrcode', data: { sourceId } });
    this.setData({ qrImage: res.result.buffer || '' });
    wx.showToast({ title: '二维码已生成' });
  }
});
