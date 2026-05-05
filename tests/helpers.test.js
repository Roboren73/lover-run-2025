const assert = require('assert');
const { maskPhone, assertPhone, assertStatus, STORE_STATUS_MAP, sanitizeText, sanitizeImages } = require('../cloudfunctions/api/src/helpers');

assert.strictEqual(maskPhone('13812345678'), '138****5678');
assert.throws(() => assertPhone('12345'), /手机号格式错误/);
assert.doesNotThrow(() => assertPhone('13812345678'));
assert.throws(() => assertStatus('BAD'), /非法状态/);
assert.doesNotThrow(() => assertStatus('NEW'));
assert.strictEqual(STORE_STATUS_MAP.CLOSED, '已关闭');
assert.strictEqual(sanitizeText('  abcdef  ', 3), 'abc');
assert.deepStrictEqual(sanitizeImages(['a', '', null, 'b']).length, 2);

console.log('helpers.test passed');
