const DEFAULT_ENV_ID = 'prod-8gjasn9k646af602';

App({
  globalData: {
    sourceId: '',
    role: 'CUSTOMER',
    envId: DEFAULT_ENV_ID,
    user: { role: 'CUSTOMER', sourceId: '' }
  },
  onLaunch(options) {
    this.initCloud();
    this.restoreSource();
    this.resolveSource(options);
    this.syncProfile();
  },
  onShow(options) {
    this.resolveSource(options);
  },
  onNeedPrivacyAuthorization(resolve, reject) {
    wx.openPrivacyContract({
      success: () => resolve({ buttonId: "agree-btn" }),
      fail: () => reject()
    });
  },
  initCloud() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力');
      return;
    }
    wx.cloud.init({ env: this.globalData.envId, traceUser: true });
  },
  restoreSource() {
    try {
      const sourceId = wx.getStorageSync('sourceId');
      if (sourceId) this.globalData.sourceId = sourceId;
    } catch (e) {
      console.warn('restore source failed', e);
    }
  },
  async syncProfile() {
    try {
      const res = await wx.cloud.callFunction({ name: "api", data: { action: "auth.me" } });
      this.globalData.user = res.result || { role: "CUSTOMER" };
    } catch (e) {
      console.warn("sync profile failed", e);
    }
  },
  resolveSource(options) {
    const query = options?.query || {};
    let sourceId = query.sourceId || '';
    if (!sourceId && query.scene) {
      const scene = decodeURIComponent(query.scene);
      if (scene.startsWith('s_')) sourceId = scene.slice(2);
    }
    if (sourceId) {
      this.globalData.sourceId = sourceId;
      wx.setStorageSync('sourceId', sourceId);
    }
  }
});
