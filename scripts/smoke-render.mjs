/**
 * Smoke-тест рендера всех экранов без браузера.
 *
 * В песочнице нет Chromium, поэтому вместо скриншотов каждый маршрут
 * рендерится через react-dom/server — в двух состояниях: «пусто»
 * (онбординг и пустые состояния) и «с данными» (графики, таблицы, виджеты).
 * Задача — поймать падения на этапе выполнения: битые импорты, отсутствующие
 * компоненты, несовпадение форм данных с разметкой.
 *
 * Запуск: npm run smoke  (собирает esbuild-бандл и выполняет его в Node)
 */
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
  ['/garage', GaragePage, 'гараж'],
];

const empty = process.argv.includes('--empty');

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
    ? `\n${failed} экранов упало (${empty ? 'без данных' : 'с данными'})`
    : `\nВсе экраны отрендерились без ошибок (${empty ? 'без данных' : 'с данными'})`,
);
process.exit(failed ? 1 : 0);
