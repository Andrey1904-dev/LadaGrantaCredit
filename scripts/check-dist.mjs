/**
 * Проверка production-сборки (dist/) после `vite build`.
 *
 *   • в клиентских артефактах нет токена бота, service-role ключа Supabase и
 *     прямых вызовов Bot API (Telegram API из браузера с токеном не вызывается);
 *   • в коде приложения и index.html нет абсолютных адресов localhost/127.0.0.1
 *     и HTTP-ресурсов (смешанный контент в Telegram WebView запрещён);
 *   • Service Worker не регистрируется (новый SW/PWA в задачу не входит);
 *   • статические JS/CSS имеют хеш в имени (кэш index.html не «залипает»);
 *   • интеграция Telegram Mini App попала в сборку.
 *
 * Запуск: node scripts/check-dist.mjs (после npm run build)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(here, '..', 'dist')

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html не найден: сначала выполните npm run build.')
  process.exit(1)
}

const files = []
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(html|js|css|json|txt|map|webmanifest)$/.test(entry.name)) files.push(full)
  }
}
walk(dist)

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${!ok && detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

const read = (file) => fs.readFileSync(file, 'utf8')
const rel = (file) => path.relative(dist, file)
const all = files.map((file) => ({ file, text: read(file) }))
// Код приложения (не vendor-чанки react/supabase/charts с внутренними дефолтами библиотек).
const appFiles = all.filter(({ file }) => /index\.html$|assets[\\/]index-[^\\/]+\.js$/.test(file))

const TOKEN_RE = /\b\d{6,12}:AA[A-Za-z0-9_-]{30,}\b/
const hits = (list, re) => list.filter(({ text }) => re.test(text)).map(({ file }) => rel(file))

check('нет токена Telegram-бота', hits(all, TOKEN_RE).length === 0, hits(all, TOKEN_RE).join(', '))
check('нет прямых вызовов Bot API (api.telegram.org/bot…)', hits(all, /api\.telegram\.org\/bot/).length === 0, hits(all, /api\.telegram\.org\/bot/).join(', '))

// JWT в бандле допустим только с ролью anon (publishable ключ).
const jwtRoles = []
for (const { file, text } of all) {
  for (const [token] of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
      jwtRoles.push({ file: rel(file), role: payload.role })
    } catch {
      /* не JWT */
    }
  }
}
const privileged = jwtRoles.filter(({ role }) => role && role !== 'anon')
check('нет service-role и других привилегированных ключей Supabase', privileged.length === 0, JSON.stringify(privileged))
check('нет секретных ключей Supabase нового формата (sb_secret_)', hits(all, /sb_secret_[A-Za-z0-9_-]{16,}/).length === 0, hits(all, /sb_secret_[A-Za-z0-9_-]{16,}/).join(', '))

const LOCAL_RE = /(?:https?:)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/
check('в коде приложения нет абсолютных адресов localhost/127.0.0.1', hits(appFiles, LOCAL_RE).length === 0, hits(appFiles, LOCAL_RE).join(', '))

const html = read(path.join(dist, 'index.html'))
const httpRefs = [...html.matchAll(/(?:src|href)=["'](http:\/\/[^"']+)/g)].map((m) => m[1])
check('index.html не подключает HTTP-ресурсы', httpRefs.length === 0, httpRefs.join(', '))

check('Service Worker не регистрируется', hits(all, /serviceWorker\s*\.\s*register/).length === 0, hits(all, /serviceWorker\s*\.\s*register/).join(', '))

const assets = fs.readdirSync(path.join(dist, 'assets')).filter((name) => /\.(js|css)$/.test(name))
const unhashed = assets.filter((name) => !/-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(name))
check('JS/CSS-ресурсы с хешем в имени', assets.length > 0 && unhashed.length === 0, unhashed.join(', '))

check('интеграция Telegram Mini App в сборке', hits(appFiles, /telegram\.org\/js\/telegram-web-app\.js/).length > 0)
check('SDK не подключается блокирующим <script> в index.html', !/<script[^>]+telegram-web-app\.js/.test(html))

console.log(failed === 0 ? '\nПроверка dist: все проверки пройдены.' : `\nПроверка dist: провалено проверок — ${failed}.`)
process.exit(failed === 0 ? 0 : 1)
