import './index.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/inter/900.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// A file dropped anywhere but an attachment field would make Chromium open it in place of the app.
// Attachment fields handle their own drops first (and mark the event handled).
window.addEventListener('dragover', (e) => {
  if (e.defaultPrevented || !e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'none'
})
window.addEventListener('drop', (e) => {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
