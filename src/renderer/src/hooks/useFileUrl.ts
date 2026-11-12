import { useEffect, useState } from 'react'
import { getFileUrl } from '../lib/db'

/** Signed URL for a stored file (e.g. a profile photo), or null while loading / when absent. */
export function useFileUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    if (!path) return
    getFileUrl(path)
      .then((signed) => {
        if (!cancelled) setUrl(signed)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  return url
}
