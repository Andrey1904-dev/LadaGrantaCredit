/**
 * Каталог фотографий дуэта LADA Granta + LADA Vesta.
 *
 * Кабинет больше не «только Гранта»: каждый кадр снят с ДВУМЯ машинами —
 * Granta и Vesta всегда в кадре вместе, чтобы визуал подходил владельцам
 * обеих моделей. По одному кадру на раздел приложения, чтобы вкладки
 * визуально не повторялись:
 *
 *   Вход     → две машины на мосту на закате   (lada-duo-hero)
 *   Главная  → дуэт на трассе на рассвете      (lada-duo-road)
 *   Кредит   → дуэт у автосалона ночью         (lada-duo-credit)
 *   Расходы  → дуэт на АЗС в сумерках          (lada-duo-fuel)
 *   ТО       → дуэт в сервисе, одна на подъёмнике (lada-duo-service)
 *   Гараж    → дуэт в частном гараже           (lada-duo-garage)
 *
 * Деталь — макро двух шильдиков «GRANTA | VESTA» (lada-duo-detail) —
 * используется в пустых состояниях и карточках-ссылках.
 *
 * Полноформатные кадры «домашний гараж с красной LED-подсветкой» —
 * lada-duo-garage-granta (Granta в фокусе, Vesta сзади) и
 * lada-duo-garage-vesta (Vesta в фокусе, Granta сзади): обе машины
 * всегда в кадре, переключатель лишь выбирает, какая из них ваша.
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
  /** Вход: Granta и Vesta рядом на мосту, закат (референс старого hero-кадра) */
  hero: asset(
    'lada-duo-hero',
    'LADA Granta и LADA Vesta рядом на мосту на закате, ракурс 3/4 спереди',
  ),
  /** Макро двух шильдиков «GRANTA | VESTA» на тёмной крышке багажника */
  detail: asset(
    'lada-duo-detail',
    'Крупный план хромированных шильдиков GRANTA и VESTA на тёмной крышке багажника',
  ),
  /** Главная: дуэт на городской трассе на рассвете */
  road: asset(
    'lada-duo-road',
    'LADA Granta и LADA Vesta идут tandem по городской трассе на рассвете',
  ),
  /** Кредит: дуэт у стеклянного автосалона ночью */
  credit: asset(
    'lada-duo-credit',
    'LADA Granta и LADA Vesta у стеклянного автосалона ночью, мокрый асфальт',
  ),
  /** Расходы: дуэт на заправке в сумерках */
  fuel: asset(
    'lada-duo-fuel',
    'LADA Granta и LADA Vesta на соседних колонках АЗС в сумерках, пистолет в горловине бака',
  ),
  /** ТО: Granta на подъёмнике, Vesta с открытым капотом */
  service: asset(
    'lada-duo-service',
    'LADA Granta на двухстоечном подъёмнике и LADA Vesta с открытым капотом в сервисной зоне',
  ),
  /** Гараж: частный бокс с тёплым светом, обе машины */
  garage: asset(
    'lada-duo-garage',
    'LADA Granta и LADA Vesta в частном гараже под тёплой лампой, рядом комплект шин',
  ),
  /** Гараж с LED-подсветкой: чёрная Granta в фокусе, белая Vesta сзади */
  garageGranta: asset(
    'lada-duo-garage-granta',
    'Чёрная LADA Granta в фокусе и белая LADA Vesta сзади в тёмном гараже с красной LED-подсветкой',
  ),
  /** Гараж с LED-подсветкой: белая Vesta в фокусе, чёрная Granta сзади */
  garageVesta: asset(
    'lada-duo-garage-vesta',
    'Белая LADA Vesta в фокусе и чёрная LADA Granta сзади в тёмном гараже с красной LED-подсветкой',
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
