/**
 * Каталог фотографий дуэта 2026 модельного года: LADA Granta Sport и LADA Vesta Sport.
 *
 * В кадре — только актуальные спортивные версии 2026 модельного года и только два
 * разрешённых цвета кузова: чёрный и белый. Старых моделей и других цветов быть
 * не должно. По одному кадру на раздел приложения, чтобы вкладки визуально не
 * повторялись:
 *
 *   Вход     → дуэт Sport 2026 на мосту на закате    (lada-duo-hero)
 *   Главная  → дуэт Sport 2026 на трассе на рассвете (lada-duo-road)
 *   Кредит   → дуэт Sport 2026 у автосалона LADA     (lada-duo-credit)
 *   Расходы  → дуэт Sport 2026 на АЗС в сумерках     (lada-duo-fuel)
 *   ТО       → дуэт Sport 2026 в сервисе             (lada-duo-service)
 *   Гараж    → дуэт Sport 2026 в частном гараже      (lada-duo-garage)
 *
 * Деталь — макро шильдиков «GRANTA SPORT | VESTA SPORT» (lada-duo-detail) —
 * используется в пустых состояниях и карточках-ссылках.
 *
 * Полноформатные кадры «домашний гараж с красной LED-подсветкой» —
 * lada-duo-garage-granta (Granta Sport 2026 в фокусе, Vesta Sport 2026 сзади) и
 * lada-duo-garage-vesta (Vesta Sport 2026 в фокусе, Granta Sport 2026 сзади):
 * обе машины всегда в кадре, переключатель лишь выбирает, какая из них ваша.
 *
 * У каждого кадра есть WebP-версия (`npm run images`), которая
 * подставляется автоматически через `data-webp-src`.
 */

/** Какая из двух машин — «ваша»: влияет на фокус в гаражных кадрах */
export type DuoModel = 'granta' | 'vesta'

export interface DuoAssetMeta {
  /** Путь к WebP-версии (подставляется, если браузер её поддерживает) */
  webp: string
  /** Фактический путь файла в репозитории */
  src: string
  /** Содержательный alt-текст (или пустой для декоративной подложки) */
  alt: string
}

const asset = (name: string, alt: string): DuoAssetMeta => ({
  webp: `./images/${name}.webp`,
  src: `./images/${name}.jpg`,
  alt,
})

export const LADA_DUO_ASSETS = {
  /** Вход: чёрная Granta Sport и белая Vesta Sport (2026) на мосту, закат */
  hero: asset(
    'lada-duo-hero',
    'Чёрная LADA Granta Sport 2026 и белая LADA Vesta Sport 2026 рядом на мосту на закате, ракурс 3/4 спереди',
  ),
  /** Макро шильдиков «GRANTA SPORT» и «VESTA SPORT» на чёрной крышке багажника */
  detail: asset(
    'lada-duo-detail',
    'Крупный план хромированных шильдиков GRANTA SPORT и VESTA SPORT на глянцево-чёрной крышке багажника',
  ),
  /** Главная: дуэт на городской трассе на рассвете */
  road: asset(
    'lada-duo-road',
    'Чёрная LADA Granta Sport 2026 и белая LADA Vesta Sport 2026 идут дуэтом по городской трассе на рассвете',
  ),
  /** Кредит: дуэт у стеклянного автосалона ночью */
  credit: asset(
    'lada-duo-credit',
    'Чёрная LADA Granta Sport 2026 и белая LADA Vesta Sport 2026 у стеклянного автосалона LADA ночью, мокрый асфальт',
  ),
  /** Расходы: дуэт на заправке в сумерках */
  fuel: asset(
    'lada-duo-fuel',
    'Чёрная LADA Granta Sport 2026 и белая LADA Vesta Sport 2026 на соседних колонках АЗС в сумерках, пистолет в горловине бака',
  ),
  /** ТО: Granta Sport 2026 на подъёмнике, Vesta Sport 2026 с открытым капотом */
  service: asset(
    'lada-duo-service',
    'Чёрная LADA Granta Sport 2026 на двухстоечном подъёмнике и белая LADA Vesta Sport 2026 с открытым капотом в сервисной зоне',
  ),
  /** Гараж: частный бокс с тёплым светом, обе машины */
  garage: asset(
    'lada-duo-garage',
    'Чёрная LADA Granta Sport 2026 и белая LADA Vesta Sport 2026 в частном гараже под тёплой лампой, рядом комплект шин',
  ),
  /** Гараж с LED-подсветкой: чёрная Granta Sport 2026 в фокусе, белая Vesta Sport 2026 сзади */
  garageGranta: asset(
    'lada-duo-garage-granta',
    'Чёрная LADA Granta Sport 2026 в фокусе и белая LADA Vesta Sport 2026 сзади в тёмном гараже с красной LED-подсветкой',
  ),
  /** Гараж с LED-подсветкой: белая Vesta Sport 2026 в фокусе, чёрная Granta Sport 2026 сзади */
  garageVesta: asset(
    'lada-duo-garage-vesta',
    'Белая LADA Vesta Sport 2026 в фокусе и чёрная LADA Granta Sport 2026 сзади в тёмном гараже с красной LED-подсветкой',
  ),
} as const

export type DuoAssetKey = keyof typeof LADA_DUO_ASSETS

/** Кадр-обложка и подпись для каждой вкладки приложения */
export const PAGE_MEDIA = {
  dashboard: { asset: LADA_DUO_ASSETS.road, caption: 'Трасса · утро' },
  credit: { asset: LADA_DUO_ASSETS.credit, caption: 'Автосалон · ночь' },
  expenses: { asset: LADA_DUO_ASSETS.fuel, caption: 'АЗС · сумерки' },
  service: { asset: LADA_DUO_ASSETS.service, caption: 'Сервис · подъёмник' },
  garage: { asset: LADA_DUO_ASSETS.garage, caption: 'Гараж · бокс' },
  auth: { asset: LADA_DUO_ASSETS.hero, caption: 'Мост · закат' },
} as const

const MODEL_STORAGE_KEY = 'lgc_duo_model'

/** Сохранённая модель владельца; по умолчанию показываем Granta в фокусе */
export function getSavedModel(): DuoModel {
  try {
    const v = localStorage.getItem(MODEL_STORAGE_KEY)
    return v === 'vesta' ? 'vesta' : 'granta'
  } catch {
    return 'granta'
  }
}

export function setSavedModel(model: DuoModel): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, model)
    window.dispatchEvent(new CustomEvent('lgc-model-change', { detail: model }))
  } catch {
    /* ignore storage errors */
  }
}

/** Умеет ли браузер показывать WebP — иначе оставляем JPEG из `src`. */
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
 * Подставляет WebP-версии картинок дуэта вместо JPEG.
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
