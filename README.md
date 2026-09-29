# LADA Кредит & Гараж

Мобильное веб-приложение (Mobile-First SPA) для владельцев **LADA Granta**:
учёт расходов и ТО, аналитика стоимости владения и умное управление автокредитом.

![stack](https://img.shields.io/badge/React%2018-Vite-61dafb) ![styles](https://img.shields.io/badge/Tailwind%20CSS-4-38bdf8) ![backend](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth-3fcf8e)

## Функционал

| Экран | Возможности |
|---|---|
| **Авторизация** | Вход / регистрация по email и паролю (Supabase Auth), демо-режим без бэкенда |
| **Главная** | Виджет авто (номер, пробег с обновлением), виджет кредита (дата и сумма следующего платежа), быстрые действия добавления расхода (для топлива — обязательный пробег), сводка трат за месяц |
| **Кредит → Мой график** | Остаток долга по аннуитетной формуле от числа внесённых платежей (`loans` + `transactions`), прогресс-бар, отметка платежа, история |
| **Кредит → Моделирование** | Подбор кредита: 4 поля (сумма, ставка, платёж, срок) — заполняете любые 3, четвёртое считается автоматически (ставка — численно, бисекцией). Калькулятор ПДН со шкалой 0–100% (зелёная <30%, жёлтая 30–50%, красная >50%) |
| **Расходы** | Сумма трат, стоимость километра, Donut-диаграмма по категориям (Chart.js), лента операций по дате ↓ |
| **Моя Гранта** | Редактирование данных авто (номер, VIN, пробег), напоминание об ОСАГО (индикатор при <14 дней), журнал ТО и ремонтов |

## Технологии

- **React 18 + Vite + TypeScript**, **Tailwind CSS 4**
- **React Router** (`HashRouter` — корректная работа на GitHub Pages)
- **Supabase**: PostgreSQL + Auth + Row Level Security
- **Chart.js** (`react-chartjs-2`) для диаграмм
- **GitHub Pages + GitHub Actions** для хостинга

## Быстрый старт

```bash
npm install
npm run dev        # http://localhost:5173
```

### Подключение Supabase

Проект уже подключён к Supabase (`.env` содержит `VITE_SUPABASE_URL` и
`VITE_SUPABASE_ANON_KEY`; файл не коммитится).

**Осталось применить схему БД (одно действие, ~1 минута):**

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/project/dcgurmwvpgzmlfivxoso/sql/new)
   → **SQL Editor** → New query.
2. Вставьте содержимое [`supabase/schema.sql`](supabase/schema.sql) и нажмите **Run**.
3. Готово: таблицы `profiles`, `cars`, `loans`, `transactions`, `maintenance`
   с RLS-политиками и триггером профиля созданы. Приложение подхватит их
   автоматически (в шапке есть кнопка «Повторить»).

> ⚠️ DDL нельзя выполнить через publishable-ключ — только владелец проекта
> в Dashboard (или через `psql`/Management API). Publishable/anon-ключи
> по задумке Supabase имеют доступ только к данным, не к схеме.

**Email-подтверждение:** в проекте включено (`mailer_autoconfirm: false`).
После регистрации приложение попросит подтвердить email по ссылке из письма.
Для мгновенного входа без писем отключите
**Authentication → Sign In / Up → Email → Confirm email** в Dashboard.

Если ключи убрать из `.env` — приложение работает в локальном **демо-режиме**
(localStorage браузера).

Типы схемы БД лежат в `src/types/database.types.ts` (формат `supabase gen types typescript`).

## Деплой на GitHub Pages

1. В настройках репозитория: **Settings → Pages → Source = GitHub Actions**.
2. Добавьте секреты в **Settings → Secrets and variables → Actions** —
   без них Pages-сборка уйдёт в демо-режим:
   - `VITE_SUPABASE_URL` = `https://dcgurmwvpgzmlfivxoso.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = publishable-ключ проекта
3. Запушьте в `main` — workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   соберёт `dist` (с `base: '/LadaGrantaCredit/'`) и опубликует на Pages.

## Структура

```
src/
├── lib/           # бэкенд-слой: supabase.ts, local.ts (демо), общий интерфейс
├── context/       # AuthContext (сессия), AppDataContext (CRUD + кэш данных)
├── components/    # Layout, BottomNav, Sheet, DonutChart, формы, UI-кит
│   └── credit/    # «Мой график» и «Моделирование»
├── pages/         # Auth / Dashboard / Credit / Expenses / Garage
├── utils/         # loan.ts (аннуитет), format.ts, date.ts
└── types/         # доменные типы + database.types.ts (схема Supabase)
supabase/schema.sql  # таблицы + RLS
.github/workflows/deploy.yml
```

## Формулы (аннуитет)

- Платёж: `P = S·r·(1+r)^n / ((1+r)^n − 1)`
- Срок: `n = ln(P / (P − S·r)) / ln(1+r)`
- Остаток после k платежей: `B(k) = S·(1+r)^k − P·((1+r)^k − 1)/r`

где `r = ставка/12/100` — месячная ставка.
