const { call } = require('../../utils/api');

Page({
  data: {
    form: { phone: '', name: '', address: '', description: '', images: [] },
    sourceId: '',
    submitting: false,
    agreed: false
  },
  onShow() {
    const app = getApp();
    const role = app.globalData.user?.role || 'CUSTOMER';
    if (role === 'STORE') return wx.redirectTo({ url: '/pages/store-orders/index' });
    if (role === 'ADMIN') return wx.redirectTo({ url: '/pages/admin-dashboard/index' });
    this.setData({ sourceId: app.globalData.sourceId || '' });
  },
  onInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value });
  },
  chooseImages() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: async (res) => {
        const tempFiles = res.tempFiles || [];
        const uploaded = [];
        for (const file of tempFiles) {
          const cloudPath = `orders/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`;
          const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: file.tempFilePath });
          uploaded.push(uploadRes.fileID);
        }
        this.setData({ 'form.images': [...this.data.form.images, ...uploaded].slice(0, 9) });
      }
    });
  },
  removeImage(e) {
    const idx = e.currentTarget.dataset.idx;
    const images = this.data.form.images.filter((_, i) => i !== idx);
    this.setData({ 'form.images': images });
  },
  toggleAgree(e) {
    this.setData({ agreed: !!e.detail.value.length });
  },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy-policy/index' }); },
  goAgreement() { wx.navigateTo({ url: '/pages/user-agreement/index' }); },
  async submit() {
    const { form, sourceId } = this.data;
    if (!/^1\d{10}$/.test(form.phone)) return wx.showToast({ title: '手机号格式不正确', icon: 'none' });
    if (!sourceId) return wx.showToast({ title: '来源失效，请重新扫码', icon: 'none' });
    if (!this.data.agreed) return wx.showToast({ title: '请先同意协议与隐私政策', icon: 'none' });
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      await call('lead.submit', { sourceId, ...form });
      wx.redirectTo({ url: '/pages/success/index' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
