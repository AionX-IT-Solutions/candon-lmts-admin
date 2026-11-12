import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Compass, Minus, Moon, Search, Square, Sun, X } from 'lucide-react'
import { toast } from 'sonner'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { Tooltip } from '../ui/Tooltip'
import { isNavGroup, navEntries, type NavItem } from './navigation'

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }

const ipc = () => window.electron.ipcRenderer

// ─── Window button ────────────────────────────────────────────────────────────

function WindowButton({
  onClick,
  hoverColor,
  hoverGlow,
  title,
  children
}: {
  onClick: () => void
  hoverColor: string
  hoverGlow: string
  title: string
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const style: ElectronStyle = {
    width: 32,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: hovered ? hoverColor : 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: hovered ? '#fff' : 'var(--text-muted)',
    transition: 'all 0.15s ease',
    borderRadius: 6,
    WebkitAppRegion: 'no-drag',
    boxShadow: hovered ? `0 0 12px ${hoverGlow}` : 'none'
  }
  return (
    <Tooltip content={title} side="bottom">
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={style}
      >
        {children}
      </button>
    </Tooltip>
  )
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const [hovered, setHovered] = useState(false)
  const isDark = theme === 'dark'

  const style: ElectronStyle = {
    width: 32,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: hovered
      ? isDark
        ? 'rgba(251,191,36,0.12)'
        : 'rgba(99,102,241,0.12)'
      : 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: hovered ? (isDark ? '#fbbf24' : 'var(--accent-primary)') : 'var(--text-muted)',
    transition: 'all 0.15s ease',
    borderRadius: 6,
    WebkitAppRegion: 'no-drag'
  }

  return (
    <Tooltip content={isDark ? 'Switch to light mode' : 'Switch to dark mode'} side="bottom">
      <button
        onClick={toggleTheme}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={style}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
          </motion.span>
        </AnimatePresence>
      </button>
    </Tooltip>
  )
}

// ─── Module search (Ctrl+K) ───────────────────────────────────────────────────

function SearchBar() {
  const navigate = useNavigate()
  const hasPrivilege = useAuthStore((s) => s.hasPrivilege)
  const isDark = useUIStore((s) => s.theme) === 'dark'
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const modules = useMemo(
    () =>
      navEntries
        .flatMap((entry) =>
          isNavGroup(entry)
            ? entry.items.map((item) => ({ item, group: entry.title }))
            : [{ item: entry, group: 'Overview' }]
        )
        .filter(({ item }) => !item.privilege || hasPrivilege(item.privilege)),
    [hasPrivilege]
  )
  const query = value.trim().toLowerCase()
  const results = query
    ? modules.filter(
        ({ item, group }) =>
          item.label.toLowerCase().includes(query) || group.toLowerCase().includes(query)
      )
    : []

  function goTo(item: NavItem) {
    navigate(item.path)
    setOpen(false)
    setValue('')
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setActiveIndex(0), [value])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
    else setValue('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const chip = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const chipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  return (
    <div
      ref={containerRef}
      style={
        {
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          WebkitAppRegion: 'no-drag'
        } as ElectronStyle
      }
    >
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="input"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden', display: 'flex', alignItems: 'center' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: chip,
                border: `1px solid ${chipBorder}`,
                borderRadius: 8,
                padding: '3px 8px',
                width: 280
              }}
            >
              <Search size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActiveIndex((i) => Math.min(i + 1, results.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveIndex((i) => Math.max(i - 1, 0))
                  } else if (e.key === 'Enter' && results[activeIndex]) {
                    e.preventDefault()
                    goTo(results[activeIndex].item)
                  }
                }}
                placeholder="Go to a module…"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  width: '100%',
                  caretColor: 'var(--accent-primary)'
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  background: chip,
                  border: `1px solid ${chipBorder}`,
                  borderRadius: 4,
                  padding: '1px 4px',
                  fontFamily: "'JetBrains Mono', monospace",
                  flexShrink: 0
                }}
              >
                ESC
              </span>
            </div>
          </motion.div>
        ) : (
          <Tooltip key="icon" content="Search modules (Ctrl+K)" side="bottom">
            <motion.button
              aria-label="Search modules"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={() => setOpen(true)}
              style={{
                width: 32,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                borderRadius: 6
              }}
              whileHover={{ background: chip, color: 'var(--text-primary)' }}
            >
              <Search size={13} />
            </motion.button>
          </Tooltip>
        )}
      </AnimatePresence>

      {open && query && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: 320,
            maxHeight: 360,
            overflowY: 'auto',
            background: 'var(--popover-bg)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--popover-border)',
            borderRadius: 12,
            boxShadow: 'var(--popover-shadow)',
            zIndex: 500,
            padding: 6
          }}
        >
          {results.length === 0 ? (
            <p
              style={{
                padding: '18px 0',
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--text-muted)'
              }}
            >
              No modules match “{value}”
            </p>
          ) : (
            results.map(({ item, group }, i) => {
              const Icon = item.icon
              return (
                <div
                  key={item.path}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    goTo(item)
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: i === activeIndex ? 'var(--popover-item-hover)' : 'transparent'
                  }}
                >
                  <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>
                    <Icon size={13} />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-muted)',
                      flexShrink: 0
                    }}
                  >
                    <Compass size={10} />
                    {group}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── Notification bell (history of this session's toasts) ─────────────────────

interface NotificationItem {
  id: string
  message: string
  type: string
  timestamp: number
}

function useToastHistory() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const seenAt = useRef(new Map<string, number>())
  const hidden = useRef(new Set<string>())

  useEffect(() => {
    const read = () => {
      const next: NotificationItem[] = []
      for (const t of toast.getHistory()) {
        if (!('title' in t) || typeof t.title !== 'string') continue
        const id = String(t.id)
        if (hidden.current.has(id)) continue
        if (!seenAt.current.has(id)) seenAt.current.set(id, Date.now())
        next.push({
          id,
          message: t.title,
          type: t.type ?? 'default',
          timestamp: seenAt.current.get(id)!
        })
      }
      next.reverse()
      setItems((prev) =>
        prev.length === next.length && prev.every((p, i) => p.id === next[i].id) ? prev : next
      )
    }
    read()
    const timer = setInterval(read, 1500)
    return () => clearInterval(timer)
  }, [])

  return {
    items,
    remove: (id: string) => {
      hidden.current.add(id)
      setItems((prev) => prev.filter((p) => p.id !== id))
    },
    clear: () => {
      items.forEach((p) => hidden.current.add(p.id))
      setItems([])
    }
  }
}

