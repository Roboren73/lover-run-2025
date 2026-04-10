const api = require('../../utils/api')
const auth = require('../../utils/auth')
const { isValidPhone } = require('../../utils/util')

Page({
  data: {
    phone: '',
    name: '',
    address: '',
    description: '',
    images: [],
    submitting: false,
    maxImages: 6
  },

  onLoad() {
    auth.ensureLogin()
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  onAddressInput(e) {
    this.setData({ address: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  // 选择图片
  chooseImage() {
    const remaining = this.data.maxImages - this.data.images.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传6张', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const newImages = res.tempFiles.map(f => f.tempFilePath)
        this.setData({
          images: this.data.images.concat(newImages)
        })
      }
    })
  },

  // 删除图片
  removeImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== idx)
    this.setData({ images })
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: this.data.images
    })
  },

  // 上传图片到云存储
  async uploadImages() {
    const tasks = this.data.images.map((filePath, index) => {
      const ext = filePath.split('.').pop()
      const cloudPath = `order-images/${Date.now()}-${index}.${ext}`
      return wx.cloud.uploadFile({
        cloudPath,
        filePath
      }).then(res => res.fileID)
    })
    return Promise.all(tasks)
  },

  // 提交订单
  async submit() {
    const { phone, name, address, description, images } = this.data

    if (!phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!isValidPhone(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    try {
      // 上传图片
      let imageFileIds = []
      if (images.length > 0) {
        imageFileIds = await this.uploadImages()
      }

      const sourceId = auth.getSourceId()

      await api.submitOrder({
        phone,
        name,
        address,
        description,
        images: imageFileIds,
        sourceId
      })

      wx.hideLoading()
      wx.showModal({
        title: '提交成功',
        content: '我们会尽快与您联系，请保持手机畅通',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
