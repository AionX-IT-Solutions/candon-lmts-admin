import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function toInputDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr.trim()
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

export function getFullName(
  firstName: string,
  middleName: string,
  lastName: string,
  suffix?: string
): string {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(' ')
}

export function sortByField<T>(arr: T[], field: string, direction: 'asc' | 'desc'): T[] {
  return [...arr].sort((a, b) => {
    const av = String((a as Record<string, unknown>)[field] ?? '')
    const bv = String((b as Record<string, unknown>)[field] ?? '')
    const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
    return direction === 'desc' ? -cmp : cmp
  })
}

// Legislative document numbers look like "2025-017" or "13SP-2026-010" — the
// leading "NSP" prefix (when present) is the Sangguniang Panlungsod TERM
// number, which outranks everything else: a higher term is always more
// recent regardless of the embedded year or sequence. Records with no SP
// prefix are legacy/pre-term-numbering entries and always sort below every
// SP-prefixed record. Within the same term (or within the no-term group),
// fall back to year then sequence — year is only trusted when it actually
// looks like one (exactly 4 digits, 1900-2100), so malformed numbers like
// "20011-002" don't hijack the top via a bogus 5-digit "year".
interface ParsedCode {
  hasTerm: boolean
  term: number
  year: number
  seq: number
}

const TERM_PREFIX_RE = /^\s*(\d+)\s*sp\b/i

function parseCode(value: unknown): ParsedCode {
  const raw = String(value ?? '')
  const termMatch = raw.match(TERM_PREFIX_RE)
  const hasTerm = !!termMatch
  const term = hasTerm ? Number(termMatch![1]) : 0
  const rest = hasTerm ? raw.slice(termMatch![0].length) : raw

  const groups = rest.match(/\d+/g)
  let year = 0
  let seq = 0
  if (groups && groups.length > 0) {
    seq = Number(groups[groups.length - 1])
    if (groups.length > 1) {
      const candidate = groups[groups.length - 2]
      const candidateNum = Number(candidate)
      if (candidate.length === 4 && candidateNum >= 1900 && candidateNum <= 2100) {
        year = candidateNum
      }
    }
  }
  return { hasTerm, term, year, seq }
}

// "1-013-2026-000010"-style string: leading digit separates SP-prefixed
// records (1) from legacy no-prefix records (0), so plain lexicographic
// order (e.g. Firestore's orderBy, or a plain sortByField call) matches the
// intended (hasTerm, term, year, sequence) priority order described above.
export function computeCodeSortKey(value: string | undefined | null): string {
  const p = parseCode(value)
  return [
    p.hasTerm ? '1' : '0',
    String(p.term).padStart(3, '0'),
    String(p.year).padStart(4, '0'),
    String(p.seq).padStart(6, '0')
  ].join('-')
}

export function nowDateString(): string {
  const now = new Date()
  return (
    now.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) +
    ' ' +
    now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  )
}
