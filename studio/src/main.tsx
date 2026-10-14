import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/press-start-2p/400.css'
import './studio.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Studio } from './Studio'
import { STUDIO_PROJECTS } from './projects'

// Theme, cursor art and audio unlock come from the project the studio boots in —
// the studio itself imports no game UI module.
STUDIO_PROJECTS[0]?.installChrome?.()

const rootElement = document.getElementById('studio-root')
if (!rootElement) throw new Error('#studio-root element not found')
createRoot(rootElement).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
)
