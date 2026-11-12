import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Network, Pencil, RefreshCw, UserX, Users } from 'lucide-react'
import { toast } from 'sonner'
import { addDocument, fetchDocs, updateDocument } from '../../lib/db'
import {
  buildOfficialsTree,
  collectDescendantIds,
  committeesByOfficial,
  officialName
} from '../../lib/orgChart'
import { getFullName } from '../../lib/utils'
import { currentTerm, useTerms } from '../../lib/terms'
import { useAuthStore } from '../../store/authStore'
import { Layout, PageContainer } from '../../components/layout/Layout'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { OfficialOrgChartNode } from '../../components/orgchart/OfficialOrgChartNode'
import type { Committee, Official } from '../../types'

/** Drop here to make the dragged official report to no one (a top-level box). */
function UnassignDropZone({ active, onDrop }: { active: boolean; onDrop: (id: string) => void }) {
  const [hover, setHover] = useState(false)
  if (!active) return null
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setHover(true)
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault()
        setHover(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDrop(id)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '10px 14px',
        borderRadius: 10,
        background: hover ? 'var(--accent-primary-subtle)' : 'var(--glass-bg)',
        border: `1px dashed ${hover ? 'var(--accent-primary)' : 'var(--border-default)'}`,
        fontSize: 12,
        color: 'var(--text-muted)',
        transition: 'background 0.15s ease, border-color 0.15s ease'
      }}
    >
      <UserX size={13} />
      Drop here so they report to no one
    </div>
  )
}

export function OfficialsOrgChartPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canEdit = useAuthStore((s) => s.hasPrivilege('S.P Members', 'edit'))

  const [officials, setOfficials] = useState<Official[]>([])
  const [committees, setCommittees] = useState<Committee[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    // Committees only add detail to the boxes, so the chart still shows if they fail to load
    const committeesLoaded = fetchDocs<Committee>('committees', {
      orderByField: 'title',
      direction: 'asc'
    })
      .then(({ items }) => setCommittees(items))
      .catch((err) => console.error('[org chart] committees failed to load:', err))
    try {
      const { items } = await fetchDocs<Official>('officials', {
        orderByField: 'lastName',
        direction: 'asc'
      })
      setOfficials(items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load officials')
    } finally {
      await committeesLoaded
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Term filter: defaults to the term running today ('' = all terms)
  const { terms } = useTerms()
  const [termFilter, setTermFilter] = useState<string | null>(null)
  const activeTermId = termFilter ?? currentTerm(terms)?.id ?? ''
  const activeTerm = terms.find((t) => t.id === activeTermId)
  const visible = useMemo(
    () => (activeTermId ? officials.filter((o) => o.termId === activeTermId) : officials),
    [officials, activeTermId]
  )
  // What each box lists under the position: the committees of the term shown
  const committeeLines = useMemo(
    () =>
      committeesByOfficial(
        visible,
        activeTermId ? committees.filter((c) => c.termId === activeTermId) : committees
      ),
    [visible, committees, activeTermId]
  )

  const tree = useMemo(() => buildOfficialsTree(visible), [visible])
  const invalidDropIds = draggedId ? collectDescendantIds(tree, draggedId) : undefined

  async function logActivity(activity: string) {
    if (!user) return
    const name = getFullName(user.firstName, user.middleName, user.lastName)
    const date =
      new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) +
      ' ' +
      new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
    await addDocument('activity_logs', { name, activity, date, year: new Date().getFullYear() })
  }

  async function handleReparent(officialId: string, newReportsToId: string | null) {
    setDraggedId(null)
    const official = officials.find((o) => o.id === officialId)
    if (!official || (official.reportsToId ?? null) === newReportsToId) return
    const previous = officials
    // Move the box right away; roll back if the save fails.
    setOfficials((list) =>
      list.map((o) =>
        o.id === officialId ? { ...o, reportsToId: newReportsToId ?? undefined } : o
      )
    )
    try {
      await updateDocument('officials', officialId, { reportsToId: newReportsToId })
      const head = newReportsToId ? officials.find((o) => o.id === newReportsToId) : undefined
      await logActivity(
        head
          ? `Organization chart: ${officialName(official)} now reports to ${officialName(head)}`
          : `Organization chart: ${officialName(official)} now reports to no one`
      )
    } catch (err) {
      setOfficials(previous)
      toast.error(err instanceof Error ? err.message : 'Failed to update the chart')
    }
  }

  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="Organization Chart"
          subtitle={`${visible.length} officials${activeTerm ? ` · ${activeTerm.name}` : ''}`}
          icon={<Network size={20} />}
          actions={
            <>
              <select
                value={activeTermId}
                onChange={(e) => setTermFilter(e.target.value)}
                className="input-field"
                style={{ width: 190, padding: '7px 10px' }}
                aria-label="Term"
              >
                <option value="">All terms</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="btn-ghost" onClick={() => void load()} disabled={loading}>
                <RefreshCw size={15} />
                Refresh
              </button>
              {canEdit && visible.length > 0 && (
                <button
                  className={editMode ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setEditMode((v) => !v)
                    setDraggedId(null)
                  }}
                >
                  {editMode ? <Check size={15} /> : <Pencil size={15} />}
                  {editMode ? 'Done editing' : 'Edit layout'}
                </button>
              )}
            </>
          }
        />

        <AnimatePresence>
          {editMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <div
                style={{
                  marginBottom: 14,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'var(--accent-primary-subtle)',
                  border: '1px dashed var(--accent-primary)',
                  fontSize: 12,
                  color: 'var(--text-secondary)'
                }}
              >
                Drag an official onto another to make them report to that official. Changes save
                immediately.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="card"
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 24px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              flexShrink: 0
            }}
          >
            <Users size={15} style={{ color: 'var(--accent-primary)' }} />
            Sangguniang Panlungsod · City of Candon
            {activeTerm ? ` · ${activeTerm.name}` : ''}
          </div>

          <div
            className="scrollbar-thin"
            style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}
          >
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <Spinner />
              </div>
            ) : visible.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  padding: 48,
                  color: 'var(--text-muted)',
                  fontSize: 13
                }}
              >
                <Network size={28} />
                {officials.length === 0
                  ? 'No officials yet — add them under City Councils → Officials to build the chart.'
                  : 'No officials in this term yet.'}
                <button className="btn-primary" onClick={() => navigate('/officials')}>
                  Go to Officials
                </button>
              </div>
            ) : (
              <>
                {!editMode && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
                    {visible.length} {visible.length === 1 ? 'official' : 'officials'}
                    {activeTerm ? ` in the ${activeTerm.name} term` : ' across all terms'}
                  </p>
                )}
                <AnimatePresence>
                  {editMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <UnassignDropZone
                        active={!!draggedId}
                        onDrop={(id) => void handleReparent(id, null)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <div style={{ display: 'flex', gap: 48, width: 'max-content', margin: '0 auto' }}>
                  {tree.map((root) => (
                    <OfficialOrgChartNode
                      key={root.official.id}
                      node={root}
                      editMode={editMode}
                      draggedId={draggedId}
                      invalidDropIds={invalidDropIds}
                      onDragStartNode={setDraggedId}
                      onDragEndNode={() => setDraggedId(null)}
                      onReparent={(id, parentId) => void handleReparent(id, parentId)}
                      committees={committeeLines}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </PageContainer>
    </Layout>
  )
}
