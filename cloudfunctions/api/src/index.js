const cloud = require('wx-server-sdk');
const { ORDER_STATUS, STORE_STATUS_MAP, maskPhone, assertPhone, assertStatus, sanitizeText, sanitizeImages } = require('./helpers');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ROLES = { CUSTOMER: 'CUSTOMER', STORE: 'STORE', ADMIN: 'ADMIN' };

async function trackEvent(eventType, payload = {}) {
  try {
    await db.collection('operation_logs').add({
      data: {
        eventType,
        payload,
        createdAt: new Date()
      }
    });
  } catch (e) {
    console.warn('trackEvent failed', e);
  }
}


async function getUserByOpenid(openid) {
  const res = await db.collection('users').where({ _id: openid }).limit(1).get();
  return res.data[0] || null;
}

async function getSourceById(sourceId) {
  const res = await db.collection('sources').where({ _id: sourceId }).limit(1).get();
  return res.data[0] || null;
}

async function getOrderById(orderId) {
  const res = await db.collection('orders').where({ _id: orderId }).limit(1).get();
  return res.data[0] || null;
}

function buildPage(page = 1, pageSize = 20) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
  return {
    skip: (safePage - 1) * safePageSize,
    limit: safePageSize
  };
}

async function assertRole(openid, role) {
  const user = await getUserByOpenid(openid);
  if (!user || user.role !== role) throw new Error('无权限');
  return user;
}

