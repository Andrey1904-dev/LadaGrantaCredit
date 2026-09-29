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

**Email-подтверждение:** см. отдельный раздел
[«Регистрация: письма, лимиты и почта .ru»](#регистрация-письма-лимиты-и-почта-ru) —
там же лечение ошибки `email rate limit exceeded`.

Если ключи убрать из `.env` — приложение работает в локальном **демо-режиме**
(localStorage браузера). В демо-режиме регистрация и вход по email отключены:
на экране авторизации показывается предупреждение и кнопка входа в демо
(молчаливый вход в демо при попытке регистрации — это баг, он исправлен).

Типы схемы БД лежат в `src/types/database.types.ts` (формат `supabase gen types typescript`).

## Регистрация: письма, лимиты и почта .ru

### Симптом

При регистрации вместо аккаунта появляется ошибка:

```
email rate limit exceeded
```

…а завести аккаунт на `@mail.ru`, `@yandex.ru`, `@bk.ru` не получается вовсе.

### Причина

Ошибка приходит от Supabase, а не от приложения. Пока в проекте **включено
подтверждение email**, каждая регистрация = отправка письма, а письма шлёт
**встроенный отправитель Supabase**, у которого два жёстких ограничения
([документация Supabase](https://supabase.com/docs/guides/auth/rate-limits)):

| Ограничение встроенного отправителя | Что видит пользователь |
|---|---|
| **2 письма в час на весь проект** | `email rate limit exceeded` (429, `over_email_send_rate_limit`) |
| Письма только на адреса **участников команды** проекта | `Email address not authorized` — то есть чужой ящик (в том числе любой `.ru`) зарегистрировать нельзя |

Поднять лимит на тарифе Pro нельзя — он одинаковый на всех планах.
То есть «регистрация на .ru» ломается не из-за домена, а из-за того, что
письмо такому адресу встроенный отправитель просто не доставляет.

### Решение A — быстро: регистрация без писем (30 секунд)

Подтверждение email выключается, аккаунт создаётся мгновенно на **любой**
адрес — mail.ru, yandex.ru, bk.ru, list.ru, gmail.com, .рф.

Вариант 1 — Dashboard:
**Authentication → Sign In / Up → Email → выключить «Confirm email»**.

Вариант 2 — одной командой из репозитория:

```bash
# токен: https://supabase.com/dashboard/account/tokens (строка sbp_…)
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run supabase:auth -- --no-confirm
```

Скрипт [`scripts/supabase-auth-setup.mjs`](scripts/supabase-auth-setup.mjs)
выключает `mailer_autoconfirm` **и** разрешает вход тем, кто уже
зарегистрировался, но письма так и не дождался
(`mailer_allow_unverified_email_sign_ins`) — иначе такие аккаунты остаются
заблокированными навсегда.

Проверить текущее состояние проекта (без изменений):

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run supabase:auth
```

### Решение B — правильно: свой SMTP (письма остаются)

Свой SMTP снимает оба ограничения: письма уходят на любые адреса, лимит
поднимается до настраиваемого значения. Подойдёт Resend, Brevo, Unisender,
Postmark, AWS SES; для надёжной доставки в mail.ru/yandex.ru удобны
российские отправители (Unisender, Sendpulse) или Яндекс 360.

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run supabase:auth -- --smtp \
  --smtp-host smtp.resend.com --smtp-port 465 \
  --smtp-user resend --smtp-pass re_xxx \
  --smtp-from no-reply@ваш-домен.ru --smtp-name "LADA Кредит" \
  --rate-limit 100
```

И укажите, куда вести ссылки из писем (иначе подтверждение уводит на
`localhost`):

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run supabase:auth -- \
  --site-url https://andrey1904-dev.github.io/LadaGrantaCredit/
```

> Не забудьте про SPF/DKIM для домена отправителя — без них письма
> уезжают в «Спам» именно у mail.ru и yandex.ru.

### Что делает само приложение

Код не может изменить настройки чужого проекта, но делает всё остальное,
чтобы регистрация не ломалась на пустом месте:

- **любая почта принимается** — валидация не ограничивает доменные зоны:
  `.ru`, `.рф` (переводится в punycode), `.com`, `.by`, `.kz`;
- **чинит ввод** — лишние пробелы, `mailto:`, Caps Lock, запятая вместо точки,
  русская раскладка (`ivan@mаil.ru` с кириллической «а», `ivan@майл.ру`
  → `ivan@mail.ru`), подсказывает опечатки (`mail.ry` → `mail.ru`);
- **не тратит лимит писем** — локальный таймер 60 секунд между попытками
  (Supabase всё равно откажет) и понятный отсчёт на экране;
- **объясняет ошибку по-русски** вместо `email rate limit exceeded`, сразу
  показывая, что нужно сделать владельцу проекта;
- **не даёт застрять** — кнопки «Попробовать войти» (аккаунт мог создаться,
  даже если письмо не ушло) и «Отправить письмо ещё раз», ссылка на веб-почту;
- **предупреждает заранее** — если в проекте включено подтверждение email,
  на экране регистрации висит предупреждение (приложение узнаёт это через
  `GET /auth/v1/settings`);
- **не предлагает example.com** — тестовые домены Supabase отклоняет
  (`email_address_invalid`), поэтому подсказка в поле теперь `ivan@mail.ru`.

### Отладка без расхода лимита

Заглушка [`scripts/mock-supabase-auth.mjs`](scripts/mock-supabase-auth.mjs)
эмулирует Supabase Auth вместе с его лимитами — удобно проверять экран
регистрации, не тратя реальные 2 письма в час:

```bash
node scripts/mock-supabase-auth.mjs --port 5174   # --autoconfirm, --quota N, --not-authorized
# .env:
# VITE_SUPABASE_URL=http://localhost:5174
# VITE_SUPABASE_ANON_KEY=mock-anon-key
npm run dev
```

## Деплой на GitHub Pages

1. В настройках репозитория: **Settings → Pages → Source = GitHub Actions**.
2. Добавьте секрет `VITE_SUPABASE_ANON_KEY` в
   **Settings → Secrets and variables → Actions → вкладка Secrets → New repository secret**:
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Secret: publishable (anon) ключ проекта —
     Supabase Dashboard → Project Settings → API → Project API keys → `anon` / `publishable`
     (длинная строка, начинается с `eyJ…`)

   `VITE_SUPABASE_URL` задавать не обязательно: если секрета нет, workflow
   использует адрес проекта по умолчанию (`https://dcgurmwvpgzmlfivxoso.supabase.co`,
   он публичный). Хотите переопределить — создайте секрет/variable `VITE_SUPABASE_URL`;
   anon-ключ тоже можно положить во вкладку **Variables** — workflow смотрит оба места.

   > ⚠️ Именно **New repository secret** в разделе «Secrets and variables».
   > Раздел **Settings → Environments** — это другое: секреты внутри окружений
   > не появляются в списке секретов и **не видны job'у сборки**, из-за чего
   > деплой уйдёт в демо-режим (или упадёт на проверке ключей).

   Без ключей деплой **упадёт с понятной ошибкой** (шаг «Проверить ключи Supabase»),
   чтобы на Pages не опубликовалась сборка без работающей регистрации.
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
