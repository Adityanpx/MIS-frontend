// Copies the backend's framework-free shared code (enums, constants, zod schemas, formula evaluator, Indian
// number format) into src/shared, so both sides validate and format with exactly the same rules.
// Usage: npm run sync:shared            (expects ../OMMIS-backend next to this project)
//        SHARED_SRC=/path/to/src/shared npm run sync:shared
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.env.SHARED_SRC ? resolve(process.env.SHARED_SRC) : resolve(root, '../../backend/mis_backend/src/shared');
const dest = resolve(root, 'src/shared');

if (!existsSync(src)) {
  console.error(`✖ Shared folder not found: ${src}\n  Set SHARED_SRC or put OMMIS-backend next to OMMIS-web.`);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
writeFileSync(
  resolve(dest, 'DO_NOT_EDIT.txt'),
  '# DO NOT EDIT\nCopied from OMMIS-backend/src/shared by `npm run sync:shared`. Change the backend copy, then re-sync.\n',
);
console.log(`✔ Copied ${src} → ${dest}`);
