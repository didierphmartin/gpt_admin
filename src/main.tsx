import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BackendHealthBanner } from './components/BackendHealthBanner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outside App so it also covers the login screen, where a dead backend bites first. */}
    <BackendHealthBanner />
    <App />
  </StrictMode>,
)
