import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { isStandalone, requestPersistence } from './app/platform'
import './index.css'

// Installed apps get eviction protection automatically where the browser allows it.
if (isStandalone()) void requestPersistence()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
