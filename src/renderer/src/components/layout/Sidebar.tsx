import { forwardRef, useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { getFullName } from '../../lib/utils'
import { Tooltip } from '../ui/Tooltip'
import { isNavGroup, navEntries, type NavGroup, type NavItem } from './navigation'
import lmtsMark from '../../assets/lmts-mark.svg'

// ─── Nav item ─────────────────────────────────────────────────────────────────

interface SidebarNavItemProps extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'
> {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  onClick: () => void
}

const SidebarNavItem = forwardRef<HTMLButtonElement, SidebarNavItemProps>(function SidebarNavItem(
  { item, isActive, collapsed, onClick, onMouseEnter, onMouseLeave, ...rest },
  ref
) {
  const [hovered, setHovered] = useState(false)
  const Icon = item.icon

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseEnter={(e) => {
        setHovered(true)
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        setHovered(false)
        onMouseLeave?.(e)
      }}
      {...rest}
      whileTap={{ scale: 0.97 }}
      style={{
        width: '100%',
        height: 38,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '0 11px' : '0 12px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        background: !isActive && hovered ? 'var(--sidebar-nav-hover)' : 'transparent',
        transition: 'background 0.15s ease',
        justifyContent: collapsed ? 'center' : 'flex-start',
        flexShrink: 0
      }}
    >
      {/* Shared active pill — glides between items via framer-motion layoutId */}
      {isActive && (
        <motion.span
          layoutId="sidebarActivePill"
          transition={{ type: 'spring', stiffness: 500, damping: 40, mass: 0.6 }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 10,
            background:
              'linear-gradient(135deg, var(--accent-primary-subtle) 0%, rgba(99, 102, 241, 0.03) 100%)',
            border: '1px solid var(--accent-primary-subtle)',
            boxShadow: '0 2px 14px rgba(99, 102, 241, 0.18), inset 3px 0 0 var(--accent-primary)',
            zIndex: 0
          }}
        />
      )}

      <motion.span
        animate={{ scale: hovered && !isActive ? 1.08 : 1 }}
        transition={{ duration: 0.15 }}
        style={{
          color: isActive
            ? 'var(--accent-primary)'
            : hovered
              ? 'var(--text-primary)'
              : 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          transition: 'color 0.15s ease',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
          filter: isActive ? 'drop-shadow(0 0 6px var(--accent-primary-glow))' : 'none'
        }}
      >
        <Icon size={16} />
      </motion.span>

      {!collapsed && (
        <span
          style={{
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            color: isActive || hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            transition: 'color 0.15s ease',
            position: 'relative',
            zIndex: 1
          }}
        >
          {item.label}
        </span>
      )}
    </motion.button>
  )
})

// ─── Collapsible nav group ────────────────────────────────────────────────────

interface NavGroupSectionProps {
  group: NavGroup
  collapsed: boolean
  isActive: (path: string) => boolean
  onNavigate: (path: string) => void
}

