import { useEffect, useState } from 'react'
import { Download, FileWarning } from 'lucide-react'
import { downloadStoredFile, setFileViewer } from '../../lib/db'
import { Modal } from './Modal'
import { Spinner } from './Spinner'

// PDFs and pictures show inside the app; anything else can only be downloaded.
const VIEWABLE = /\.(pdf|png|jpe?g|gif|webp|bmp|svg)$/i

/** File name for the title and Download: the stored name minus the "_<time>_<random>" upload suffix. */
function displayName(path: string): string {
  const name = decodeURIComponent(path.split('/').pop() ?? 'file')
  return name.replace(/_[a-z0-9]+_[a-z0-9]{6}(\.[^.]+)$/i, '$1')
}

/**
 * The in-app viewer behind every "View" (lib/db openStoredFile), as in GSPIS Admin: the file is
 * downloaded into a blob: URL and shown in an <iframe> with Chromium's built-in PDF viewer
 * (main process: webPreferences.plugins). Mounted once, in App.tsx.
 */
export function FileViewerModal() {
  const [path, setPath] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setFileViewer(setPath)
    return () => setFileViewer(null)
  }, [])

  useEffect(() => {
    if (!path) return
    let cancelled = false
    let objectUrl = ''
    setUrl(null)
    setError('')
    downloadStoredFile(path)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Cannot open the file')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  const name = path ? displayName(path) : ''
  const viewable = VIEWABLE.test(name)

  function download() {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
  }

  return (
    <Modal
      open={!!path}
      onClose={() => setPath(null)}
      title={name || 'File'}
      size="full"
      footer={
        <>
          <button className="btn-secondary" onClick={() => setPath(null)}>
            Close
          </button>
          <button className="btn-primary" onClick={download} disabled={!url}>
            <Download size={15} />
            Download
          </button>
        </>
      }
    >
      <div
        style={{
          margin: '-20px -24px',
          height: 'calc(100% + 40px)',
          background: '#525659',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {error ? (
          <p style={{ color: '#fecaca', fontSize: 13 }}>{error}</p>
        ) : !url ? (
          <Spinner />
        ) : viewable ? (
          <iframe
            src={url}
            title={name}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              color: '#e5e7eb',
              fontSize: 13
            }}
          >
            <FileWarning size={28} />
            This file type can&apos;t be shown here — use Download to open it.
          </div>
        )}
      </div>
    </Modal>
  )
}
