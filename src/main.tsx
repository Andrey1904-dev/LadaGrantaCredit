import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { enableWebpAssets } from './lib/assets'

// Кадры Granta хранятся и в JPEG/PNG, и в WebP — подставляем WebP там,
// где браузер его поддерживает (визуально страница не меняется).
enableWebpAssets()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
