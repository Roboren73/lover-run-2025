const api = require('../../utils/api')
const auth = require('../../utils/auth')
const { formatTime, getStatusText } = require('../../utils/util')

Page({
  data: {
    storeName: '',
    orders: [],
    loading: true,
    page: 1,
    hasMore: true,
    currentStatus: ''
  },

  onLoad() {
    if (!auth.checkStoreLogin()) {
      wx.redirectTo({ url: '/pages/store-login/store-login' })
      return
    }
    const app = getApp()
    this.sourceId = app.globalData.storeInfo.sourceId
    this.setData({ storeName: app.globalData.storeInfo.name })
    this.loadOrders()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, orders: [] })
    this.loadOrders().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadOrders()
    }
  },

  loadOrders() {
    this.setData({ loading: true })
    const params = {
      role: 'store',
      sourceId: this.sourceId,
      page: this.data.page,
      pageSize: 20
    }
    if (this.data.currentStatus) params.status = this.data.currentStatus

    return api.getOrderList(params).then(res => {
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

  // 按状态筛选
  filterStatus(e) {
    const status = e.currentTarget.dataset.status
    this.setData({
      currentStatus: status === this.data.currentStatus ? '' : status,
      page: 1,
      hasMore: true,
      orders: []
    })
    this.loadOrders()
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${id}&role=store&sourceId=${this.sourceId}`
    })
  },

  logout() {
    auth.logout()
    wx.redirectTo({ url: '/pages/store-login/store-login' })
  }
})
