const assert = require('assert');
const { formatDateTime } = require('../miniprogram/utils/format');

assert.strictEqual(formatDateTime(null), '-');
assert.strictEqual(formatDateTime('bad-date'), '-');
assert.ok(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(formatDateTime('2026-01-02T03:04:05.000Z')));

console.log('format.test passed');
