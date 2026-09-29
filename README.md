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

### Подключение Supabase (опционально)

Без ключей приложение работает в **демо-режиме** (данные — в localStorage браузера).
Для полноценной работы:

1. Создайте проект на [supabase.com](https://supabase.com).
2. Выполните SQL из [`supabase/schema.sql`](supabase/schema.sql) в SQL Editor
   (таблицы `profiles`, `cars`, `loans`, `transactions`, `maintenance` + RLS-политики).
3. Скопируйте `.env.example` в `.env` и подставьте ключи
   (Project Settings → API):

   ```env
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-public-key>
   ```

4. Для входа без подтверждения почты отключите
   Authentication → Providers → Email → **Confirm email**.

Типы схемы БД лежат в `src/types/database.types.ts` (формат `supabase gen types typescript`).

## Деплой на GitHub Pages

1. В настройках репозитория: **Settings → Pages → Source = GitHub Actions**.
2. (Опционально) Добавьте секреты `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`
   в **Settings → Secrets and variables → Actions**.
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
