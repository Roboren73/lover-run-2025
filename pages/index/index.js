const auth = require('../../utils/auth')

Page({
  data: {
    sourceId: '',
    loaded: false
  },

  onLoad(options) {
    // 从二维码场景解析 sourceId
    if (options.sourceId) {
      auth.saveSourceId(options.sourceId)
      this.setData({ sourceId: options.sourceId })
    } else if (options.scene) {
      // 小程序码 scene 参数（URL 编码）
      const scene = decodeURIComponent(options.scene)
      const params = this.parseScene(scene)
      if (params.s) {
        auth.saveSourceId(params.s)
        this.setData({ sourceId: params.s })
      }
    } else {
      // 尝试从本地读取
      const savedSource = auth.getSourceId()
      if (savedSource) {
        this.setData({ sourceId: savedSource })
      }
    }

    // 静默登录获取 openId
    auth.ensureLogin().then(() => {
      this.setData({ loaded: true })
    }).catch(err => {
      console.error('登录失败', err)
      this.setData({ loaded: true })
    })
  },

  // 解析 scene 参数 (格式: s=STORE001)
  parseScene(scene) {
    const params = {}
    scene.split('&').forEach(pair => {
      const [key, val] = pair.split('=')
      if (key && val) params[key] = val
    })
    return params
  },

  // 跳转到提交需求页
  goSubmit() {
    wx.navigateTo({ url: '/pages/submit/submit' })
  },

  // 跳转到我的订单
  goMyOrders() {
    wx.navigateTo({ url: '/pages/my-orders/my-orders' })
  },

  // 跳转到门店登录
  goStore() {
    wx.navigateTo({ url: '/pages/store-login/store-login' })
  },

  // 跳转到管理后台
  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  }
})
