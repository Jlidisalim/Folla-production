import * as Sentry from "@sentry/react";
import React from "react";

/**
 * Initialize Sentry for React application
 * Must be called before React renders
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `folla-frontend@${import.meta.env.VITE_APP_VERSION || "1.0.0"}`,
    // Performance monitoring - reduce sample rates to prevent rate limiting
    tracesSampleRate: import.meta.env.PROD ? 0.05 : 0.1,
    // Session replay - reduced to prevent rate limiting
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 0.5,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Don't send PII
    beforeSend(event) {
      // Redact sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data?.url?.includes("authorization")) {
            breadcrumb.data.url = "[REDACTED]";
          }
          return breadcrumb;
        });
      }
      return event;
    },
  });
}

/**
 * Sentry Error Boundary wrapper component
 */
function ErrorFallback({ error, resetError }: { error: unknown; resetError: () => void }) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-4">
          We've been notified and are working to fix the issue.
        </p>
        <details className="text-left mb-4 text-sm text-gray-500">
          <summary className="cursor-pointer">Error details</summary>
          <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
            {errorMessage}
          </pre>
        </details>
        <button
          onClick={resetError}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/**
 * Wrap your app with this component for error boundary
 */
export function SentryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => <ErrorFallback error={error} resetError={resetError} />}
      showDialog
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  }
}

export { Sentry };
