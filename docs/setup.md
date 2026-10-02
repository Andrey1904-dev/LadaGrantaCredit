# Настройка и эксплуатация

Документ для владельца репозитория: подключение бэкенда, регистрация и почта,
развёртывание Telegram-бота и публикация сайта. В [README](../README.md) эти шаги
намеренно не дублируются.

---

## 1. База данных Supabase

Проект уже подключён к Supabase (`.env` содержит `VITE_SUPABASE_URL` и
`VITE_SUPABASE_ANON_KEY`; файл не коммитится).

**Осталось применить схему БД (одно действие, ~1 минута):**

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/project/dcgurmwvpgzmlfivxoso/sql/new)
   → **SQL Editor** → New query.
2. Вставьте содержимое [`supabase/schema.sql`](../supabase/schema.sql) и нажмите **Run**.
3. Готово: таблицы `profiles`, `cars`, `loans`, `transactions`, `maintenance`
   с RLS-политиками и триггером профиля созданы. Приложение подхватит их
   автоматически (в шапке есть кнопка «Повторить»).

> ⚠️ DDL нельзя выполнить через publishable-ключ — только владелец проекта
> в Dashboard (или через `psql`/Management API). Publishable/anon-ключи
> по задумке Supabase имеют доступ только к данным, не к схеме.

