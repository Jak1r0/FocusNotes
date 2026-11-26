import type { ParsedTodoDraft, SmartParserProvider } from './index'

const WEEKDAYS: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }

/** 组合时间词归一化：明晚 → 明天晚上，让日期与时段走统一解析。 */
const COMBINED_DAY_TERMS: [RegExp, string][] = [
  [/大后晚/g, '大后天晚上'],
  [/后晚/g, '后天晚上'],
  [/明晚/g, '明天晚上'],
  [/今晚/g, '今天晚上'],
  [/明早|明晨/g, '明天早上'],
  [/今早|今晨/g, '今天早上'],
  [/次日/g, '明天'],
  [/当日/g, '今天'],
]

const PERIOD_WORDS = '凌晨|清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜里|夜'

const YEAR_OFFSETS: Record<string, number> = { 前年: -2, 去年: -1, 今年: 0, 明年: 1, 后年: 2 }
const CN_NUMBER_WORD = '[零一二三四五六七八九十两]'
const CN_MONTH_DAY = new RegExp(`(${Object.keys(YEAR_OFFSETS).join('|')})?(${CN_NUMBER_WORD}{1,3})月(${CN_NUMBER_WORD}{1,3})[日号]?`)
const ARABIC_YEAR_MONTH_DAY = new RegExp(`(${Object.keys(YEAR_OFFSETS).join('|')})(\\d{1,2})月(\\d{1,2})[日号]?`)
const ANNIVERSARY_WORDS = /生日|纪念日|周年|结婚纪念/i

/** 只有时段、没有具体钟点时的默认时间。 */
const PERIOD_DEFAULT_HOUR: Record<string, number> = {
  凌晨: 6, 清晨: 7, 早晨: 8, 早上: 9, 上午: 9, 中午: 12, 下午: 14, 傍晚: 18, 晚上: 20, 夜里: 21, 夜: 21,
}

function cnToArabic(text: string): string {
  if (/^\d+$/.test(text)) return text
  const digits: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  const tenIndex = text.indexOf('十')
  let value: number
  if (tenIndex === -1) {
    value = text.split('').reduce((acc, ch) => acc * 10 + (digits[ch] ?? 0), 0)
  } else {
    const tens = tenIndex > 0 ? digits[text[tenIndex - 1]!] ?? 1 : 1
    const ones = tenIndex + 1 < text.length ? digits[text[tenIndex + 1]!] ?? 0 : 0
    value = tens * 10 + ones
  }
  return Number.isFinite(value) && value >= 0 ? String(value) : text
}

function normalizeSource(input: string, recognizedTerms: string[]): string {
  let source = input
  for (const [pattern, replacement] of COMBINED_DAY_TERMS) {
    source = source.replace(pattern, (match) => { recognizedTerms.push(match); return replacement })
  }
  source = source.replace(/半小时/g, '30分钟')
  source = source.replace(/([零一二三四五六七八九十两]+)(?=[点时])/g, (m) => cnToArabic(m))
  source = source.replace(/(?<=[点时])([零一二三四五六七八九十]+)(?=分)/g, (m) => cnToArabic(m))
  source = source.replace(/(?<=[点时])半/g, '30')
  return source
}

