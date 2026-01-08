// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { ClerkProvider } from "@clerk/clerk-react";

// ============================================================================
// PERFORMANCE: Lazy initialization of monitoring/analytics
// These are deferred to avoid blocking initial render
// ============================================================================

// Sentry: Import types only, defer actual initialization
import { SentryErrorBoundary } from "./lib/sentry.tsx";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env");
}

// Render the app immediately, don't wait for third-party scripts
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <SentryErrorBoundary>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <App />
        </ClerkProvider>
      </SentryErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>
);


// ============================================================================
// PERFORMANCE: Defer non-critical initialization to after first paint
// Using requestIdleCallback with setTimeout fallback
// ============================================================================
const deferInit = (callback: () => void) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 2000 });
  } else {
    // Fallback for Safari
    setTimeout(callback, 100);
  }
};

// Initialize Sentry after initial render (error monitoring)
deferInit(() => {
  import("./lib/sentry.tsx").then(({ initSentry }) => {
    initSentry();
  });
});

// Initialize GA4 after initial render (analytics)
deferInit(() => {
  import("./lib/analytics").then(({ initGA4 }) => {
    initGA4();
  });
});

