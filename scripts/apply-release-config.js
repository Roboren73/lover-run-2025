const fs = require('fs');

const envId = process.env.WX_ENV_ID;
const appId = process.env.WX_APP_ID;
const servicePhone = process.env.SERVICE_PHONE;

if (!envId || !appId || !servicePhone) {
  console.error('Usage: WX_ENV_ID=... WX_APP_ID=... SERVICE_PHONE=... node scripts/apply-release-config.js');
  process.exit(1);
}

const appJsPath = 'miniprogram/app.js';
const projectPath = 'miniprogram/project.config.json';
const cfgPath = 'miniprogram/config.js';

let appJs = fs.readFileSync(appJsPath, 'utf8');
appJs = appJs.replace(/const DEFAULT_ENV_ID = '.*';/, `const DEFAULT_ENV_ID = '${envId}';`);
fs.writeFileSync(appJsPath, appJs);

const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
project.appid = appId;
fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));

let cfg = fs.readFileSync(cfgPath, 'utf8');
cfg = cfg.replace(/servicePhone: '.*'/, `servicePhone: '${servicePhone}'`);
fs.writeFileSync(cfgPath, cfg);

console.log('✅ release config applied');
