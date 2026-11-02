import { useCallback, useEffect, useState } from 'react'
import { fetchDocs } from './db'
import type { Official } from '../types'

/** The S.P Officials roster, for pickers that select a person by name (e.g. Roll Call
 *  Present/Absent) — officials only, unlike peopleAndCommittees' combined author roster. */
export function useOfficials(enabled = true) {
  const [officials, setOfficials] = useState<Official[]>([])
  const reload = useCallback(async () => {
    try {
      const { items } = await fetchDocs<Official>('officials', {
        orderByField: 'createdAt',
        direction: 'asc'
      })
      setOfficials(items)
    } catch (err) {
      console.error('[officials] load failed:', err)
    }
  }, [])
  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])
  return { officials, reload }
}
