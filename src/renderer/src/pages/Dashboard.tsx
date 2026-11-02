import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { countDocs, fetchDocs } from '../lib/db'
import { useFileUrl } from '../hooks/useFileUrl'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Layout } from '../components/layout/Layout'
import aionxLogo from '../assets/aionx-logo.png'
import type { Log } from '../types'
import {
  ScrollText,
  FileCheck,
  Activity,
  TrendingUp,
  Calendar,
  Users,
  RefreshCw,
  Layers,
  BookOpen,
  Bike,
  Building2,
  BarChart2,
  ClipboardCheck,
  ChevronRight,
  Clock,
  GitMerge
} from 'lucide-react'
import { getFullName } from '../lib/utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Label,
  BarChart,
  Bar
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'

interface Stats {
  generalOrdinances: number
  appropriation: number
  taxOrdinances: number
  generalResolutions: number
  commendations: number
  posthumous: number
}

interface UpcomingBirthday {
  display_name: string
  days_until: number
  photo_path: string | null
}

function BirthdayGreeting({ birthday }: { birthday: UpcomingBirthday }) {
  const photoUrl = useFileUrl(birthday.photo_path)
  const initials = birthday.display_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: 'fit-content',
        maxWidth: '100%',
        color: '#000',
        backgroundColor: '#fef3c7',
        borderRadius: 10,
        marginTop: 6,
        padding: '6px 10px'
      }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`${birthday.display_name} profile`}
          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            flexShrink: 0,
            background: '#fde68a',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          {initials || '?'}
        </div>
      )}
      <span style={{ fontSize: 12, fontWeight: 600 }}>
        {birthday.days_until === 0
          ? `🎂 Happy birthday, ${birthday.display_name}!`
          : `🎂 Birthday in ${birthday.days_until} ${birthday.days_until === 1 ? 'day' : 'days'}: ${birthday.display_name}`}
      </span>
    </div>
  )
}

/* ── Animated counter ─────────────────────────────────────────── */
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0)
  const prevRef = useRef(0)
  useEffect(() => {
    if (target === prevRef.current) return
    const start = prevRef.current
    const delta = target - start
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(start + delta * ease))
      if (p < 1) requestAnimationFrame(tick)
      else prevRef.current = target
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return count
}

/* ── KPI Summary card (large) ─────────────────────────────────── */
interface KpiCardProps {
  label: string
  value: number
  sub: string
  icon: React.ReactNode
  gradient: string
  glow: string
}
function KpiCard({ label, value, sub, icon, gradient, glow }: KpiCardProps) {
  const count = useCountUp(value)
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--c-surface)',
        border: `1px solid ${hovered ? glow.replace('0.25', '0.45') : 'var(--c-border)'}`,
        borderRadius: 16,
        padding: '18px 20px',
        boxShadow: hovered
          ? `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${glow}`
          : 'var(--c-card-shadow)',
        transition: 'all 0.2s',
        cursor: 'default'
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -24,
          bottom: -24,
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: gradient,
          opacity: 0.08,
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--c-text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: 'var(--c-text-1)',
              lineHeight: 1.1,
              marginTop: 6
            }}
          >
            {count}
          </p>
          <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 5 }}>{sub}</p>
        </div>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            flexShrink: 0,
            background: gradient,
            boxShadow: `0 6px 16px ${glow}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

/* ── Category stat card (small) ───────────────────────────────── */
interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  gradient: string
  glow: string
  delay?: number
}
function StatCard({ label, value, icon, gradient, glow, delay = 0 }: StatCardProps) {
  const count = useCountUp(value)
  return (
    <div
      className="animate-slide-up"
      style={{
        animationDelay: `${delay}ms`,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: 'var(--c-card-shadow)',
        cursor: 'default'
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -16,
          top: -16,
          width: 72,
          height: 72,
          borderRadius: '50%',
          border: `2px solid ${glow.replace('0.3', '0.12')}`,
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -4,
          top: -4,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: `2px solid ${glow.replace('0.3', '0.07')}`,
          pointerEvents: 'none'
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            flexShrink: 0,
            background: gradient,
            boxShadow: `0 4px 12px ${glow}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: 'var(--c-text-1)' }}>
            {count}
          </p>
          <p
            style={{
              fontSize: 10,
              marginTop: 3,
              color: 'var(--c-text-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {label}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Chart tooltip ────────────────────────────────────────────── */
function DarkTooltip({
  active,
  payload,
  label
}: TooltipProps<ValueType, NameType> & {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--c-tooltip-bg)',
        border: '1px solid var(--c-tooltip-border)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontSize: 12
      }}
    >
      {label && <p style={{ color: 'var(--c-text-3)', marginBottom: 6 }}>{String(label)}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: String(p.color), fontWeight: 600 }}>
          {String(p.name)}: {String(p.value)}
        </p>
      ))}
    </div>
  )
}

