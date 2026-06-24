import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, HashRouter } from 'react-router-dom';

import './index.css'; // includes self-hosted @font-face (see public/fonts)
import App from './App';
import { ToastProvider } from './components/Toast';
import { IS_WP } from './lib/wp';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

// WP admin page is a single PHP entry (no SPA rewrite) → hash routing.
// Standalone is herd-linked with SPA fallback → clean BrowserRouter URLs.
const Router = IS_WP ? HashRouter : BrowserRouter;
const mount = document.getElementById('strata-root') ?? document.getElementById('root')!;

createRoot(mount).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <ToastProvider>
          <App />
        </ToastProvider>
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
