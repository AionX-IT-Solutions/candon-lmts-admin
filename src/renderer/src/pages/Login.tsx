import { motion } from 'framer-motion'
import { BrandPanel } from './login/BrandPanel'
import { LoginForm } from './login/LoginForm'

export function LoginPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
    >
      <BrandPanel />

      <div
        style={{
          flex: 1,
          minWidth: 360,
          position: 'relative',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
          padding: 24
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '15%',
            left: '20%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            opacity: 0.06,
            filter: 'blur(100px)',
            pointerEvents: 'none'
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: '15%',
            right: '20%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'var(--accent-cyan)',
            opacity: 0.05,
            filter: 'blur(80px)',
            pointerEvents: 'none'
          }}
        />

        <LoginForm />
      </div>
    </motion.div>
  )
}