**Email-подтверждение:** см. отдельный раздел
[«Регистрация: письма, лимиты и почта .ru»](#2-регистрация-письма-лимиты-и-почта-ru) —
там же лечение ошибки `email rate limit exceeded`.

## 2. Регистрация: письма, лимиты и почта .ru

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

Скрипт [`scripts/supabase-auth-setup.mjs`](../scripts/supabase-auth-setup.mjs)
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

Заглушка [`scripts/mock-supabase-auth.mjs`](../scripts/mock-supabase-auth.mjs)
эмулирует Supabase Auth вместе с его лимитами — удобно проверять экран
регистрации, не тратя реальные 2 письма в час:

```bash
node scripts/mock-supabase-auth.mjs --port 5174   # --autoconfirm, --quota N, --not-authorized
# .env:
# VITE_SUPABASE_URL=http://localhost:5174
# VITE_SUPABASE_ANON_KEY=mock-anon-key
npm run dev
```

## 3. Telegram-бот: развёртывание

### Шаг 1. База и бот

1. Примените `supabase/schema.sql`, затем **отдельно** [`supabase/telegram.sql`](../supabase/telegram.sql) в Supabase SQL Editor. Вторая схема добавляет таблицы связей и одноразовых кодов; у `anon` и `authenticated` намеренно нет RLS-политик на эти таблицы.
2. Создайте бота в [@BotFather](https://t.me/BotFather), сохраните username и токен. Для аватара — `/setuserpic` и `public/images/telegram-assistant-avatar.jpg`.

### Шаг 2. Разверните API бота (любой из вариантов)

**Вариант A — Supabase Edge Function (рекомендуется для GitHub Pages).**

```bash
npx supabase login
TELEGRAM_BOT_TOKEN=123456:AA... SUPABASE_ACCESS_TOKEN=sbp_... \
WEB_APP_URL=https://andrey1904-dev.github.io/LadaGrantaCredit/ \
  node scripts/telegram-bot-setup.mjs --deploy
```

Скрипт развернёт функцию `telegram-api` (в [`supabase/config.toml`](../supabase/config.toml) у неё `verify_jwt = false`: JWT проверяет сама функция), положит секреты `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `WEB_APP_URL`, поставит webhook, обновит описание и команды, поставит кнопку меню **Telegram Mini App** (`web_app`) и проверит `/health`. `WEB_APP_URL` обязателен (публичный HTTPS-адрес сайта), значения по умолчанию в коде нет. Без `--deploy` скрипт только перенастраивает уже развёрнутую функцию; `npm run bot:menu` меняет одну кнопку меню. Токен и секрет вебхука в выводе маскируются.

Вручную: `npx supabase functions deploy telegram-api --project-ref <ref>`, затем `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ref>.supabase.co/functions/v1/telegram-api&secret_token=<ваш-секрет>`. Webhook принимается на корне функции и на `/telegram` — обязательно с заголовком `X-Telegram-Bot-Api-Secret-Token`.

**Вариант B — Node.js-сервис (long polling).**

1. Скопируйте `bot/.env.example` в `bot/.env` и заполните: `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (**только на сервере**), `WEB_APP_URL` (адрес кабинета) и `CORS_ALLOWED_ORIGINS` при необходимости.
2. Разверните постоянный web service (Node 20.6+, рекомендуется Node 22) из корня репозитория: install — `npm ci`, start — `npm run bot:start`. Переменные перенесите в секреты хостинга; процесс слушает `0.0.0.0:$PORT` (по умолчанию `3001`) и требует, чтобы хостинг не усыплял процесс. Держите один polling-инстанс на токен.
3. Локально: `npm run bot:local` (читает `bot/.env`).

### Шаг 3. Переменные сайта

В **Settings → Secrets and variables → Actions → Variables**:

```dotenv
VITE_TELEGRAM_BOT_USERNAME=LadaGarage_bot
VITE_TELEGRAM_API_URL=https://<project-ref>.supabase.co/functions/v1/telegram-api
```

Локально в `.env.local` можно оставить относительный `/telegram-api`: Vite проксирует его на серверный порт `3001` (браузер не обращается к `localhost` напрямую). Для задеплоенного сайта относительный путь **не работает** — там нужен полный HTTPS-адрес.

> ⚠️ **Токен BotFather не место в `VITE_*`.** Vite подставляет значения этих переменных в открытый JS-бандл, поэтому токен из сборки может забрать любой посетитель. Токен хранится только в секретах сервиса бота (`bot/.env`, секреты Supabase, переменные хостинга). Если токен уже попадал в сборку — отзовите его командой `/revoke` в @BotFather и запустите `scripts/telegram-bot-setup.mjs` заново.

### Шаг 4. Привязка аккаунта

На сайте откройте раздел **Бот**, в Telegram отправьте `/link`, введите одноразовый код в кабинете. Отключить доступ можно на сайте или командой `/unlink`.

### Если раздел «Бот» показывает ошибку

| Симптом | Что произошло | Что делать |
| --- | --- | --- |
| `Не удалось связаться с ботом (405)` | `VITE_TELEGRAM_API_URL` не является адресом API (например, относительный путь) — браузер отправлял запрос на домен самого сайта, а GitHub Pages отвечает 405 на POST/DELETE | укажите HTTPS-адрес API бота и пересоберите сайт |
| `API бота не найден … (404)` | адрес указан верно, но функция/сервис не развёрнуты | разверните `telegram-api` (шаг 2) |
| «Интеграция ещё не настроена» | переменные не заданы или неверны | заполните переменные из шага 3 — панель подскажет конкретную причину |
| `Состояние polling: degraded` | Node-сервис не получает обновления | проверьте `TELEGRAM_BOT_TOKEN` и что процесс не усыпляется хостингом |
| `/health` отвечает 503 в режиме webhook | webhook не установлен или Telegram сообщает об ошибке | `node scripts/telegram-bot-setup.mjs` (без `--deploy`) |

Unit-тесты форматов, расчётов и общей логики бота входят в `npm test` (или `npm run bot:test`); контракт Edge Function и настройки раздела «Бот» проверяют `node scripts/smoke-telegram-api.mjs` и `node scripts/smoke-telegram-config.mjs` (оба входят в `npm run smoke`).

## 4. Деплой на GitHub Pages

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

   > Добавляйте публичные `VITE_*` именно как **Repository variables** в
   > **Settings → Secrets and variables → Actions → Variables**. Переменные,
   > созданные внутри GitHub Environment, доступны только job'ам, назначенным
   > на это конкретное окружение; сборочный job использует repository-level
   > variables и не подключён к окружению `github-pages`.
3. Откройте PR в `main` — workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
   запустит `npm run check` (типы, 59 основных + 7 Telegram-тестов, smoke-проверки и сборка),
   но не будет публиковать Preview. После слияния в `main` те же проверки пройдут повторно,
   `dist` соберётся с `base: '/LadaGrantaCredit/'` и опубликуется на Pages.
   GitHub Actions используют Node 24-compatible релизы и закреплённый runner
   `ubuntu-24.04`, чтобы не получать предупреждения о runtime и миграции `ubuntu-latest`.

---

Мини-приложение Telegram (кнопка меню, deep links, матрица ручной приёмки) —
в [telegram-mini-app.md](telegram-mini-app.md).