function NotificationBell() {
  const isDark = useUIStore((s) => s.theme) === 'dark'
  const { items, remove, clear } = useToastHistory()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = items.length

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const dotColor = (type: string) =>
    type === 'success'
      ? '#10b981'
      : type === 'error'
        ? '#ef4444'
        : type === 'warning'
          ? '#f59e0b'
          : 'var(--accent-primary)'

  return (
    <div ref={ref} style={{ position: 'relative', WebkitAppRegion: 'no-drag' } as ElectronStyle}>
      <Tooltip content="Notifications" side="bottom">
        <button
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'relative',
            width: 32,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: open
              ? 'rgba(99,102,241,0.12)'
              : hovered
                ? isDark
                  ? 'rgba(255,255,255,0.07)'
                  : 'rgba(0,0,0,0.06)'
                : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: open
              ? 'var(--accent-primary)'
              : hovered
                ? 'var(--text-primary)'
                : 'var(--text-muted)',
            borderRadius: 6,
            transition: 'all 0.15s ease'
          }}
        >
          <Bell size={13} />
          {unread > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: unread > 9 ? 14 : 8,
                height: 8,
                borderRadius: 999,
                background: 'var(--accent-primary)',
                boxShadow: '0 0 6px var(--accent-primary-glow)',
                fontSize: 8,
                fontWeight: 700,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}
            >
              {unread > 9 ? '9+' : ''}
            </span>
          )}
        </button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: 300,
              background: 'var(--popover-bg)',
              backdropFilter: 'blur(24px)',
              border: '1px solid var(--popover-border)',
              borderRadius: 12,
              boxShadow: 'var(--popover-shadow)',
              zIndex: 500,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px 10px',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)'
                }}
              >
                Notifications
                {unread > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      background: 'var(--accent-primary)',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '1px 6px',
                      fontSize: 9,
                      fontWeight: 700
                    }}
                  >
                    {unread}
                  </span>
                )}
              </span>
              {unread > 0 && (
                <button
                  onClick={clear}
                  style={{
                    fontSize: 11,
                    color: 'var(--accent-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: 4
                  }}
                >
                  Clear all
                </button>
              )}
            </div>

            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {items.length === 0 ? (
                <div
                  style={{
                    padding: '28px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <Bell size={20} color="var(--text-muted)" strokeWidth={1.5} />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No notifications</p>
                </div>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--popover-item-hover)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: dotColor(n.type),
                        flexShrink: 0,
                        marginTop: 5
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--text-primary)',
                          lineHeight: 1.4,
                          wordBreak: 'break-word'
                        }}
                      >
                        {n.message}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(n.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(n.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: 2,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Auto-update notices ──────────────────────────────────────────────────────

function useUpdateNotices() {
  useEffect(() => {
    const offAvailable = ipc().on('update-available', (_e, version: string) => {
      toast.info(`Update v${version} is downloading…`, { duration: 5000 })
    })
    const offDownloaded = ipc().on('update-downloaded', () => {
      toast.success('Update ready to install.', {
        duration: Infinity,
        action: { label: 'Restart & Update', onClick: () => ipc().send('install-update') }
      })
    })
    const offError = ipc().on('update-error', (_e, message: string) => {
      toast.error(`Update failed: ${message}`, { duration: 8000 })
    })
    return () => {
      offAvailable()
      offDownloaded()
      offError()
    }
  }, [])
}

// ─── Title bar ────────────────────────────────────────────────────────────────

/** `minimal` (login screen) keeps only the theme toggle and window controls. */
export function TitleBar({ minimal = false }: { minimal?: boolean }) {
  const isDark = useUIStore((s) => s.theme) === 'dark'
  const [version, setVersion] = useState('')

  useEffect(() => {
    ipc()
      .invoke('app-version')
      .then((v: string) => setVersion(v))
      .catch(() => {})
  }, [])

  const divider = (
    <div
      style={{
        width: 1,
        height: 16,
        background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
        margin: '0 2px'
      }}
    />
  )

  return (
    <div
      style={
        {
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--titlebar-bg)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--sidebar-border)',
          boxShadow: 'var(--titlebar-shadow)',
          flexShrink: 0,
          WebkitAppRegion: 'drag',
          userSelect: 'none',
          paddingLeft: 14,
          paddingRight: 4,
          position: 'relative',
          zIndex: 100
        } as ElectronStyle
      }
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          fontFamily: "'JetBrains Mono', monospace"
        }}
      >
        {version ? `LMTS v${version}` : 'LMTS'}
      </span>

      <div style={{ flex: 1 }} />

      <div
        style={
          {
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            WebkitAppRegion: 'no-drag'
          } as ElectronStyle
        }
      >
        {!minimal && (
          <>
            <SearchBar />
            <NotificationBell />
            {divider}
          </>
        )}
        <ThemeToggle />
        {divider}
        <WindowButton
          onClick={() => ipc().send('window-minimize')}
          hoverColor="rgba(251,191,36,0.15)"
          hoverGlow="rgba(251,191,36,0.5)"
          title="Minimize"
        >
          <Minus size={12} />
        </WindowButton>
        <WindowButton
          onClick={() => ipc().send('window-toggle-maximize')}
          hoverColor="rgba(34,197,94,0.15)"
          hoverGlow="rgba(34,197,94,0.5)"
          title="Maximize"
        >
          <Square size={10} />
        </WindowButton>
        <WindowButton
          onClick={() => ipc().send('window-close')}
          hoverColor="rgba(239,68,68,0.2)"
          hoverGlow="rgba(239,68,68,0.5)"
          title="Close"
        >
          <X size={13} />
        </WindowButton>
      </div>
    </div>
  )
}

/** Mounted once for the whole app so update notices show on every screen. */
export function UpdateNotices() {
  useUpdateNotices()
  return null
}
