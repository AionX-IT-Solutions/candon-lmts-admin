import { useCallback, useEffect, useState } from 'react'
import { fetchDocs } from './db'
import { officialName } from './orgChart'
import type { Committee, Official } from '../types'

export interface PersonOrCommittee {
  id: string
  /** Official's full name (with title/suffix) or committee's title — what gets stored. */
  name: string
  sourceLabel: 'Official' | 'Committee'
}

export function officialIdsForNames(names: string[], people: PersonOrCommittee[]): string[] {
  const selected = new Set(names)
  return [
    ...new Set(
      people
        .filter((person) => person.sourceLabel === 'Official' && selected.has(person.name))
        .map((person) => person.id)
    )
  ]
}

/** Position-based prefix for Author/Co-Author/Sponsor, in front of the official's own name —
 *  e.g. "SPM Juan Dela Cruz" for a City Councilor, "Vice Mayor Juan Dela Cruz" for the Vice Mayor. */
const POSITION_PREFIX: Record<string, string> = {
  'City Vice Mayor': 'Vice Mayor',
  'City Councilor': 'SPM'
}

function authorName(o: Official): string {
  return [POSITION_PREFIX[o.position], officialName(o)].filter(Boolean).join(' ')
}

/** Officials and Standing Committees together — the shared roster Author/Co-Author/Sponsor pick
 *  from, since a measure can be authored or sponsored by either one. */
export function usePeopleAndCommittees(enabled = true) {
  const [people, setPeople] = useState<PersonOrCommittee[]>([])
  const reload = useCallback(async () => {
    try {
      const [officials, committees] = await Promise.all([
        fetchDocs<Official>('officials', { orderByField: 'createdAt', direction: 'asc' }),
        fetchDocs<Committee>('committees', { orderByField: 'title', direction: 'asc' })
      ])
      setPeople([
        ...officials.items.map((o) => ({
          id: o.id,
          name: authorName(o),
          sourceLabel: 'Official' as const
        })),
        ...committees.items.map((c) => ({
          id: c.id,
          name: c.title,
          sourceLabel: 'Committee' as const
        }))
      ])
    } catch (err) {
      console.error('[peopleAndCommittees] load failed:', err)
    }
  }, [])
  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])
  return { people, reload }
}
