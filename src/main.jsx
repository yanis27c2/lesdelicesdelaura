import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Nouvelle version détectée, rechargement automatique...');
    window.location.reload();
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

