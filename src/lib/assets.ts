/**
 * Каталог фотографий LADA Granta Sport.
 *
 * Исходные кадры владельца (`hero`, `detail`, `black`, `white`) дополнены
 * серией кадров, снятых «в тон» этим референсам, — по одному на раздел
 * приложения, чтобы вкладки визуально не повторялись:
 *
 *   Главная  → трасса на рассвете      (granta-sport-road)
 *   Кредит   → автосалон ночью         (granta-sport-credit)
 *   Расходы  → АЗС в сумерках          (granta-sport-fuel)
 *   ТО       → подъёмник в сервисе     (granta-sport-service)
 *   Гараж    → частный гараж           (granta-sport-garage)
 *
 * У каждого кадра есть WebP-версия (`npm run images`), которая
 * подставляется автоматически через `data-webp-src`.
 */

export type GrantaFinish = 'black' | 'white'

export interface GrantaAssetMeta {
  /** Путь к WebP-версии (подставляется, если браузер её поддерживает) */
  webp: string
  /** Фактический путь файла в репозитории */
  src: string
  /** Содержательный alt-текст (или пустой для декоративной подложки) */
  alt: string
}

const asset = (name: string, ext: 'jpg' | 'png', alt: string): GrantaAssetMeta => ({
  webp: `./images/${name}.webp`,
  src: `./images/${name}.${ext}`,
  alt,
})

export const GRANTA_ASSETS = {
  /** Серая Granta Sport на мосту, ракурс 3/4 (референс владельца) */
  hero: asset('granta-sport-hero', 'jpg', 'Серая LADA Granta Sport на мосту, ракурс 3/4 спереди'),
  /** Крупный план шильдика SPORT на тёмной решётке радиатора */
  detail: asset(
    'granta-sport-detail',
    'jpg',
    'Крупный план шильдика SPORT на чёрной решётке радиатора LADA Granta Sport',
  ),
  /** Белая Granta Sport (выбор исполнения кузова) */
  white: asset('granta-sport-white', 'png', 'Белая LADA Granta Sport в студийном ракурсе 3/4'),
  /** Чёрная Granta Sport (выбор исполнения кузова) */
  black: asset('granta-sport-black', 'png', 'Чёрная LADA Granta Sport в студийном ракурсе 3/4'),
  /** Главная: трасса на рассвете */
  road: asset(
    'granta-sport-road',
    'jpg',
    'LADA Granta Sport на городской трассе на рассвете, вид 3/4 спереди',
  ),
  /** Кредит: автосалон ночью */
  credit: asset(
    'granta-sport-credit',
    'jpg',
    'LADA Granta Sport у стеклянного автосалона ночью, мокрый асфальт',
  ),
  /** Расходы: заправка в сумерках */
  fuel: asset(
    'granta-sport-fuel',
    'jpg',
    'LADA Granta Sport на заправке в сумерках, пистолет в горловине бака',
  ),
  /** ТО: автомобиль на подъёмнике в сервисе */
  service: asset(
    'granta-sport-service',
    'jpg',
    'LADA Granta Sport на двухстоечном подъёмнике в сервисной зоне с открытым капотом',
  ),
  /** Гараж: частный бокс с тёплым светом */
  garage: asset(
    'granta-sport-garage',
    'jpg',
    'LADA Granta Sport в частном гараже под тёплой лампой, рядом комплект шин',
  ),
} as const

export type GrantaAssetKey = keyof typeof GRANTA_ASSETS

/** Кадр-обложка и подпись для каждой вкладки приложения */
export const PAGE_MEDIA = {
  dashboard: { asset: GRANTA_ASSETS.road, caption: 'Трасса · утро' },
  credit: { asset: GRANTA_ASSETS.credit, caption: 'Автосалон · ночь' },
  expenses: { asset: GRANTA_ASSETS.fuel, caption: 'АЗС · сумерки' },
  service: { asset: GRANTA_ASSETS.service, caption: 'Сервис · подъёмник' },
  garage: { asset: GRANTA_ASSETS.garage, caption: 'Гараж · бокс' },
  auth: { asset: GRANTA_ASSETS.hero, caption: 'Мост · закат' },
} as const

const FINISH_STORAGE_KEY = 'lgc_granta_finish'

export function getSavedFinish(): GrantaFinish {
  try {
    const v = localStorage.getItem(FINISH_STORAGE_KEY)
    return v === 'white' ? 'white' : 'black'
  } catch {
    return 'black'
  }
}

export function setSavedFinish(finish: GrantaFinish): void {
  try {
    localStorage.setItem(FINISH_STORAGE_KEY, finish)
    window.dispatchEvent(new CustomEvent('lgc-finish-change', { detail: finish }))
  } catch {
    /* ignore storage errors */
  }
}

/** Умеет ли браузер показывать WebP — иначе оставляем JPEG/PNG из `src`. */
function supportsWebp(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

function upgradeToWebp(img: HTMLImageElement): void {
  const webp = img.getAttribute('data-webp-src')
  if (!webp || img.dataset.webpApplied === '1') return
  img.dataset.webpApplied = '1'
  img.srcset = webp
  img.src = webp
}

/**
 * Подставляет WebP-версии картинок Granta вместо JPEG/PNG.
 *
 * В разметке у каждого кадра объявлен `data-webp-src`; файлы `.webp`
 * генерируются скриптом `npm run images` (см. scripts/prepare-images.mjs).
 * Страницы монтируются лениво, поэтому кроме стартовой разметки следим
 * за DOM. Внешний вид при этом не меняется — меняется только формат файла.
 */
export function enableWebpAssets(): void {
  if (typeof document === 'undefined' || !supportsWebp()) return
  document
    .querySelectorAll<HTMLImageElement>('img[data-webp-src]')
    .forEach(upgradeToWebp)
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) {
          upgradeToWebp(node)
        } else if (node instanceof Element) {
          node.querySelectorAll<HTMLImageElement>('img[data-webp-src]').forEach(upgradeToWebp)
        }
      })
    }
  }).observe(document.body, { childList: true, subtree: true })
}
