import { useCallback, useEffect, useState } from 'react'
import { fetchDocs } from './db'
import type { Term } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

/** "Current" when today falls within the term's dates, otherwise "Past" / "Upcoming" ("—" without dates). */
export function termStatus(term: Term): 'Current' | 'Past' | 'Upcoming' | '—' {
  const now = today()
  if (term.startDate && now < term.startDate) return 'Upcoming'
  if (term.endDate && now > term.endDate) return 'Past'
  if (term.startDate || term.endDate) return 'Current'
  return '—'
}

/** The term running today, if any. */
export function currentTerm(terms: Term[]): Term | undefined {
  return terms.find((t) => termStatus(t) === 'Current')
}

/** Later date first, blank dates after filled ones (YYYY-MM-DD text sorts as dates do). */
function newerDateFirst(a?: string | null, b?: string | null): number {
  if (!a || !b) return Number(!a) - Number(!b)
  return a < b ? 1 : a > b ? -1 : 0
}

/** Newest term first: by start date, then end date; terms without dates go last. */
export function compareTermsNewestFirst(a: Term, b: Term): number {
  return (
    newerDateFirst(a.startDate, b.startDate) ||
    newerDateFirst(a.endDate, b.endDate) ||
    (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true })
  )
}

/** All council terms, newest first. */
export function useTerms() {
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const { items } = await fetchDocs<Term>('terms', {
        orderByField: 'startDate',
        direction: 'desc'
      })
      setTerms(items.sort(compareTermsNewestFirst))
    } catch (err) {
      console.error('[terms] load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { terms, loading, reload }
}
