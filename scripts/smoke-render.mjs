/**
 * Smoke-тест рендера всех экранов без браузера.
 *
 * В песочнице нет Chromium, поэтому вместо скриншотов каждый маршрут
 * рендерится через react-dom/server — в трёх состояниях: «с данными»
 * (графики, таблицы, виджеты), «пустой аккаунт» (онбординг и пустые состояния)
 * и «настоящие контексты» (реальные провайдеры, состояние загрузки).
 * Задача — поймать падения на этапе выполнения: битые импорты, отсутствующие
 * компоненты, несовпадение форм данных с разметкой.
 *
 * Запуск: npm run smoke  (собирает esbuild-бандл и выполняет его в Node)
 */
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h, StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.tsx';
import { AppDataProvider } from '../src/context/AppDataContext.tsx';
import Layout from '../src/components/Layout.tsx';
import AuthPage from '../src/pages/AuthPage.tsx';
import DashboardPage from '../src/pages/DashboardPage.tsx';
import CreditPage from '../src/pages/CreditPage.tsx';
import ExpensesPage from '../src/pages/ExpensesPage.tsx';
import GaragePage from '../src/pages/GaragePage.tsx';
import ServicePage from '../src/pages/ServicePage.tsx';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.window = globalThis;
globalThis.dispatchEvent = () => true;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.CustomEvent = class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

const ROUTES = [
  ['/auth', AuthPage, 'авторизация'],
  ['/', DashboardPage, 'главная'],
  ['/credit', CreditPage, 'кредит'],
  ['/expenses', ExpensesPage, 'расходы'],
  ['/service', ServicePage, 'то'],
  ['/garage', GaragePage, 'гараж'],
];

const mode = (process.argv.find((a) => a.startsWith('--mode=')) ?? '--mode=data').slice(7);
const label =
  mode === 'empty' ? 'настоящие контексты' : mode === 'blank' ? 'пустой аккаунт' : 'с данными';

let failed = 0;
for (const [path, Page, name] of ROUTES) {
  try {
    const html = renderToStaticMarkup(
      h(
        StrictMode,
        null,
        h(
          MemoryRouter,
          { initialEntries: [path] },
          h(
            AuthProvider,
            null,
            h(
              AppDataProvider,
              null,
              h(
                Routes,
                null,
                h(Route, { path: '/auth', element: h(Page) }),
                h(Route, { element: h(Layout) }, h(Route, { path, element: h(Page) })),
              ),
            ),
          ),
        ),
      ),
    );
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#x27;|&quot;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    // SMOKE_DUMP=1 — выгрузить текст страниц (быстрая вычитка копирайта без браузера)
    if (process.env.SMOKE_DUMP) {
      fs.mkdirSync('node_modules/.tmp/dump', { recursive: true });
      fs.writeFileSync(`node_modules/.tmp/dump/${name}.txt`, text.replace(/ · /g, '\n· '));
    }
    console.log(
      `OK   ${path.padEnd(10)} ${name.padEnd(14)} ${String(html.length).padStart(6)} симв. | ${text.slice(0, 64)}`,
    );
  } catch (e) {
    failed++;
    console.log(`FAIL ${path.padEnd(10)} ${name}: ${e?.message ?? e}`);
    if (e?.stack) console.log(e.stack.split('\n').slice(1, 3).join('\n'));
  }
}
console.log(
  failed
    ? `\n${failed} экранов упало (${label})`
    : `\nВсе экраны отрендерились без ошибок (${label})`,
);
process.exit(failed ? 1 : 0);
