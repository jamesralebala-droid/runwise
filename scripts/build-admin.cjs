const fs = require('node:fs');
const path = require('node:path');

const files = [
  { source: 'index.html', target: 'index.html' },
  { source: 'styles.css', target: 'styles.css' },
  { source: 'signup-legal-fix.css', target: 'signup-legal-fix.css' },
  { source: 'runwise-logo.svg', target: 'runwise-logo.svg' },
  { source: 'config.js', target: 'config.js' },
  { source: 'app.js', target: 'app.js' },
  { source: 'legal-v11.js', target: 'legal-v11.js' },
  { source: 'session-fix.js', target: 'session-fix.js' },
  { source: 'public/notification-system.js', target: 'notification-system.js' },
  { source: 'public/notification-worker.js', target: 'notification-worker.js' },
];

const output = path.join(process.cwd(), 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of files) {
  const source = path.join(process.cwd(), file.source);
  const target = path.join(output, file.target);
  if (!fs.existsSync(source)) {
    throw new Error(`Required RunWise web file is missing: ${file.source}`);
  }
  fs.copyFileSync(source, target);
}

fs.writeFileSync(
  path.join(output, 'robots.txt'),
  'User-agent: *\nDisallow:\n',
  'utf8',
);

console.log(`Prepared ${files.length} RunWise web files in dist/`);