exports.main = async (event) => {
  const { action } = event;
  const { OPENID } = cloud.getWXContext();


  if (action === 'auth.me') {
    const user = await getUserByOpenid(OPENID);
    if (!user) return { openid: OPENID, role: 'CUSTOMER' };
    return { openid: OPENID, role: user.role || 'CUSTOMER', sourceId: user.sourceId || '' };
  }

  if (action === 'lead.submit') {
    const { sourceId, phone, name = '', address = '', description = '', images = [] } = event;
    if (!sourceId || !phone) throw new Error('sourceId 和 phone 必填');
    assertPhone(phone);
    const source = await getSourceById(sourceId);
    if (!source || source.status !== 'ACTIVE') throw new Error('来源无效');

    const createResult = await db.collection('orders').add({
      data: {
        sourceId,
        phone,
        name: sanitizeText(name, 30),
        address: sanitizeText(address, 120),
        description: sanitizeText(description, 500),
        images: sanitizeImages(images),
        status: ORDER_STATUS[0],
        createdBy: OPENID,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    await trackEvent('lead_submit', { orderId: createResult._id, sourceId, openid: OPENID });
    return { id: createResult._id };
  }

  if (action === 'store.orders') {
    const user = await assertRole(OPENID, ROLES.STORE);
    const { status, page = 1, pageSize = 20 } = event;
    const { skip, limit } = buildPage(page, pageSize);
    const cond = { sourceId: user.sourceId };
    if (status) cond.status = status;

    const orders = await db.collection('orders').where(cond).orderBy('createdAt', 'desc').skip(skip).limit(limit).get();
    return { list: orders.data.map(({ phone, ...rest }) => ({ ...rest, phoneMasked: maskPhone(phone) })) };
  }


  if (action === 'store.dashboard') {
    const user = await assertRole(OPENID, ROLES.STORE);
    const orders = await db.collection('orders').where({ sourceId: user.sourceId }).get();
    const counts = {};
    Object.keys(STORE_STATUS_MAP).forEach((k) => { counts[k] = 0; });
    orders.data.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status] += 1;
    });
    return {
      storeName: user.displayName || '门店',
      sourceId: user.sourceId,
      total: orders.data.length,
      counts,
      statusMap: STORE_STATUS_MAP
    };
  }

  if (action === 'store.order.detail') {
    const user = await assertRole(OPENID, ROLES.STORE);
    const { orderId } = event;
    const order = await getOrderById(orderId);
    if (!order || order.sourceId !== user.sourceId) throw new Error('无权限');
    const { phone, ...rest } = order;
    return { ...rest, phoneMasked: maskPhone(phone) };
  }

  if (action === 'admin.orders') {
    await assertRole(OPENID, ROLES.ADMIN);
    const { status, sourceId, page = 1, pageSize = 20 } = event;
    const { skip, limit } = buildPage(page, pageSize);
    const cond = {};
    if (status) cond.status = status;
    if (sourceId) cond.sourceId = sourceId;
    const list = await db.collection('orders').where(cond).orderBy('createdAt', 'desc').skip(skip).limit(limit).get();
    return { list: list.data };
  }

  if (action === 'admin.order.detail') {
    await assertRole(OPENID, ROLES.ADMIN);
    const { orderId } = event;
    const order = await getOrderById(orderId);
    if (!order) throw new Error('订单不存在');
    return order;
  }

  if (action === 'admin.order.updateStatus') {
    await assertRole(OPENID, ROLES.ADMIN);
    const { orderId, status } = event;
    const order = await getOrderById(orderId);
    if (!order) throw new Error('订单不存在');
    assertStatus(status);
    await db.collection('orders').doc(orderId).update({ data: { status, updatedAt: new Date() } });
    await trackEvent('admin_update_status', { orderId, status, openid: OPENID });
    return { ok: true };
  }


  if (action === 'admin.dashboard') {
    await assertRole(OPENID, ROLES.ADMIN);
    const orders = await db.collection('orders').get();
    const sources = await db.collection('sources').get();
    const sourceMap = {};
    sources.data.forEach((s) => { sourceMap[s._id] = s.name; });

    const statusCounts = {};
    ORDER_STATUS.forEach((status) => { statusCounts[status] = 0; });
    const sourceCounts = {};

    orders.data.forEach((o) => {
      if (statusCounts[o.status] !== undefined) statusCounts[o.status] += 1;
      sourceCounts[o.sourceId] = (sourceCounts[o.sourceId] || 0) + 1;
    });

    const topSources = Object.keys(sourceCounts)
      .map((sourceId) => ({ sourceId, sourceName: sourceMap[sourceId] || sourceId, orderCount: sourceCounts[sourceId] }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);

    return {
      total: orders.data.length,
      statusCounts,
      topSources
    };
  }


  if (action === 'admin.logs.summary') {
    await assertRole(OPENID, ROLES.ADMIN);
    const logs = await db.collection('operation_logs').orderBy('createdAt', 'desc').limit(200).get();
    const map = {};
    logs.data.forEach((l) => {
      map[l.eventType] = (map[l.eventType] || 0) + 1;
    });
    return {
      total: logs.data.length,
      latestAt: logs.data[0]?.createdAt || null,
      byEvent: map
    };
  }

  if (action === 'admin.stats.sources') {
    await assertRole(OPENID, ROLES.ADMIN);
    const orders = await db.collection('orders').get();
    const sources = await db.collection('sources').get();
    const sourceMap = {};
    sources.data.forEach((s) => { sourceMap[s._id] = s.name; });
    const map = {};
    orders.data.forEach((o) => { map[o.sourceId] = (map[o.sourceId] || 0) + 1; });
    return {
      list: Object.keys(map).map((sid) => ({ sourceId: sid, sourceName: sourceMap[sid] || sid, orderCount: map[sid] }))
    };
  }

  if (action === 'admin.sources.create') {
    await assertRole(OPENID, ROLES.ADMIN);
    const { sourceId, name, type = 'STORE', ownerUserId = '' } = event;
    if (!sourceId || !name) throw new Error('sourceId和name必填');
    await db.collection('sources').doc(sourceId).set({
      data: { type, name, ownerUserId, status: 'ACTIVE', createdAt: new Date() }
    });
    await trackEvent('admin_create_source', { sourceId, name, openid: OPENID });
    return { ok: true };
  }

  throw new Error('unknown action');
};
