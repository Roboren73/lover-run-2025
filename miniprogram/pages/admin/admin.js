const auth = require('../../utils/auth')
const api = require('../../utils/api')

Page({
  data: {
    isLoggedIn: false,
    password: '',
    logging: false,
    stats: null,
    loadingStats: false
  },

  onLoad() {
    if (auth.checkAdminLogin()) {
      this.setData({ isLoggedIn: true })
      this.loadStats()
    }
  },

  onShow() {
    if (this.data.isLoggedIn) {
      this.loadStats()
    }
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  login() {
    if (!this.data.password) {
      wx.showToast({ title: '请输入管理密码', icon: 'none' })
      return
    }

    this.setData({ logging: true })

    auth.ensureLogin().then(() => {
      return auth.adminLogin(this.data.password)
    }).then(() => {
      this.setData({ isLoggedIn: true, logging: false })
      wx.showToast({ title: '登录成功', icon: 'success' })
      this.loadStats()
    }).catch(err => {
      this.setData({ logging: false })
      wx.showToast({ title: err.message || '登录失败', icon: 'none' })
    })
  },

  loadStats() {
    this.setData({ loadingStats: true })
    api.getSourceStats().then(res => {
      this.setData({ stats: res.data, loadingStats: false })
    }).catch(err => {
      this.setData({ loadingStats: false })
      console.error('加载统计失败', err)
    })
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/admin-orders/admin-orders' })
  },

  goSources() {
    wx.navigateTo({ url: '/pages/admin-sources/admin-sources' })
  },

  logout() {
    auth.logout()
    this.setData({ isLoggedIn: false, stats: null, password: '' })
  }
})