/* ── Relative time ────────────────────────────────────────────── */
function formatLogDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const diff = Date.now() - d.getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (m < 2) return 'just now'
    if (m < 60) return `${m}m ago`
    if (h < 24) return `${h}h ago`
    if (days === 1) return 'yesterday'
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

/* ── Avatar color from name ───────────────────────────────────── */
const AVATAR_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6'
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

const QUICK_LINKS = [
  {
    label: 'Ordinances',
    icon: <ScrollText size={20} />,
    path: '/ordinances',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)'
  },
  {
    label: 'Resolutions',
    icon: <FileCheck size={20} />,
    path: '/resolutions',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.1)'
  },
  {
    label: 'Cal. of Business',
    icon: <BookOpen size={20} />,
    path: '/minutes',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)'
  },
  {
    label: 'Tricycle Franchise',
    icon: <Bike size={20} />,
    path: '/tricycle',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)'
  },
  {
    label: 'Barangay Actions',
    icon: <Building2 size={20} />,
    path: '/barangay',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.1)'
  },
  {
    label: 'Committees',
    icon: <BarChart2 size={20} />,
    path: '/committees',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.1)'
  },
  {
    label: 'Barangay Review',
    icon: <GitMerge size={20} />,
    path: '/review',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.1)'
  },
  {
    label: 'Activity Log',
    icon: <ClipboardCheck size={20} />,
    path: '/logs',
    color: '#64748b',
    bg: 'rgba(100,116,139,0.1)'
  }
]

