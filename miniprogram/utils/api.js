const CLOUD_FN = 'api';

function call(action, data = {}) {
  if (!wx.cloud) {
    return Promise.reject(new Error('wx.cloud 未初始化'));
  }

  return wx.cloud.callFunction({
    name: CLOUD_FN,
    data: { action, ...data }
  }).then((res) => res.result)
    .catch((err) => {
      wx.showToast({ title: err?.message || '请求失败', icon: 'none' });
      throw err;
    });
}

module.exports = { call };