function NavGroupSection({ group, collapsed, isActive, onNavigate }: NavGroupSectionProps) {
  const hasActiveChild = group.items.some((item) => isActive(item.path))
  const [open, setOpen] = useState(hasActiveChild)
  const [headerHovered, setHeaderHovered] = useState(false)
  const GroupIcon = group.icon

  useEffect(() => {
    if (hasActiveChild) setOpen(true)
  }, [hasActiveChild])

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {group.items.map((item) => (
          <Tooltip key={item.path} content={item.label} side="right">
            <SidebarNavItem
              item={item}
              isActive={isActive(item.path)}
              collapsed
              onClick={() => onNavigate(item.path)}
            />
          </Tooltip>
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          width: '100%',
          height: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: '2px 0',
          padding: '0 12px',
          borderRadius: 8,
          background: headerHovered ? 'var(--sidebar-nav-hover)' : 'none',
          border: 'none',
          cursor: 'pointer',
          color: headerHovered ? 'var(--text-secondary)' : 'var(--text-muted)',
          transition: 'background 0.15s ease, color 0.15s ease'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', opacity: 0.85 }}>
          <GroupIcon size={16} />
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em'
          }}
        >
          {group.title}
        </span>
        <ChevronDown
          size={12}
          style={{
            marginLeft: 'auto',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease'
          }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                paddingTop: 2,
                paddingBottom: 4
              }}
            >
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.path}
                  item={item}
                  isActive={isActive(item.path)}
                  collapsed={false}
                  onClick={() => onNavigate(item.path)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Logout icon button ───────────────────────────────────────────────────────

// forwardRef + rest props so the Tooltip trigger (Radix asChild) can attach to it
const LogoutIconButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<'button'> & { onLogout: () => void }
>(function LogoutIconButton({ onLogout, onMouseEnter, onMouseLeave, ...rest }, ref) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      ref={ref}
      {...rest}
      onClick={onLogout}
      onMouseEnter={(e) => {
        setHovered(true)
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        setHovered(false)
        onMouseLeave?.(e)
      }}
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        background: hovered ? 'rgba(239,68,68,0.12)' : 'transparent',
        border: hovered ? '1px solid rgba(239,68,68,0.25)' : '1px solid transparent',
        cursor: 'pointer',
        color: hovered ? '#ef4444' : 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s ease'
      }}
    >
      <LogOut size={14} />
    </button>
  )
})

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const hasPrivilege = useAuthStore((s) => s.hasPrivilege)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed)

  // Exact match or a real sub-route, so /draft-ordinances never lights up /ordinances.
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  const visible = (item: NavItem) => !item.privilege || hasPrivilege(item.privilege)
  const visibleEntries = navEntries
    .map((entry) => (isNavGroup(entry) ? { ...entry, items: entry.items.filter(visible) } : entry))
    .filter((entry) => (isNavGroup(entry) ? entry.items.length > 0 : visible(entry)))

  const fullName = user ? getFullName(user.firstName, user.middleName, user.lastName) : ''
  const initials =
    [user?.firstName, user?.lastName]
      .map((p) => (p ?? '').trim().charAt(0))
      .join('')
      .toUpperCase() || 'LMTS'

  function handleLogout() {
    window.electron.ipcRenderer.send('window-restore-login')
    logout()
    navigate('/login')
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 270 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sidebar-shadow)',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10
      }}
    >
      {/* ── Header: logo + title + collapse ───────────────────── */}
      <div
        style={{
          minHeight: 66,
          padding: collapsed ? '9px 12px' : '12px 12px 12px 14px',
          borderBottom: '1px solid var(--sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          flexShrink: 0,
          transition: 'padding 0.25s ease'
        }}
      >
        <Tooltip content={collapsed ? 'Expand sidebar' : ''} side="right">
          <button
            onClick={() => collapsed && setSidebarCollapsed(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'none',
              border: 'none',
              cursor: collapsed ? 'pointer' : 'default',
              padding: 0,
              overflow: 'hidden',
              minWidth: 0
            }}
          >
            <img
              src={lmtsMark}
              alt="LMTS"
              draggable={false}
              style={{
                width: collapsed ? 40 : 46,
                height: collapsed ? 40 : 46,
                flexShrink: 0,
                display: 'block',
                filter: 'drop-shadow(0 4px 14px rgba(99,102,241,0.35))',
                transition: 'width 0.25s ease, height 0.25s ease'
              }}
            />
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                style={{ overflow: 'hidden', minWidth: 0, textAlign: 'left' }}
              >
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: 12.5,
                    lineHeight: 1.3,
                    color: 'var(--text-primary)',
                    maxWidth: 175
                  }}
                >
                  Sangguniang Panlungsod
                </p>
                <p
                  style={{
                    fontSize: 10,
                    marginTop: 3,
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  City of Candon · LMTS
                </p>
              </motion.div>
            )}
          </button>
        </Tooltip>

        {!collapsed && (
          <Tooltip content="Collapse sidebar" side="right">
            <button
              onClick={() => setSidebarCollapsed(true)}
              style={{
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 7,
                border: '1px solid var(--sidebar-border)',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--sidebar-nav-hover)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <ChevronLeft size={13} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav
        style={{
          flex: 1,
          padding: collapsed ? '10px 8px' : '10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: collapsed ? 2 : 6,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none'
        }}
      >
        {visibleEntries.map((entry) => {
          if (isNavGroup(entry)) {
            return (
              <NavGroupSection
                key={entry.title}
                group={entry}
                collapsed={collapsed}
                isActive={isActive}
                onNavigate={navigate}
              />
            )
          }
          const navItem = (
            <SidebarNavItem
              key={entry.path}
              item={entry}
              isActive={isActive(entry.path)}
              collapsed={collapsed}
              onClick={() => navigate(entry.path)}
            />
          )
          return collapsed ? (
            <Tooltip key={entry.path} content={entry.label} side="right">
              {navItem}
            </Tooltip>
          ) : (
            navItem
          )
        })}
      </nav>

      {/* ── Expand (collapsed only) ────────────────────────────── */}
      {collapsed && (
        <div
          style={{
            padding: '10px 8px 0',
            borderTop: '1px solid var(--sidebar-border)',
            flexShrink: 0
          }}
        >
          <Tooltip content="Expand sidebar" side="right">
            <button
              onClick={() => setSidebarCollapsed(false)}
              style={{
                width: '100%',
                height: 34,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1px solid var(--sidebar-border)',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--sidebar-nav-hover)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* ── User ───────────────────────────────────────────────── */}
      <div
        style={{
          padding: collapsed ? '10px 8px' : '8px',
          borderTop: collapsed ? 'none' : '1px solid var(--sidebar-border)',
          flexShrink: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            overflow: 'hidden',
            minWidth: 0,
            padding: collapsed ? 0 : '6px 8px',
            borderRadius: 10,
            background: collapsed ? 'transparent' : 'var(--glass-bg)',
            border: collapsed ? '1px solid transparent' : '1px solid var(--glass-border)'
          }}
        >
          <Tooltip content={collapsed ? 'Logout' : fullName} side="right">
            <button
              onClick={collapsed ? handleLogout : undefined}
              style={{
                position: 'relative',
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'transparent',
                border: 'none',
                padding: 0,
                flexShrink: 0,
                cursor: collapsed ? 'pointer' : 'default'
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background:
                    'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-cyan) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'white',
                  boxShadow: '0 0 12px var(--accent-primary-glow)'
                }}
              >
                {initials}
              </div>
              <span
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'var(--accent-emerald)',
                  border: '2px solid var(--bg-elevated)',
                  boxShadow: '0 0 6px var(--accent-emerald-glow)'
                }}
              />
            </button>
          </Tooltip>

          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                overflow: 'hidden'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {fullName || user?.username || 'Guest'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {user?.role || '—'}
                </div>
              </div>
              <Tooltip content="Logout" side="top">
                <LogoutIconButton onLogout={handleLogout} />
              </Tooltip>
            </motion.div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
