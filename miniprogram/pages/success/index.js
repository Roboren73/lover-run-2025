const { servicePhone } = require('../../config');

function validPhone(p) {
  return /^1\d{10}$/.test(String(p));
}

Page({
  toHome() {
    wx.reLaunch({ url: '/pages/lead-form/index' });
  },
  callService() {
    if (!validPhone(servicePhone)) {
      return wx.showModal({
        title: '联系客服',
        content: '请在 miniprogram/config.js 配置客服电话后启用一键拨号。',
        showCancel: false
      });
    }
    wx.makePhoneCall({ phoneNumber: servicePhone });
  }
});
