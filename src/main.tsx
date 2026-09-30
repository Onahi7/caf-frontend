import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/query-client'

// Global error handler for uncaught promises (like MetaMask browser extension connection errors)
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = String(event.reason?.message || event.reason?.cause || event.reason || '');
  if (
    reasonStr.includes('MetaMask') || 
    reasonStr.includes('ethereum') ||
    reasonStr.includes('extension not found') ||
    reasonStr.includes('Failed to connect to MetaMask') ||
    reasonStr.includes('Error restoring session')
  ) {
    event.preventDefault();
    return;
  }
  
  // Log other unhandled promise rejections
  console.error('Unhandled promise rejection:', event.reason);
});

// Prevent inadvertent mousewheel adjustments on number inputs when scrolling
window.addEventListener(
  'wheel',
  () => {
    if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'number') {
      document.activeElement.blur();
    }
  },
  { passive: true, capture: true }
);

// Auto-recover from dynamic import chunk failures during fresh deployments
window.addEventListener('vite:preloadError', () => {
  const reloadKey = 'caf_chunk_reload_ts';
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
    sessionStorage.setItem(reloadKey, now.toString());
    const doReload = () => {
      window.location.reload();
    };
    if (typeof caches !== 'undefined') {
      caches.keys().then((names) => {
        Promise.all(names.map((n) => caches.delete(n))).finally(doReload);
      }).catch(doReload);
    } else {
      doReload();
    }
  }
});

const bootstrap = async () => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
