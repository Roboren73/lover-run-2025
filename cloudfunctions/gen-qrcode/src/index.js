const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { sourceId } = event;
  if (!sourceId) throw new Error('sourceId required');
  return cloud.openapi.wxacode.getUnlimited({ scene: `s_${sourceId}`, page: 'pages/lead-form/index', checkPath: false });
};
