// ============================================================================
// RunWise — Production Build Script (Node.js)
// Runs main Vite build + admin Vite build using npx (bundled with Node.js),
// then stages admin into dist/admin/. The deploy runner invokes build.sh
// which calls this script via node — guaranteeing no shell parsing issues.
// ============================================================================
const { execSync } = require('node:child_process');
const { cpSync, existsSync, rmSync } = require('node:fs');
const path = require('node:path');

function run(label, command, opts = {}) {
  console.log(`\n=== RunWise Build: ${label} ===`);
  try {
    execSync(command, { stdio: 'inherit', shell: true, ...opts });
  } catch (err) {
    console.error(`Build failed at step "${label}":`, err.message);
    process.exit(1);
  }
}

// Deploy target base. Empty on Vercel (root domain, assets at /assets),
// '/runwise/' on GitHub Pages (site served under the repository subpath).
const RUNWISE_BASE = process.env.RUNWISE_BASE || '';

// 0. Ensure root dependencies exist. Clean runners (Vercel, CI) install the
//    root package via their own install step, but this guard makes the script
//    self-sufficient on any runner and stays a no-op when deps are present.
if (!existsSync(path.join(__dirname, 'node_modules', 'vite'))) {
  run('root install', 'npm install --no-audit --no-fund');
}

// 1. Build main app (npx is guaranteed with Node.js). vite.config.ts reads
//    RUNWISE_BASE to set the asset base for the current deploy target.
run('main app', 'npx vite build');

// 1b. Guarantee dist/app.js is the current app.js. public/ is the single
//     source of truth for runtime scripts (Vite copies it, but the copy can
//     go stale on incremental builds), so sync from there.
try {
  cpSync(path.resolve(__dirname, 'public', 'app.js'), path.resolve(__dirname, 'dist', 'app.js'));
  console.log('  (synced dist/app.js from public/app.js)');
} catch (err) {
  console.error('  WARN: could not sync dist/app.js:', err.message);
}

// 2. Back up admin/index.html before the admin build. The admin npm build
//    script copies dist/index.html over the source entry, so we restore the
//    backup afterwards — a plain `git checkout` would silently discard any
//    uncommitted source edits (e.g. the relative favicon href fix).
const adminDir = path.resolve(__dirname, 'admin');
const adminIndex = path.resolve(adminDir, 'index.html');
const adminIndexBackup = path.resolve(adminDir, 'index.html.runwise-bak');
let hadIndexBackup = false;
try {
  if (existsSync(adminIndex)) {
    cpSync(adminIndex, adminIndexBackup);
    hadIndexBackup = true;
    console.log('  (backed up admin/index.html)');
  }
} catch (err) {
  console.error('  WARN: could not back up admin/index.html:', err.message);
}

// 2b. Ensure admin dependencies exist. The admin/ folder is a nested package
//     that deploy runners do not install by default — the root cause of the
//     Vercel build failure. Guard stays a no-op when deps are already present.
if (!existsSync(path.join(adminDir, 'node_modules', 'vite'))) {
  run('admin install', 'npm install --no-audit --no-fund', { cwd: adminDir });
}

// 3. Build admin portal (its vite config reads BASE_PATH, and the wouter router
//    derives its base from the built BASE_URL, so admin works on any subpath).
//    Vite requires the base to start with a slash: '/admin/' on the root domain,
//    or '/<repo>/admin/' on GitHub Pages.
const adminBase = RUNWISE_BASE ? `${RUNWISE_BASE}admin/` : '/admin/';
run('admin portal', 'npx vite build', {
  cwd: adminDir,
  env: {
    ...process.env,
    BASE_PATH: adminBase,
    VITE_SUPABASE_URL: 'https://lugbyiwtmxvhmhtwcrle.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_KG7TwPctMeDCLnRVcTdjIQ_ol3yPVvX',
  },
});

// 3b. Restore admin/index.html from the backup so uncommitted source edits survive.
try {
  if (hadIndexBackup && existsSync(adminIndexBackup)) {
    cpSync(adminIndexBackup, adminIndex);
    rmSync(adminIndexBackup, { force: true });
    console.log('  (restored admin/index.html)');
  }
} catch (err) {
  console.error('  WARN: could not restore admin/index.html:', err.message);
}

// 4. Stage admin into main dist/
const dist = path.resolve(__dirname, 'dist');
const adminDist = path.resolve(adminDir, 'dist');
const adminDest = path.resolve(dist, 'admin');

if (existsSync(adminDest)) rmSync(adminDest, { recursive: true });
cpSync(adminDist, adminDest, { recursive: true });

console.log('\n=== RunWise Build: complete ===');
console.log(`  base: ${RUNWISE_BASE || '/'}`);
console.log('  dist/index.html          marketing homepage');
console.log('  dist/app/index.html      main app (/app)');
console.log('  dist/early-access.html   early access landing');
console.log('  dist/admin/index.html    admin portal');
