const fs = require('fs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function collectProblems({ appJs, projectCfg, appCfg, appJson }) {
  const problems = [];
  if (appJs.includes('replace-with-your-env-id')) {
    problems.push('miniprogram/app.js: DEFAULT_ENV_ID still placeholder');
  }
  if (projectCfg.includes('touristappid')) {
    problems.push('miniprogram/project.config.json: appid still touristappid');
  }
  if (appCfg.includes('replace-with-service-phone')) {
    problems.push('miniprogram/config.js: servicePhone still placeholder');
  }

  try {
    const app = JSON.parse(appJson);
    const requiredPages = ['pages/privacy-policy/index', 'pages/user-agreement/index'];
    requiredPages.forEach((p) => {
      if (!app.pages || !app.pages.includes(p)) {
        problems.push(`miniprogram/app.json: missing required page ${p}`);
      }
    });
  } catch (e) {
    problems.push('miniprogram/app.json: invalid json');
  }

  return problems;
}

function runCheck() {
  const appJs = read('miniprogram/app.js');
  const projectCfg = read('miniprogram/project.config.json');
  const appCfg = read('miniprogram/config.js');
  const appJson = read('miniprogram/app.json');
  return collectProblems({ appJs, projectCfg, appCfg, appJson });
}

if (require.main === module) {
  const problems = runCheck();
  if (problems.length) {
    console.error('❌ Release check failed:');
    problems.forEach((p) => console.error('- ' + p));
    process.exit(1);
  }
  console.log('✅ Release check passed');
}

module.exports = { collectProblems, runCheck };
