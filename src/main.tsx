import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import './i18n';
import App from './App.tsx';
import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL;

const isValidConvexUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (parsed.hostname.endsWith(".convex.cloud") || parsed.hostname.endsWith(".convex.site")) &&
           !parsed.hostname.includes("mock-url") &&
           !parsed.hostname.includes("your-deployment");
  } catch {
    return false;
  }
};

const convex = (function() {
  if (isValidConvexUrl(convexUrl)) {
    try {
      return new ConvexReactClient(convexUrl as string);
    } catch (e) {
      console.error("Failed to initialize Convex client:", e);
      return null;
    }
  }
  return null;
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {convex ? (
        <ConvexProvider client={convex}>
          <App />
        </ConvexProvider>
      ) : (
        <App />
      )}
    </BrowserRouter>
  </StrictMode>,
);
