const assert = require('assert');
const { collectProblems } = require('../scripts/check-ready');

const bad = collectProblems({
  appJs: 'replace-with-your-env-id',
  projectCfg: 'touristappid',
  appCfg: 'replace-with-service-phone',
  appJson: JSON.stringify({ pages: [] })
});
assert.ok(bad.length >= 5);

const good = collectProblems({
  appJs: 'env-prod-1',
  projectCfg: 'wx123456',
  appCfg: '13812345678',
  appJson: JSON.stringify({ pages: ['pages/privacy-policy/index', 'pages/user-agreement/index'] })
});
assert.strictEqual(good.length, 0);

console.log('release-check.test passed');
