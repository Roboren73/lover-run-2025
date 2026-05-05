const assert = require('assert');
const { statusLabel } = require('../miniprogram/utils/status');

assert.strictEqual(statusLabel('NEW'), '待接单');
assert.strictEqual(statusLabel('CLOSED'), '已关闭');
assert.strictEqual(statusLabel('UNKNOWN'), 'UNKNOWN');

console.log('status.test passed');
