const api = require('../../utils/api')
const auth = require('../../utils/auth')
const { formatTime, getStatusText } = require('../../utils/util')

Page({
  data: {
    orders: [],
    loading: true,
    page: 1,
    hasMore: true
  },

  onLoad() {
    auth.ensureLogin().then(() => {
      this.loadOrders()
    })
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, orders: [] })
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadOrders()
    }
  },

  loadOrders() {
    this.setData({ loading: true })
    return api.getOrderList({
      role: 'user',
      page: this.data.page,
      pageSize: 20
    }).then(res => {
      const newOrders = res.data.list.map(item => ({
        ...item,
        statusText: getStatusText(item.status),
        createdAtText: formatTime(item.createdAt)
      }))
      const orders = this.data.page === 1 ? newOrders : this.data.orders.concat(newOrders)
      this.setData({
        orders,
        loading: false,
        page: this.data.page + 1,
        hasMore: orders.length < res.data.total
      })
    }).catch(err => {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${id}&role=user`
    })
  }
})
