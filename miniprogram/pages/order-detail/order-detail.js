const auth = require('../../utils/auth')
const { formatTime, getStatusText } = require('../../utils/util')

Page({
  data: {
    order: null,
    loading: true,
    role: 'user'
  },

  onLoad(options) {
    const { id, role, sourceId } = options
    this.orderId = id
    this.sourceId = sourceId || ''
    this.setData({ role: role || 'user' })

    auth.ensureLogin().then(() => {
      this.loadDetail()
    })
  },

  loadDetail() {
    this.setData({ loading: true })

    const params = {
      action: 'detail',
      orderId: this.orderId,
      role: this.data.role
    }
    if (this.sourceId) params.sourceId = this.sourceId

    wx.cloud.callFunction({
      name: 'order',
      data: params
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const order = res.result.data
        order.statusText = getStatusText(order.status)
        order.createdAtText = formatTime(order.createdAt)
        order.updatedAtText = formatTime(order.updatedAt)
        this.setData({ order, loading: false })
      } else {
        throw new Error(res.result ? res.result.message : '加载失败')
      }
    }).catch(err => {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    })
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: this.data.order.images
    })
  }
})
