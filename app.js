App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      traceUser: true
    })
    this.globalData = {}
  },

  globalData: {
    openId: null,
    sourceId: null,
    role: null, // user / store / admin
    storeInfo: null
  }
})
