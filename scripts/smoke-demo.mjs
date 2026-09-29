/**
 * Регрессионный тест демо-режима.
 *
 * Баг, который он ловит: в сборке с ключами Supabase (а именно такая уезжает
 * на GitHub Pages) кнопка «Войти в демо-режим» пыталась залогиниться в облако
 * под несуществующим demo@lada.ru и молча падала — демо не открывалось.
 *
 * Тест выполняется в Node: модуль src/lib собирается esbuild-ом с «боевыми»
 * переменными окружения, после чего проверяется полный сценарий
 * «вход в демо → данные → выход → возврат в облачный режим».
 *
 * Запуск: node scripts/smoke-demo.mjs
 */
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outfile = path.join(root, 'node_modules', '.tmp', 'smoke-demo.mjs');

/* Браузерное окружение-заглушка */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.window = globalThis;
globalThis.location = { origin: 'https://example.test', pathname: '/' };
globalThis.dispatchEvent = () => true;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.CustomEvent = class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

await build({
  entryPoints: [path.join(root, 'src', 'lib', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'error',
  define: {
    'process.env.NODE_ENV': '"production"',
    // ключи заданы — ровно та сборка, в которой демо не работало
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'https://example-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_example_key',
    }),
  },
});

const lib = await import(pathToFileURL(outfile).href);

let failed = 0;
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`OK   ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

check('ключи Supabase распознаны', lib.isDemoOnly() === false);
check('по умолчанию работает облачный бэкенд', lib.getBackend().mode === 'supabase');

lib.setDemoMode(true);
const demo = lib.getBackend();
check('после нажатия «Войти в демо» бэкенд переключился', demo.mode === 'demo', `mode=${demo.mode}`);

const user = await demo.auth.signIn('demo@lada.ru', 'demo');
check('вход в демо-кабинет выполнен', user?.email === 'demo@lada.ru');
check('сессия демо сохраняется', (await demo.auth.getUser())?.id === 'demo-user');

const car = await demo.data.getCar('demo-user');
const loan = await demo.data.getLoan('demo-user');
const txs = await demo.data.listTransactions('demo-user');
const maint = await demo.data.listMaintenance('demo-user');
check('демо-гараж заполнен автомобилем', Boolean(car && car.current_mileage > 0));
check('демо-кредит создан', Boolean(loan && loan.monthly_payment > 0));
check('демо-расходы созданы', txs.length > 10, `записей: ${txs.length}`);
check('журнал ТО заполнен', maint.length >= 3, `записей: ${maint.length}`);

/* План обслуживания должен строиться по этим данным без единой правки руками */
const service = await import(pathToFileURL(await bundleService()).href);
const plan = service.buildServicePlan({
  mileage: car.current_mileage,
  mode: 'forum',
  engine: '21127',
  maintenance: maint,
});
check('план ТО собран автоматически', plan.length > 10, `работ: ${plan.length}`);
check(
  'по журналу определены выполненные работы',
  plan.some((s) => !s.estimated),
  'ни одна запись журнала не распознана',
);
check(
  'есть работы, требующие внимания',
  plan.some((s) => s.state !== 'ok'),
);

await demo.auth.signOut();
check('выход из демо очищает сессию', (await demo.auth.getUser()) === null);
lib.setDemoMode(false);
check('после выхода возвращается облачный режим', lib.getBackend().mode === 'supabase');

console.log(failed ? `\n${failed} проверок упало` : '\nДемо-режим работает во всех состояниях');
process.exit(failed ? 1 : 0);

async function bundleService() {
  const out = path.join(root, 'node_modules', '.tmp', 'smoke-service.mjs');
  await build({
    entryPoints: [path.join(root, 'src', 'lib', 'service.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: out,
    logLevel: 'error',
  });
  return out;
}
