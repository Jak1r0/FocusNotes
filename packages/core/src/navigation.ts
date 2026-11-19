/** 参与左右滑动切换的页面（设置页 data 不参与）。顺序即 PagerView 的页序。 */
export const PAGE_KEYS = ['tasks', 'calendar', 'habits', 'pomodoro'] as const

export type SwipePage = (typeof PAGE_KEYS)[number]

/** 页面 key → PagerView 索引；未知 key 回退到首页。 */
export function pageIndex(page: string): number {
  const index = PAGE_KEYS.indexOf(page as SwipePage)
  return index < 0 ? 0 : index
}

/** PagerView 索引 → 页面 key；越界时钳制到首/末页。 */
export function pageKey(index: number): SwipePage {
  if (!Number.isFinite(index)) return PAGE_KEYS[0]
  const safe = Math.max(0, Math.min(PAGE_KEYS.length - 1, Math.round(index)))
  return PAGE_KEYS[safe] ?? PAGE_KEYS[0]
}
