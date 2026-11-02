import { useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Sparkles, User } from 'lucide-react'
import { toast } from 'sonner'
import { signIn } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'

const CORNER_SIZE = 18

function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const vertical = position[0] === 't' ? 'top' : 'bottom'
  const horizontal = position[1] === 'l' ? 'left' : 'right'
  const edge = '2px solid var(--accent-primary)'
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        [vertical]: -1,
        [horizontal]: -1,
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderTop: vertical === 'top' ? edge : undefined,
        borderBottom: vertical === 'bottom' ? edge : undefined,
        borderLeft: horizontal === 'left' ? edge : undefined,
        borderRight: horizontal === 'right' ? edge : undefined,
        borderTopLeftRadius: position === 'tl' ? 20 : undefined,
        borderTopRightRadius: position === 'tr' ? 20 : undefined,
        borderBottomLeftRadius: position === 'bl' ? 20 : undefined,
        borderBottomRightRadius: position === 'br' ? 20 : undefined,
        opacity: 0.6,
        pointerEvents: 'none'
      }}
    />
  )
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  letterSpacing: '0.02em'
}

function inputStyle(focused: boolean, invalid: boolean, padRight = 12): CSSProperties {
  return {
    width: '100%',
    height: 42,
    paddingLeft: 34,
    paddingRight: padRight,
    paddingTop: 0,
    paddingBottom: 0,
    lineHeight: 'normal',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${invalid ? 'rgba(239,68,68,0.6)' : focused ? 'var(--accent-primary)' : 'var(--border-default)'}`,
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    boxShadow: invalid
      ? '0 0 0 3px rgba(239,68,68,0.15)'
      : focused
        ? '0 0 0 3px var(--accent-primary-glow)'
        : 'none'
  }
}

function iconStyle(focused: boolean): CSSProperties {
  return {
    position: 'absolute',
    left: 11,
    top: '50%',
    transform: 'translateY(-50%)',
    color: focused ? 'var(--accent-primary)' : 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    transition: 'color 0.15s ease'
  }
}

export function LoginForm() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError('Please enter your username and password')
      return
    }
    setSubmitting(true)
    try {
      const user = await signIn(username, password)
      setUser(user)
      toast.success(`Welcome, ${user.firstName || user.username}!`)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      style={{ width: '100%', maxWidth: 410, position: 'relative', margin: '24px 0' }}
    >
      <div
        style={{
          position: 'relative',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(28px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 22,
          boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 20px rgba(0,0,0,0.1)',
          padding: '38px 38px 34px',
          overflow: 'hidden'
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: 2,
            background:
              'linear-gradient(90deg, transparent, var(--accent-primary), var(--accent-cyan), transparent)',
            opacity: 0.8
          }}
        />
        <Corner position="tl" />
        <Corner position="tr" />
        <Corner position="bl" />
        <Corner position="br" />

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent-primary)',
            marginBottom: 10
          }}
        >
          <Sparkles size={12} />
          Welcome back
        </div>
        <h2
          style={{
            fontSize: 23,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: 6
          }}
        >
          Sign in to your account
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>
          Use the username and password from your administrator.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle} htmlFor="login-username">
                Username or email
              </label>
              <div style={{ position: 'relative' }}>
                <span style={iconStyle(focusedField === 'username')}>
                  <User size={14} />
                </span>
                <input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  autoFocus
                  style={inputStyle(focusedField === 'username', !!error && !username.trim())}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle} htmlFor="login-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span style={iconStyle(focusedField === 'password')}>
                  <Lock size={14} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={inputStyle(focusedField === 'password', !!error && !password, 40)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                    borderRadius: 4
                  }}
                >
                  {showPassword ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 12px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 8,
                    color: '#f87171',
                    fontSize: 12,
                    overflow: 'hidden'
                  }}
                >
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              whileTap={submitting ? {} : { scale: 0.97 }}
              disabled={submitting}
              style={{
                position: 'relative',
                width: '100%',
                height: 44,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background:
                  'linear-gradient(120deg, var(--accent-primary) 0%, var(--accent-cyan) 45%, var(--accent-primary) 100%)',
                backgroundSize: '220% auto',
                animation: submitting ? undefined : 'shimmer 4.5s linear infinite',
                border: 'none',
                borderRadius: 11,
                color: '#fff',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.75 : 1,
                fontFamily: 'inherit',
                boxShadow: '0 0 26px var(--accent-primary-glow)'
              }}
            >
              {submitting ? (
                <svg
                  style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={15} />
                </>
              )}
            </motion.button>
          </div>
        </form>

        <p
          style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.5
          }}
        >
          © {new Date().getFullYear()} City Government of Candon
        </p>
      </div>
    </motion.div>
  )
}
