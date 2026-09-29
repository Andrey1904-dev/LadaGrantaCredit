/**
 * Сборка smoke-теста в Node-бандл.
 *
 *   node scripts/smoke-build.mjs            # страницы с данными (контексты-заглушки)
 *   node scripts/smoke-build.mjs --blank    # пустой аккаунт: онбординг и пустые состояния
 *   node scripts/smoke-build.mjs --empty    # настоящие контексты (состояние загрузки)
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const stub = path.join(here, 'smoke-data.tsx');
const empty = process.argv.includes('--empty');
const blank = process.argv.includes('--blank');
const mode = empty ? 'empty' : blank ? 'blank' : 'data';
const LABEL = { data: 'с данными', blank: 'пустой аккаунт', empty: 'настоящие контексты' };
const outfile = path.join(root, 'node_modules', '.tmp', `smoke-${mode}.cjs`);

/** В режиме «с данными» подменяем контексты заглушками с готовыми записями. */
const stubContexts = {
  name: 'stub-contexts',
  setup(b) {
    b.onResolve({ filter: /context\/(AppData|Auth)Context$/ }, () => ({
      path: stub,
    }));
  },
};

await build({
  entryPoints: [path.join(here, 'smoke-render.mjs')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  outfile,
  logLevel: 'error',
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }),
  },
  plugins: empty ? [] : [stubContexts],
});

console.log(`сборка: ${path.relative(root, outfile)} (${LABEL[mode]})\n`);
try {
  execFileSync(process.execPath, [outfile, `--mode=${mode}`], {
    stdio: 'inherit',
    env: { ...process.env, SMOKE_BLANK: blank ? '1' : '' },
  });
} catch (e) {
  process.exit(e.status ?? 1);
}
