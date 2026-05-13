const api = require('../../utils/api')
const auth = require('../../utils/auth')
const { formatTime } = require('../../utils/util')

Page({
  data: {
    sources: [],
    loading: true,
    showAddForm: false,
    newSourceId: '',
    newName: '',
    newContactPhone: '',
    newType: 'store',
    adding: false,
    generatingId: ''
  },

  onLoad() {
    if (!auth.checkAdminLogin()) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.loadSources()
  },

  onPullDownRefresh() {
    this.loadSources().then(() => wx.stopPullDownRefresh())
  },

  loadSources() {
    this.setData({ loading: true })
    return api.getSourceList().then(res => {
      const sources = res.data.map(item => ({
        ...item,
        createdAtText: formatTime(item.createdAt)
      }))
      this.setData({ sources, loading: false })
    }).catch(err => {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    })
  },

  toggleAddForm() {
    this.setData({ showAddForm: !this.data.showAddForm })
  },

  onNewSourceIdInput(e) {
    this.setData({ newSourceId: e.detail.value })
  },

  onNewNameInput(e) {
    this.setData({ newName: e.detail.value })
  },

  onNewPhoneInput(e) {
    this.setData({ newContactPhone: e.detail.value })
  },

  onTypeChange(e) {
    this.setData({ newType: e.detail.value === '0' ? 'store' : 'referrer' })
  },

  addSource() {
    const { newSourceId, newName, newContactPhone, newType } = this.data

    if (!newSourceId) {
      wx.showToast({ title: '请输入来源标识', icon: 'none' })
      return
    }
    if (!newName) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }

    this.setData({ adding: true })

    api.createSource({
      sourceId: newSourceId,
      name: newName,
      contactPhone: newContactPhone,
      type: newType
    }).then(res => {
      wx.showToast({ title: '创建成功', icon: 'success' })
      this.setData({
        adding: false,
        showAddForm: false,
        newSourceId: '',
        newName: '',
        newContactPhone: '',
        newType: 'store'
      })
      this.loadSources()
    }).catch(err => {
      this.setData({ adding: false })
      wx.showToast({ title: err.message || '创建失败', icon: 'none' })
    })
  },

  toggleStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const newStatus = status === 'active' ? 'disabled' : 'active'

    api.updateSource(id, { status: newStatus }).then(() => {
      wx.showToast({ title: '更新成功', icon: 'success' })
      this.loadSources()
    }).catch(err => {
      wx.showToast({ title: err.message || '更新失败', icon: 'none' })
    })
  },

  copySourceInfo(e) {
    const item = e.currentTarget.dataset.item
    const text = `门店编号: ${item.sourceId}\n验证码: ${item.authCode}\n小程序路径: pages/index/index?sourceId=${item.sourceId}`
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
      }
    })
  },

  // 生成小程序码
  genQRCode(e) {
    const sourceId = e.currentTarget.dataset.sourceid
    if (!sourceId) return

    this.setData({ generatingId: sourceId })
    wx.showLoading({ title: '生成中...' })

    api.genQRCode(sourceId).then(res => {
      wx.hideLoading()
      this.setData({ generatingId: '' })

      const fileID = res.data.fileID

      // 获取临时链接用于预览和保存
      wx.cloud.getTempFileURL({
        fileList: [fileID],
        success: tmpRes => {
          if (tmpRes.fileList && tmpRes.fileList[0]) {
            const tempUrl = tmpRes.fileList[0].tempFileURL
            // 预览图片，长按可保存
            wx.previewImage({
              current: tempUrl,
              urls: [tempUrl]
            })
          }
        },
        fail: () => {
          wx.showToast({ title: '获取图片链接失败', icon: 'none' })
        }
      })
    }).catch(err => {
      wx.hideLoading()
      this.setData({ generatingId: '' })
      wx.showModal({
        title: '生成失败',
        content: err.message || '请稍后重试',
        showCancel: false
      })
    })
  }
})
