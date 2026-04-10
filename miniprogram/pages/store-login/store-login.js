const auth = require('../../utils/auth')

Page({
  data: {
    sourceId: '',
    authCode: '',
    logging: false
  },

  onLoad() {
    // 如果已登录，直接跳转
    if (auth.checkStoreLogin()) {
      this.goStoreOrders()
    }
  },

  onSourceIdInput(e) {
    this.setData({ sourceId: e.detail.value })
  },

  onAuthCodeInput(e) {
    this.setData({ authCode: e.detail.value })
  },

  login() {
    const { sourceId, authCode } = this.data
    if (!sourceId) {
      wx.showToast({ title: '请输入门店编号', icon: 'none' })
      return
    }
    if (!authCode) {
      wx.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }

    this.setData({ logging: true })

    auth.storeLogin(sourceId, authCode).then(() => {
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => this.goStoreOrders(), 1000)
    }).catch(err => {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' })
    }).finally(() => {
      this.setData({ logging: false })
    })
  },

  goStoreOrders() {
    wx.redirectTo({ url: '/pages/store-orders/store-orders' })
  }
})