function validDate(year: number, month: number, day: number, hour: number, minute: number): Date | null {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

function parseTime(input: string): { hour: number; minute: number; term: string } | null {
  const match = input.match(`(${PERIOD_WORDS}|早|晨|晚)?\\s*(\\d{1,2})(?::(\\d{1,2})|[点时](\\d{1,2})?分?)`)
  if (!match) return null
  let hour = Number(match[2])
  const minute = Number(match[3] ?? match[4] ?? 0)
  const period = match[1]
  if (minute > 59 || hour > 24) return null
  if (['下午', '傍晚', '晚上', '夜里', '夜', '晚'].includes(period ?? '') && hour < 12) hour += 12
  if (period === '中午' && hour < 12) hour += 12
  if (period === '凌晨' && hour === 12) hour = 0
  if (hour > 23) return null
  return { hour, minute, term: match[0] }
}

export class LocalSmartParser {
  parse(input: string, now = new Date()): Promise<ParsedTodoDraft> {
    const raw = input.trim()
    if (!raw) return Promise.resolve({ title: '', confidence: 0, recognizedTerms: [], warnings: ['请输入待办内容。'] })
    const recognizedTerms: string[] = []
    const warnings: string[] = []
    const source = normalizeSource(raw, recognizedTerms)
    const time = parseTime(source)
    if (time) recognizedTerms.push(time.term)
    const period = source.match(PERIOD_WORDS)?.[0] ?? null
    let due: Date | null = null
    let year = now.getFullYear()
    let month = now.getMonth() + 1
    let day = now.getDate()

    const fullDate = source.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/)
    const arabicYearMonthDay = source.match(ARABIC_YEAR_MONTH_DAY)
    const chineseMonthDay = source.match(CN_MONTH_DAY)
    const monthDay = source.match(/(\d{1,2})月(\d{1,2})[日号]/)
    const relative = source.match(/大后天|后天|明天|今天|今日/)
    const weekday = source.match(/(下周|这周|本周|周|星期)([一二三四五六日天])/)
    const duration = source.match(/(\d+)\s*(分钟|小时|天)\s*后/)

    const hasExplicitDate = Boolean(fullDate || arabicYearMonthDay || chineseMonthDay || monthDay || relative || weekday)
    const periodOnly = !hasExplicitDate && !duration && period !== null

    if (fullDate) {
      year = Number(fullDate[1]); month = Number(fullDate[2]); day = Number(fullDate[3])
      recognizedTerms.push(fullDate[0])
    } else if (arabicYearMonthDay) {
      year = now.getFullYear() + (YEAR_OFFSETS[arabicYearMonthDay[1]!] ?? 0)
      month = Number(arabicYearMonthDay[2]); day = Number(arabicYearMonthDay[3])
      recognizedTerms.push(arabicYearMonthDay[0])
    } else if (chineseMonthDay) {
      year = now.getFullYear() + (YEAR_OFFSETS[chineseMonthDay[1] ?? ''] ?? 0)
      month = Number(cnToArabic(chineseMonthDay[2]!))
      day = Number(cnToArabic(chineseMonthDay[3]!))
      recognizedTerms.push(chineseMonthDay[0])
    } else if (monthDay) {
      month = Number(monthDay[1]); day = Number(monthDay[2])
      if (month < now.getMonth() + 1 || (month === now.getMonth() + 1 && day < now.getDate())) year += 1
      recognizedTerms.push(monthDay[0])
    } else if (relative) {
      const offset = { 今天: 0, 今日: 0, 明天: 1, 后天: 2, 大后天: 3 }[relative[0] as '今天' | '今日' | '明天' | '后天' | '大后天']
      const target = new Date(now)
      target.setDate(target.getDate() + offset)
      year = target.getFullYear(); month = target.getMonth() + 1; day = target.getDate()
      recognizedTerms.push(relative[0])
    } else if (weekday) {
      const targetDay = WEEKDAYS[weekday[2]!]!
      let delta = (targetDay - now.getDay() + 7) % 7
      if (weekday[1] === '下周') {
        const untilNextMonday = ((8 - now.getDay()) % 7) || 7
        delta = untilNextMonday + (targetDay === 0 ? 6 : targetDay - 1)
      } else if (delta === 0) delta = 7
      const target = new Date(now)
      target.setDate(target.getDate() + delta)
      year = target.getFullYear(); month = target.getMonth() + 1; day = target.getDate()
      recognizedTerms.push(weekday[0])
    }

    if (duration && !hasExplicitDate) {
      const unitMillis = { 分钟: 60000, 小时: 3600000, 天: 86400000 }[duration[2] as '分钟' | '小时' | '天']
      due = new Date(now.getTime() + Number(duration[1]) * unitMillis)
      recognizedTerms.push(duration[0])
    } else if (fullDate || arabicYearMonthDay || chineseMonthDay || monthDay || relative || weekday || time || periodOnly) {
      const fallbackHour = period !== null && !time ? PERIOD_DEFAULT_HOUR[period]! : 23
      const fallbackMinute = period !== null && !time ? 0 : 59
      due = validDate(year, month, day, time?.hour ?? fallbackHour, time?.minute ?? fallbackMinute)
      if (due && time && !hasExplicitDate && !periodOnly && due <= now) {
        due.setDate(due.getDate() + 1)
      }
      if (due && periodOnly && due <= now) due.setDate(due.getDate() + 1)
      if (!due) warnings.push('日期无效，请确认识别结果。')
    } else {
      warnings.push('未识别到截止时间，可在确认卡片中补充。')
    }

    const important = /重要|关键|优先|高优先|important/i.test(source)
    const dueSoon = due !== null && due.getTime() >= now.getTime() && due.getTime() - now.getTime() <= 86400000
    const urgent = /紧急|急办|尽快|马上|立即|ASAP|urgent/i.test(source) || dueSoon
    const anniversary = ANNIVERSARY_WORDS.test(source)
    if (important) recognizedTerms.push('重要')
    if (urgent) recognizedTerms.push('紧急')
    if (anniversary) recognizedTerms.push('纪念日')

    const cleaned = stripTime(source)
      .replace(/重要且紧急|紧急且重要|重要不紧急|紧急不重要|重要|紧急|关键|高优先|优先|急办|尽快|马上|立即|ASAP|important|urgent/gi, '')
      .replace(/^[，,，、的\s]*|[，,，、的\s]*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    return Promise.resolve({
      title: cleaned || raw,
      dueAt: due?.toISOString() ?? null,
      important,
      urgent,
      ...(anniversary ? { tags: ['纪念日'] } : {}),
      confidence: Math.min(0.95, 0.55 + (due ? 0.25 : 0) + (important ? 0.08 : 0) + (urgent ? 0.08 : 0)),
      recognizedTerms: [...new Set(recognizedTerms)],
      warnings,
    })
  }
}

function stripTime(source: string): string {
  return source
    .replace(/^(请|帮我|提醒我|添加|创建|新增|待办)[，,\s]*/g, '')
    .replace(/\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?/g, '')
    .replace(ARABIC_YEAR_MONTH_DAY, '')
    .replace(CN_MONTH_DAY, '')
    .replace(/\d{1,2}月\d{1,2}[日号]/g, '')
    .replace(/前年|去年|今年|明年|后年/g, '')
    .replace(/大后天|后天|明天|今天|今日|下周[一二三四五六日天]|这周[一二三四五六日天]|本周[一二三四五六日天]|周[一二三四五六日天]|星期[一二三四五六日天]/g, '')
    .replace(/(?<=是)我(?=生日|纪念日|周年)/g, '')
    .replace(/\d+\s*(?:分钟|小时|天)\s*后/g, '')
    .replace(new RegExp(`(${PERIOD_WORDS}|早|晨|晚)?\\s*\\d{1,2}(?::\\d{1,2}|[点时]\\d{1,2}分?|[点时])`, 'g'), '')
    .replace(new RegExp(PERIOD_WORDS, 'g'), '')
    .replace(/(?<=[一二三四五六日天周])晚(?=\s|$|，|,|。)/g, '')
}

export class HybridSmartParser {
  private readonly local = new LocalSmartParser()
  constructor(private readonly remote?: SmartParserProvider) {}

  async parse(input: string, now = new Date()): Promise<ParsedTodoDraft> {
    if (!this.remote) return this.local.parse(input, now)
    try { return await this.remote.parse(input, now) }
    catch {
      const result = await this.local.parse(input, now)
      result.warnings.push('云端 AI 暂不可用，已使用本地智能识别。')
      return result
    }
  }
}
