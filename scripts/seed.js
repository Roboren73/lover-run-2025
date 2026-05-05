/**
 * 云开发数据库初始化脚本（在云函数本地调试或 Node 环境执行）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: process.env.WX_ENV_ID || cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function upsertUser(id, data) {
  try {
    await db.collection('users').doc(id).set({ data });
  } catch (e) {
    await db.collection('users').add({ data: { _id: id, ...data } });
  }
}

async function main() {
  const sourceId = 'store_demo_001';

  await db.collection('sources').doc(sourceId).set({
    data: {
      type: 'STORE',
      name: '演示门店A',
      ownerUserId: 'store_openid_demo',
      status: 'ACTIVE',
      createdAt: new Date()
    }
  });

  await upsertUser('store_openid_demo', {
    role: 'STORE',
    sourceId,
    displayName: '演示门店账号'
  });

  await upsertUser('admin_openid_demo', {
    role: 'ADMIN',
    displayName: '演示管理员'
  });

  console.log('seed done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
