import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { Breadcrumb } from './Breadcrumb'

/** Title bar + sidebar + content area for signed-in screens (rendered once, in App). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">
          <Breadcrumb />
          {children}
        </main>
      </div>
    </div>
  )
}

/**
 * Pages still wrap themselves in <Layout>; the shell now lives in App so it isn't
 * remounted on every navigation (which also lets the sidebar's active pill glide).
 */
export function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
  }
}

/** Page body with the GSPIS-style enter animation. */
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 24px 20px',
        overflow: 'hidden',
        minHeight: 0
      }}
    >
      {children}
    </motion.div>
  )
}
