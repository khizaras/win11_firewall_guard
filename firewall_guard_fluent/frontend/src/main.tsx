import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { FluentThemeProvider } from './theme';
import './styles.css';

const qc = new QueryClient({
  defaultOptions: {
    queries: { refetchInterval: 6000, retry: 1, refetchOnWindowFocus: false, structuralSharing: true },
  },
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FluentThemeProvider>
      <QueryClientProvider client={qc}>
        <App />
      </QueryClientProvider>
    </FluentThemeProvider>
  </React.StrictMode>,
);
