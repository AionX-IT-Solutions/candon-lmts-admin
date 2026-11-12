import { useCallback, useEffect, useState } from 'react'
import { fetchDocs } from './db'
import { formatDate, toInputDate } from './utils'
import type { Minutes } from '../types'

type Session = Minutes & { createdAt?: string }

/** Most recent first: by session date, then by when it was added; sessions without a date go last. */
function recentFirst(a: Session, b: Session): number {
  const da = toInputDate(a.date)
  const db = toInputDate(b.date)
  if (da !== db) {
    if (!da) return 1
    if (!db) return -1
    return da < db ? 1 : -1
  }
  const ca = a.createdAt ?? ''
  const cb = b.createdAt ?? ''
  return ca < cb ? 1 : ca > cb ? -1 : 0
}

/** "001-2026 · Regular Session · Oct 7, 2025" */
export function sessionLabel(s: Minutes): string {
  return [s.sessionNo, s.category, s.date ? formatDate(s.date) : ''].filter(Boolean).join(' · ')
}

/**
 * The sessions recorded under Order of Business, most recent first — for "Session Number" pickers.
 * `enabled: false` skips loading (for forms without a session field).
 */
export function useSessions(enabled = true) {
  const [sessions, setSessions] = useState<Session[]>([])

  const reload = useCallback(async () => {
    try {
      const { items } = await fetchDocs<Session>('sessions', {
        orderByField: 'date',
        direction: 'desc'
      })
      setSessions(items.sort(recentFirst))
    } catch (err) {
      console.error('[sessions] load failed:', err)
    }
  }, [])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  return { sessions, reload }
}
