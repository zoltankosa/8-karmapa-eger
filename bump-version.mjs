// Stamps every local script/style reference with ?v=<stamp> so browsers
// fetch fresh files after a push. Run: npm run bump (before committing).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const files = readdirSync('.').filter((f) => /\.(html|js)$/.test(f) && f !== 'bump-version.mjs');

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const out = src
    // import ... from './x.js'   and   src="x.js" / href="styles.css"
    .replace(/(from\s+'\.\/[\w-]+\.js)(\?v=\w+)?'/g, `$1?v=${stamp}'`)
    .replace(/((?:src|href)="[\w-]+\.(?:js|css))(\?v=\w+)?"/g, `$1?v=${stamp}"`);
  if (out !== src) writeFileSync(f, out);
}
console.log(`version ${stamp} applied to ${files.length} files`);
