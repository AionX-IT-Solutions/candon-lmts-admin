import { useCallback, useEffect, useState } from 'react'
import { fetchDocs } from './db'
import type { Committee } from '../types'

/**
 * The Standing Committees registry, alphabetical by title — for "Committee" pickers. Mirrors
 * sessions.ts's own useSessions() shape (same reload-on-modal-open convention).
 * `enabled: false` skips loading (for forms without a committee field).
 */
export function useCommittees(enabled = true) {
  const [committees, setCommittees] = useState<Committee[]>([])

  const reload = useCallback(async () => {
    try {
      const { items } = await fetchDocs<Committee>('committees', {
        orderByField: 'title',
        direction: 'asc'
      })
      setCommittees(items)
    } catch (err) {
      console.error('[committees] load failed:', err)
    }
  }, [])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  return { committees, reload }
}
