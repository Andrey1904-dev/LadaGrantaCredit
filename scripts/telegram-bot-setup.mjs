/**
 * Настройка Telegram-бота LADA Assistant для Supabase Edge Function.
 *
 * Что делает скрипт:
 *   1. (по желанию, --deploy) разворачивает функцию telegram-api и секреты через Supabase CLI;
 *   2. ставит webhook Telegram на адрес функции со случайным секретом;
 *   3. обновляет описание, команды и кнопку меню бота;
 *   4. проверяет GET /health и печатает переменные для GitHub Actions.
 *
 * Пример:
 *   TELEGRAM_BOT_TOKEN=123:AA... SUPABASE_ACCESS_TOKEN=sbp_... \
 *     node scripts/telegram-bot-setup.mjs --deploy
 *
 * Без --deploy скрипт только настраивает уже развёрнутую функцию:
 *   TELEGRAM_BOT_TOKEN=123:AA... node scripts/telegram-bot-setup.mjs --check
 *
 * Токен бота передавайте только через переменные окружения: в браузерную
 * сборку (VITE_*) он попадать не должен.
 */
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const value = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const projectRefFromConfig = () => {
  try {
    const config = readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8')
    return /^\s*project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1] ?? ''
  } catch {
    return ''
  }
}

const projectRef =
  value('--project-ref') ||
  (process.env.SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ||
  projectRefFromConfig()

const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
const webAppUrl = (value('--webapp-url') || process.env.WEB_APP_URL || 'https://andrey1904-dev.github.io/LadaGrantaCredit/').trim()
const functionUrl = (value('--api-url') || process.env.TELEGRAM_API_URL || (projectRef ? `https://${projectRef}.supabase.co/functions/v1/telegram-api` : '')).replace(/\/+$/, '')
const webhookSecret = (value('--secret') || process.env.TELEGRAM_WEBHOOK_SECRET || randomBytes(24).toString('hex')).trim()

if (!botToken || !/^\d{6,12}:[A-Za-z0-9_-]{25,}$/.test(botToken)) {
  console.error('Не задан TELEGRAM_BOT_TOKEN (ожидается токен из @BotFather).')
  process.exit(1)
}
if (!functionUrl.startsWith('https://')) {
  console.error('Нужен публичный HTTPS-адрес функции: укажите --api-url или SUPABASE_URL/--project-ref.')
  process.exit(1)
}

const api = async (method, payload = {}, timeoutMs = 20_000) => {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.ok) {
    throw new Error(`Telegram ${method}: ${data?.description ?? `HTTP ${response.status}`}`)
  }
  return data.result
}

const run = (command, commandArgs, env = {}) => {
  console.log(`$ ${command} ${commandArgs.join(' ')}`)
  execFileSync(command, commandArgs, { stdio: 'inherit', cwd: root, env: { ...process.env, ...env } })
}

if (flag('--deploy')) {
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.error('Для --deploy нужен SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens).')
    process.exit(1)
  }
  run('npx', ['--yes', 'supabase', 'secrets', 'set',
    `TELEGRAM_BOT_TOKEN=${botToken}`,
    `TELEGRAM_WEBHOOK_SECRET=${webhookSecret}`,
    `WEB_APP_URL=${webAppUrl}`,
    '--project-ref', projectRef,
  ])
  run('npx', ['--yes', 'supabase', 'functions', 'deploy', 'telegram-api', '--project-ref', projectRef])
}

const bot = await api('getMe')
console.log(`\nБот: @${bot.username}`)

await api('setMyDescription', {
  description:
    'Персональный помощник владельца LADA Granta Sport. Сводки об автомобиле, ТО, расходах и автокредите — из вашего личного кабинета. Безопасное подключение по одноразовому коду.',
})
await api('setMyShortDescription', { short_description: 'Цифровой гараж LADA: автомобиль, ТО, расходы и кредит.' })
await api('setChatMenuButton', { menu_button: { type: 'commands' } })
await api('setMyCommands', {
  commands: [
    { command: 'start', description: 'Главное меню' },
    { command: 'link', description: 'Подключить личный кабинет' },
    { command: 'garage', description: 'Автомобиль и ОСАГО' },
    { command: 'service', description: 'ТО и документы' },
    { command: 'spending', description: 'Расходы за месяц' },
    { command: 'credit', description: 'Остаток и платёж по кредиту' },
    { command: 'unlink', description: 'Отключить личный кабинет' },
    { command: 'help', description: 'Список команд' },
  ],
})
await api('setWebhook', {
  url: functionUrl,
  secret_token: webhookSecret,
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: true,
})
console.log(`Webhook: ${functionUrl}`)

const info = await api('getWebhookInfo')
if (info.last_error_message) console.warn(`Внимание, Telegram сообщает об ошибке вебхука: ${info.last_error_message}`)

try {
  const response = await fetch(`${functionUrl}/health`, { headers: { 'Cache-Control': 'no-cache' } })
  const health = await response.json().catch(() => null)
  console.log(`Health: ${response.status} ${JSON.stringify(health)}`)
  if (!response.ok) {
    console.warn('Функция отвечает не 200: проверьте секреты TELEGRAM_BOT_TOKEN и развёртывание telegram-api.')
  }
} catch (error) {
  console.warn(`Не удалось проверить ${functionUrl}/health: ${error instanceof Error ? error.message : error}`)
}

console.log(`
Готово. Проверьте переменные репозитория GitHub:
  Settings → Secrets and variables → Actions → Variables
    VITE_TELEGRAM_BOT_USERNAME = ${bot.username}
    VITE_TELEGRAM_API_URL      = ${functionUrl}

Токен бота (${botToken.slice(0, 10)}…) храните только в секретах: он уже зашит в webhook-подпись Telegram.
Если токен когда-либо попадал в VITE_* или в сборку сайта — отзовите его командой /revoke в @BotFather,
затем снова запустите этот скрипт.
`)
