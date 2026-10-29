import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { App } from './app/App'
import { SchoolProvider } from './data/SchoolProvider'
import { ToastProvider } from './components/ui/ToastProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SchoolProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SchoolProvider>
    </BrowserRouter>
  </StrictMode>,
)