/* ═══════════════════════════════════════════════════════════════ */
export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [stats, setStats] = useState<Stats>({
    generalOrdinances: 0,
    appropriation: 0,
    taxOrdinances: 0,
    generalResolutions: 0,
    commendations: 0,
    posthumous: 0
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    void loadDashboard()
  }, [])

  useEffect(() => {
    let active = true
    if (!user?.id) return

    const loadUpcomingBirthdays = async () => {
      try {
        const { data, error } = await supabase.rpc('upcoming_birthday_greetings')
        if (error) throw new Error(error.message)
        if (active) setUpcomingBirthdays((data ?? []) as UpcomingBirthday[])
      } catch (error) {
        console.error('[dashboard] failed to load upcoming birthdays:', error)
      }
    }
    void loadUpcomingBirthdays()

    return () => {
      active = false
    }
  }, [user?.id])

  async function loadDashboard(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const currentYear = new Date().getFullYear()
      const parseLogDate = (s: string) => new Date(s?.replace(/^[A-Za-z]+,\s*/, '') ?? '').getTime()

      const [
        logsRes,
        generalOrdinances,
        appropriation,
        taxOrdinances,
        generalResolutions,
        commendations,
        posthumous
      ] = await Promise.all([
        fetchDocs<Log>('activity_logs', {
          // newest first by insert time; the text 'date' field doesn't sort chronologically
          orderByField: 'createdAt',
          direction: 'desc',
          pageSize: 20
        }),
        countDocs('ordinances', {
          filters: [{ field: 'category', op: '==', value: 'General Ordinance' }]
        }),
        countDocs('ordinances', {
          filters: [{ field: 'category', op: '==', value: 'Appropriation' }]
        }),
        countDocs('ordinances', {
          filters: [{ field: 'category', op: '==', value: 'Tax Ordinance' }]
        }),
        countDocs('resolutions', {
          filters: [{ field: 'category', op: '==', value: 'General Resolutions' }]
        }),
        countDocs('resolutions', {
          filters: [{ field: 'category', op: '==', value: 'Commendations' }]
        }),
        countDocs('resolutions', {
          filters: [{ field: 'category', op: '==', value: 'Posthumous' }]
        })
      ])

      const yearLogs = logsRes.items.filter((l) => {
        const m = l.date?.match(/\b(20\d{2})\b/)
        return m ? parseInt(m[1]) === currentYear : false
      })
      yearLogs.sort((a, b) => {
        const da = parseLogDate(a.date)
        const db2 = parseLogDate(b.date)
        return isNaN(da) || isNaN(db2) ? 0 : db2 - da
      })
      setLogs(yearLogs.slice(0, 10))

      setStats({
        generalOrdinances,
        appropriation,
        taxOrdinances,
        generalResolutions,
        commendations,
        posthumous
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  /* ── Derived data ─────────────────────────────────────────── */
  const totalOrdinances = stats.generalOrdinances + stats.appropriation + stats.taxOrdinances
  const totalResolutions = stats.generalResolutions + stats.commendations + stats.posthumous
  const totalDocs = totalOrdinances + totalResolutions

  const recent30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 3600000
    return logs.filter((l) => {
      try {
        return new Date(l.date).getTime() > cutoff
      } catch {
        return false
      }
    }).length
  }, [logs])

  const activityData = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ]
    const map: Record<string, number> = {}
    months.forEach((m) => (map[m] = 0))
    logs.forEach((log) => {
      try {
        const yearMatch = log.date?.match(/\b(20\d{2})\b/)
        if (!yearMatch || parseInt(yearMatch[1]) !== currentYear) return
        const d = new Date(log.date?.replace(/^[A-Za-z]+,\s*/, '') ?? '')
        const key = isNaN(d.getTime()) ? null : d.toLocaleString('en-US', { month: 'short' })
        if (key && key in map) map[key]++
      } catch {
        /* skip */
      }
    })
    return months.map((month) => ({ month, activity: map[month] }))
  }, [logs])

  const distributionData = useMemo(
    () =>
      [
        { name: 'Gen. Ordinances', value: stats.generalOrdinances, color: PIE_COLORS[0] },
        { name: 'Appropriation', value: stats.appropriation, color: PIE_COLORS[1] },
        { name: 'Tax Ordinances', value: stats.taxOrdinances, color: PIE_COLORS[2] },
        { name: 'Gen. Resolutions', value: stats.generalResolutions, color: PIE_COLORS[3] },
        { name: 'Commendations', value: stats.commendations, color: PIE_COLORS[4] },
        { name: 'Posthumous', value: stats.posthumous, color: PIE_COLORS[5] }
      ].filter((d) => d.value > 0),
    [stats]
  )

  const comparisonData = useMemo(
    () => [
      {
        name: 'General',
        ordinances: stats.generalOrdinances,
        resolutions: stats.generalResolutions
      },
      { name: 'Approp./Comm.', ordinances: stats.appropriation, resolutions: stats.commendations },
      { name: 'Tax/Posth.', ordinances: stats.taxOrdinances, resolutions: stats.posthumous }
    ],
    [stats]
  )

  const fullName = user ? getFullName(user.firstName, user.middleName, user.lastName) : 'User'
  const now = new Date()
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const axisStyle = { fill: 'var(--c-text-3)', fontSize: 11 } as const
  const gridStroke = 'var(--c-divider)'
  const recentLogs = logs.slice(0, 8)

  const CATEGORY_CARDS: StatCardProps[] = [
    {
      label: 'General Ordinances',
      value: stats.generalOrdinances,
      icon: <ScrollText size={15} color="#fff" />,
      gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)',
      glow: 'rgba(59,130,246,0.3)',
      delay: 0
    },
    {
      label: 'Appropriation',
      value: stats.appropriation,
      icon: <TrendingUp size={15} color="#fff" />,
      gradient: 'linear-gradient(135deg,#10b981,#059669)',
      glow: 'rgba(16,185,129,0.3)',
      delay: 60
    },
    {
      label: 'Tax Ordinances',
      value: stats.taxOrdinances,
      icon: <Activity size={15} color="#fff" />,
      gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
      glow: 'rgba(245,158,11,0.3)',
      delay: 120
    },
    {
      label: 'General Resolutions',
      value: stats.generalResolutions,
      icon: <FileCheck size={15} color="#fff" />,
      gradient: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
      glow: 'rgba(139,92,246,0.3)',
      delay: 180
    },
    {
      label: 'Commendations',
      value: stats.commendations,
      icon: <Users size={15} color="#fff" />,
      gradient: 'linear-gradient(135deg,#ec4899,#db2777)',
      glow: 'rgba(236,72,153,0.3)',
      delay: 240
    },
    {
      label: 'Posthumous Resolutions',
      value: stats.posthumous,
      icon: <Calendar size={15} color="#fff" />,
      gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)',
      glow: 'rgba(6,182,212,0.3)',
      delay: 300
    }
  ]

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <Layout>
      <div
        className="scrollbar-thin animate-fade-in"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        {/* ── Welcome Banner ────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 16,
            padding: '16px 22px',
            flexShrink: 0,
            background:
              'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(79,70,229,0.08) 60%, var(--c-surface) 100%)',
            border: '1px solid rgba(37,99,235,0.2)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: -30,
              top: -30,
              width: 180,
              height: 180,
              borderRadius: '50%',
              opacity: 0.1,
              background: 'radial-gradient(circle, rgba(37,99,235,0.8) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 12, color: '#93c5fd', fontWeight: 500 }}>
                {`${greeting}, ${fullName}`}
              </p>
              <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 2 }}>{dateStr}</p>
              {upcomingBirthdays.map((birthday) => (
                <BirthdayGreeting
                  key={`${birthday.display_name}-${birthday.days_until}`}
                  birthday={birthday}
                />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* AionX badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 14px 6px 8px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <img
                  src={aionxLogo}
                  alt="AionX"
                  style={{ width: 64, height: 64, objectFit: 'contain' }}
                />
                <div style={{ lineHeight: 1 }}>
                  <p style={{ fontSize: 9, color: 'var(--c-text-3)', fontWeight: 500 }}>
                    Developed by
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: 'var(--c-text-2)',
                      fontWeight: 700,
                      marginTop: 2
                    }}
                  >
                    AionX IT Solutions
                  </p>
                </div>
              </div>
              <button
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: 12, gap: 6 }}
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin-slow' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI Summary cards ─────────────────────────────── */}
        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 14,
              flexShrink: 0
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 100 }} />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 14,
              flexShrink: 0
            }}
          >
            <KpiCard
              label="Total Ordinances"
              value={totalOrdinances}
              sub="General · Appropriation · Tax"
              icon={<ScrollText size={20} color="#fff" />}
              gradient="linear-gradient(135deg,#3b82f6,#2563eb)"
              glow="rgba(59,130,246,0.25)"
            />
            <KpiCard
              label="Total Resolutions"
              value={totalResolutions}
              sub="General · Commendations · Posthumous"
              icon={<FileCheck size={20} color="#fff" />}
              gradient="linear-gradient(135deg,#8b5cf6,#7c3aed)"
              glow="rgba(139,92,246,0.25)"
            />
            <KpiCard
              label="Total Documents"
              value={totalDocs}
              sub="All legislative records"
              icon={<Layers size={20} color="#fff" />}
              gradient="linear-gradient(135deg,#10b981,#059669)"
              glow="rgba(16,185,129,0.25)"
            />
            <KpiCard
              label="Activity Records"
              value={logs.length}
              sub={`${recent30} in the last 30 days`}
              icon={<Activity size={20} color="#fff" />}
              gradient="linear-gradient(135deg,#f59e0b,#d97706)"
              glow="rgba(245,158,11,0.25)"
            />
          </div>
        )}

        {/* ── Category breakdown cards ───────────────────────── */}
        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6,1fr)',
              gap: 12,
              flexShrink: 0
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 70 }} />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6,1fr)',
              gap: 12,
              flexShrink: 0
            }}
          >
            {CATEGORY_CARDS.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        )}

        {/* ── Charts Row: Area + Donut ───────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '7fr 5fr',
            gap: 16,
            height: 250,
            flexShrink: 0
          }}
        >
          {/* Activity Timeline */}
          <div
            className="card"
            style={{ padding: '16px 16px 10px', display: 'flex', flexDirection: 'column' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Activity size={13} color="#3b82f6" />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--c-text-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                >
                  Activity Timeline
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: 'rgba(59,130,246,0.1)',
                  color: '#93c5fd'
                }}
              >
                {new Date().getFullYear()}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill: 'transparent' }} />
                  <Area
                    type="monotone"
                    dataKey="activity"
                    name="Actions"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#areaGrad)"
                    dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Distribution */}
          <div
            className="card"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Layers size={13} color="#8b5cf6" />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--c-text-2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                Distribution
              </span>
            </div>
            <div style={{ flex: 1 }}>
              {distributionData.length === 0 ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--c-text-3)',
                    fontSize: 12
                  }}
                >
                  No data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="38%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {distributionData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                      <Label
                        position="center"
                        content={({ viewBox }) => {
                          const vb = viewBox as { cx?: number; cy?: number } | undefined
                          const cx = vb?.cx ?? 0
                          const cy = vb?.cy ?? 0
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan
                                x={cx}
                                dy="-6"
                                fontSize={20}
                                fontWeight={800}
                                fill="var(--c-text-1)"
                              >
                                {totalDocs}
                              </tspan>
                              <tspan x={cx} dy={18} fontSize={10} fill="var(--c-text-3)">
                                Total
                              </tspan>
                            </text>
                          )
                        }}
                      />
                    </Pie>
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      iconType="circle"
                      iconSize={6}
                      formatter={(value: string) => (
                        <span style={{ color: 'var(--c-text-3)', fontSize: 10 }}>{value}</span>
                      )}
                    />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'transparent' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom Row: Bar chart + Recent Activity ────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 16, flexShrink: 0 }}>
          {/* Bar chart */}
          <div
            className="card"
            style={{
              padding: '16px 16px 10px',
              display: 'flex',
              flexDirection: 'column',
              height: 280
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <ScrollText size={13} color="#10b981" />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--c-text-2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                Ordinances vs Resolutions
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={comparisonData}
                  margin={{ top: 4, right: 8, bottom: 0, left: -22 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ ...axisStyle, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill: 'transparent' }} />
                  <Bar
                    dataKey="ordinances"
                    name="Ordinances"
                    fill="#3b82f6"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="resolutions"
                    name="Resolutions"
                    fill="#8b5cf6"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div
            className="card"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: 280 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Clock size={13} color="#f59e0b" />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--c-text-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                >
                  Recent Activity
                </span>
              </div>
              <button
                onClick={() => navigate('/logs')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#3b82f6',
                  fontSize: 11,
                  fontWeight: 600
                }}
              >
                View all <ChevronRight size={12} />
              </button>
            </div>
            <div
              className="scrollbar-thin"
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}
            >
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />
                ))
              ) : recentLogs.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--c-text-3)',
                    fontSize: 12
                  }}
                >
                  No activity yet
                </div>
              ) : (
                recentLogs.map((log, i) => {
                  const initials = (log.name ?? '?')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                  const color = avatarColor(log.name ?? '')
                  return (
                    <div
                      key={log.id ?? i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '7px 8px',
                        borderRadius: 10,
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.background = 'var(--c-row-hover)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: color,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#fff'
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--c-text-1)',
                            lineHeight: 1.3
                          }}
                        >
                          {log.name}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--c-text-3)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: 1
                          }}
                        >
                          {log.activity}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--c-text-3)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        {formatLogDate(log.date)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Quick Navigation ───────────────────────────────── */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 2,
                background: 'linear-gradient(180deg,#3b82f6,#8b5cf6)'
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--c-text-2)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em'
              }}
            >
              Quick Navigation
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 10 }}>
            {QUICK_LINKS.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '16px 8px',
                  borderRadius: 14,
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: 'var(--c-card-shadow)'
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = link.bg
                  el.style.borderColor = link.color + '44'
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = `0 6px 20px ${link.color}22`
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = 'var(--c-surface)'
                  el.style.borderColor = 'var(--c-border)'
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = 'var(--c-card-shadow)'
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: link.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: link.color
                  }}
                >
                  {link.icon}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--c-text-2)',
                    textAlign: 'center',
                    lineHeight: 1.3
                  }}
                >
                  {link.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* bottom spacing */}
        <div style={{ height: 4 }} />
      </div>
    </Layout>
  )
}
