const api = require('../../utils/api')
const auth = require('../../utils/auth')
const { formatTime, getStatusText, STATUS_MAP } = require('../../utils/util')

Page({
  data: {
    orders: [],
    loading: true,
    page: 1,
    hasMore: true,
    currentStatus: '',
    statusOptions: [],
    showStatusPicker: false,
    pickerOrderId: '',
    pickerStatuses: []
  },

  onLoad() {
    if (!auth.checkAdminLogin()) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      wx.navigateBack()
      return
    }

    const statusOptions = Object.keys(STATUS_MAP).map(key => ({
      value: key,
      text: STATUS_MAP[key]
    }))
    this.setData({ statusOptions })
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
      role: 'admin',
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
      url: `/pages/order-detail/order-detail?id=${id}&role=admin`
    })
  },

  // 修改订单状态
  changeStatus(e) {
    const id = e.currentTarget.dataset.id
    const statusList = Object.keys(STATUS_MAP)
    const textList = statusList.map(k => STATUS_MAP[k])

    wx.showActionSheet({
      itemList: textList,
      success: res => {
        const newStatus = statusList[res.tapIndex]
        this.doUpdateStatus(id, newStatus)
      }
    })
  },

  doUpdateStatus(orderId, status) {
    wx.showLoading({ title: '更新中...' })
    api.updateOrderStatus(orderId, status).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '更新成功', icon: 'success' })
      // 刷新列表
      this.setData({ page: 1, hasMore: true, orders: [] })
      this.loadOrders()
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: err.message || '更新失败', icon: 'none' })
    })
  }
})
