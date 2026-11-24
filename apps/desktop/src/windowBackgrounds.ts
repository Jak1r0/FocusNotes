const backgroundPath = `${import.meta.env.BASE_URL}backgrounds/`

export const WINDOW_BACKGROUND_GROUPS = [
  { id: 'system', label: null },
  { id: 'abstract', label: '抽象' },
  { id: 'nature', label: '自然风光' },
] as const

export const WINDOW_BACKGROUNDS = [
  { id: 'default', label: '默认', group: 'system', image: null },
  { id: 'desktop', label: '桌面壁纸', group: 'system', image: null },
  { id: 'rain-city', label: '雨后的城', group: 'abstract', image: `${backgroundPath}rain-city.jpg` },
  { id: 'embers', label: '余火', group: 'abstract', image: `${backgroundPath}embers.jpg` },
  { id: 'moss', label: '苔痕', group: 'abstract', image: `${backgroundPath}moss.jpg` },
  { id: 'mist-valley', label: '晨雾山谷', group: 'nature', image: `${backgroundPath}mist-valley.jpg` },
  { id: 'overcast-coast', label: '阴天海岸', group: 'nature', image: `${backgroundPath}overcast-coast.jpg` },
  { id: 'woods-light', label: '林间微光', group: 'nature', image: `${backgroundPath}woods-light.jpg` },
] as const

export type WindowBackgroundId = typeof WINDOW_BACKGROUNDS[number]['id']

export function resolveWindowBackground(id: string | null) {
  return WINDOW_BACKGROUNDS.find((background) => background.id === id) ?? WINDOW_BACKGROUNDS[0]
}
