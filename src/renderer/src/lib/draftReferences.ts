import { useCallback, useEffect, useState } from 'react'
import { fetchDocs } from './db'
import type { Communication, DraftOrdinance, DraftResolution } from '../types'

/** One pickable item for a "Draft Code" field — a Draft Ordinance, Draft Resolution, or
 *  Communication, whichever was actually referred. `code` is what gets stored (matching every
 *  other reference field's "store the plain code, not an id" convention) — the same number
 *  shown on that record's own page (draftOrdinanceNumber/draftResolutionNumber/communicationNo). */
export interface DraftReference {
  id: string
  code: string
  title: string
  sourceLabel: 'Draft Ordinance' | 'Draft Resolution' | 'Communication'
}

export interface DraftReferenceFile {
  filePath?: string
  sourceLabel: DraftReference['sourceLabel']
}

export function draftReferenceLabel(r: DraftReference): string {
  return `${r.sourceLabel} · ${r.code}${r.title ? ` — ${r.title}` : ''}`
}

/** Resolve a stored Draft Code to the first matching source, in the picker's source order. */
export async function findDraftReferenceFile(code: string): Promise<DraftReferenceFile | null> {
  const [ordinances, resolutions, communications] = await Promise.all([
    fetchDocs<DraftOrdinance>('draft_ordinances', {
      orderByField: 'draftOrdinanceNumber',
      pageSize: 1,
      filters: [{ field: 'draftOrdinanceNumber', op: '==', value: code }]
    }),
    fetchDocs<DraftResolution>('draft_resolutions', {
      orderByField: 'draftResolutionNumber',
      pageSize: 1,
      filters: [{ field: 'draftResolutionNumber', op: '==', value: code }]
    }),
    fetchDocs<Communication>('communications', {
      orderByField: 'communicationNo',
      pageSize: 1,
      filters: [{ field: 'communicationNo', op: '==', value: code }]
    })
  ])
  const ordinance = ordinances.items.find((item) => item.draftOrdinanceNumber === code)
  if (ordinance) return { filePath: ordinance.filePath, sourceLabel: 'Draft Ordinance' }

  const resolution = resolutions.items.find((item) => item.draftResolutionNumber === code)
  if (resolution) return { filePath: resolution.filePath, sourceLabel: 'Draft Resolution' }

  const communication = communications.items.find((item) => item.communicationNo === code)
  if (communication) return { filePath: communication.filePath, sourceLabel: 'Communication' }

  return null
}

/**
 * Every Draft Ordinance, Draft Resolution, and Communication merged into one searchable list,
 * most recently filed first within each source — for Committee Referrals' "Draft Code" field,
 * which can point at any of the three (as in the existing Candon LMTS: a referral covers
 * whichever measure or communication was actually sent to committee).
 * `enabled: false` skips loading (for forms without this field).
 */
export function useDraftReferences(enabled = true) {
  const [references, setReferences] = useState<DraftReference[]>([])

  const reload = useCallback(async () => {
    try {
      const [ordinances, resolutions, communications] = await Promise.all([
        fetchDocs<DraftOrdinance>('draft_ordinances', {
          orderByField: 'draftOrdinanceNumber',
          direction: 'desc'
        }),
        fetchDocs<DraftResolution>('draft_resolutions', {
          orderByField: 'draftResolutionNumber',
          direction: 'desc'
        }),
        fetchDocs<Communication>('communications', {
          orderByField: 'communicationNo',
          direction: 'desc'
        })
      ])
      setReferences([
        ...ordinances.items
          .filter((o) => o.draftOrdinanceNumber)
          .map((o) => ({
            id: o.id,
            code: o.draftOrdinanceNumber,
            title: o.title,
            sourceLabel: 'Draft Ordinance' as const
          })),
        ...resolutions.items
          .filter((r) => r.draftResolutionNumber)
          .map((r) => ({
            id: r.id,
            code: r.draftResolutionNumber,
            title: r.title,
            sourceLabel: 'Draft Resolution' as const
          })),
        ...communications.items
          .filter((c) => c.communicationNo)
          .map((c) => ({
            id: c.id,
            code: c.communicationNo,
            title: c.title,
            sourceLabel: 'Communication' as const
          }))
      ])
    } catch (err) {
      console.error('[draftReferences] load failed:', err)
    }
  }, [])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  return { references, reload }
}
