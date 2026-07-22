const fs = require('node:fs');
const path = require('node:path');

const files = [
  'index.html',
  'styles.css',
  'signup-legal-fix.css',
  'runwise-logo.svg',
  'config.js',
  'app.js',
  'legal-v11.js',
  'session-fix.js',
  'notification-system.js',
  'notification-worker.js',
];

const output = path.join(process.cwd(), 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of files) {
  const source = path.join(process.cwd(), file);
  if (!fs.existsSync(source)) throw new Error(`Required admin web file is missing: ${file}`);
  fs.copyFileSync(source, path.join(output, file));
}

fs.writeFileSync(
  path.join(output, 'robots.txt'),
  'User-agent: *\nDisallow:\n',
  'utf8',
);
console.log(`Prepared ${files.length} RunWise web files in dist/`);