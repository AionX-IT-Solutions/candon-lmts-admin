import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from './store/authStore'
import { applyTheme, useUIStore } from './store/uiStore'
import { supabase } from './lib/supabase'
import { hasSession } from './lib/auth'
import { SESSION_EXPIRED_EVENT } from './lib/session'
import { AppShell } from './components/layout/Layout'
import { TitleBar, UpdateNotices } from './components/layout/TitleBar'
import { Toaster } from './components/ui/Toaster'
import { FileViewerModal } from './components/ui/FileViewerModal'
import { LoginPage } from './pages/Login'

// Each page is its own chunk, loaded on first visit.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const DashboardPage = page(() => import('./pages/Dashboard'), 'DashboardPage')
const OrdinancesPage = page(() => import('./pages/ordinances/OrdinancesPage'), 'OrdinancesPage')
const ResolutionsPage = page(() => import('./pages/resolutions/ResolutionsPage'), 'ResolutionsPage')
const TricyclePage = page(() => import('./pages/tricycle/TricyclePage'), 'TricyclePage')
const MinutesPage = page(() => import('./pages/minutes/MinutesPage'), 'MinutesPage')
const CommunicationsPage = page(
  () => import('./pages/communications/CommunicationsPage'),
  'CommunicationsPage'
)
const BarangayPage = page(() => import('./pages/barangay/BarangayPage'), 'BarangayPage')
const TranscriptPage = page(() => import('./pages/transcript/TranscriptPage'), 'TranscriptPage')
const DraftOrdinancesPage = page(
  () => import('./pages/draft/DraftOrdinancesPage'),
  'DraftOrdinancesPage'
)
const DraftResolutionsPage = page(
  () => import('./pages/draft/DraftResolutionsPage'),
  'DraftResolutionsPage'
)
const ReviewPage = page(() => import('./pages/review/ReviewPage'), 'ReviewPage')
const OtherMattersPage = page(
  () => import('./pages/otherMatters/OtherMattersPage'),
  'OtherMattersPage'
)
const CommitteesPage = page(() => import('./pages/committees/CommitteesPage'), 'CommitteesPage')
const CommitteeReportsPage = page(
  () => import('./pages/committeeReports/CommitteeReportsPage'),
  'CommitteeReportsPage'
)
const loadRecordPages = () => import('./pages/records/recordPages')
const SessionMinutesPage = page(loadRecordPages, 'SessionMinutesPage')
const CommitteeReferralsPage = page(loadRecordPages, 'CommitteeReferralsPage')
const CommitteeTranscriptsPage = page(loadRecordPages, 'CommitteeTranscriptsPage')
const PublicHearingMinutesPage = page(loadRecordPages, 'PublicHearingMinutesPage')
const AccountsPage = page(() => import('./pages/accounts/AccountsPage'), 'AccountsPage')
const OfficialsPage = page(() => import('./pages/officials/OfficialsPage'), 'OfficialsPage')
const TermsPage = page(() => import('./pages/terms/TermsPage'), 'TermsPage')
const OfficialsOrgChartPage = page(
  () => import('./pages/officials/OfficialsOrgChartPage'),
  'OfficialsOrgChartPage'
)
const LogsPage = page(() => import('./pages/logs/LogsPage'), 'LogsPage')
const UserManualPage = page(() => import('./pages/manual/UserManualPage'), 'UserManualPage')

const ROUTES: [string, ComponentType][] = [
  ['/dashboard', DashboardPage],
  ['/ordinances', OrdinancesPage],
  ['/resolutions', ResolutionsPage],
  ['/tricycle', TricyclePage],
  ['/minutes', MinutesPage],
  ['/communications', CommunicationsPage],
  ['/barangay', BarangayPage],
  ['/transcript', TranscriptPage],
  ['/draft-ordinances', DraftOrdinancesPage],
  ['/draft-resolutions', DraftResolutionsPage],
  ['/review', ReviewPage],
  ['/other-matters', OtherMattersPage],
  ['/committees', CommitteesPage],
  ['/committee-reports', CommitteeReportsPage],
  ['/session-minutes', SessionMinutesPage],
  ['/committee-referrals', CommitteeReferralsPage],
  ['/committee-transcripts', CommitteeTranscriptsPage],
  ['/public-hearing-minutes', PublicHearingMinutesPage],
  ['/accounts', AccountsPage],
  ['/officials', OfficialsPage],
  ['/org-chart', OfficialsOrgChartPage],
  ['/terms', TermsPage],
  ['/logs', LogsPage],
  ['/user-manual', UserManualPage]
]

function PageLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '2px solid var(--border-default)',
          borderTopColor: 'var(--accent-primary)',
          animation: 'spin 0.7s linear infinite',
          boxShadow: '0 0 12px var(--accent-primary-glow)'
        }}
      />
    </motion.div>
  )
}

function AuthenticatedShell() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {ROUTES.map(([path, Page]) => (
            <Route key={path} path={path} element={<Page />} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      <FileViewerModal />
    </AppShell>
  )
}

function UnauthenticatedShell() {
  return (
    <div className="app-shell">
      <TitleBar minimal />
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </div>
  )
}

/** Keeps the persisted login in step with the Supabase session (it is cleared on window close). */
function useSessionSync() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    // Electron can report the renderer as hidden while the window is minimized. Keep Supabase's
    // refresh ticker running for the whole app lifetime instead of relying on browser visibility.
    void supabase.auth.startAutoRefresh()
    const expireSession = () => {
      const auth = useAuthStore.getState()
      if (!auth.isAuthenticated) return
      auth.logout()
      window.electron.ipcRenderer.send('window-restore-login')
      navigate('/login', { replace: true })
    }

    void hasSession().then((ok) => {
      if (!cancelled && !ok && useAuthStore.getState().isAuthenticated) expireSession()
    })
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') expireSession()
    })
    window.addEventListener(SESSION_EXPIRED_EVENT, expireSession)
    return () => {
      cancelled = true
      void supabase.auth.stopAutoRefresh()
      data.subscription.unsubscribe()
      window.removeEventListener(SESSION_EXPIRED_EVENT, expireSession)
    }
  }, [navigate])
}

function AppInner() {
  const theme = useUIStore((s) => s.theme)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  useSessionSync()

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (isAuthenticated) window.electron.ipcRenderer.send('window-maximize')
  }, [isAuthenticated])

  return (
    <>
      <AnimatePresence mode="wait">
        {isAuthenticated ? <AuthenticatedShell key="app" /> : <UnauthenticatedShell key="login" />}
      </AnimatePresence>
      <Toaster />
      <UpdateNotices />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppInner />
    </HashRouter>
  )
}
