import React, { useState } from "react";
import { captureException } from "../lib/sentry.tsx";

/**
 * Test component that intentionally throws errors for Sentry verification
 * Route: /__test__/frontend-error
 */
export default function SentryTestPage() {
  const [hasError, setHasError] = useState(false);

  const triggerRenderError = () => {
    setHasError(true);
  };

  const triggerManualError = () => {
    try {
      throw new Error("Manual test error for Sentry verification");
    } catch (error) {
      captureException(error as Error, {
        testType: "manual",
        timestamp: new Date().toISOString(),
      });
      alert("Error captured and sent to Sentry! Check your Sentry dashboard.");
    }
  };

  const triggerAsyncError = async () => {
    try {
      // Simulate async operation that fails
      await new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Async test error for Sentry")), 100);
      });
    } catch (error) {
      captureException(error as Error, {
        testType: "async",
        timestamp: new Date().toISOString(),
      });
      alert("Async error captured! Check your Sentry dashboard.");
    }
  };

  // This will cause React to throw during render
  if (hasError) {
    throw new Error("Intentional render error for Sentry verification");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🧪 Sentry Test Page
        </h1>
        <p className="text-gray-600 mb-8">
          Use these buttons to trigger test errors and verify Sentry is working.
        </p>

        <div className="space-y-4">
          <div className="p-6 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">1. Manual Error (Caught)</h2>
            <p className="text-sm text-gray-500 mb-4">
              Throws and catches an error, then sends it manually to Sentry.
            </p>
            <button
              onClick={triggerManualError}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Trigger Manual Error
            </button>
          </div>

          <div className="p-6 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">2. Async Error (Caught)</h2>
            <p className="text-sm text-gray-500 mb-4">
              Simulates an async operation that fails.
            </p>
            <button
              onClick={triggerAsyncError}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition"
            >
              Trigger Async Error
            </button>
          </div>

          <div className="p-6 bg-white rounded-lg shadow border-2 border-red-200">
            <h2 className="text-lg font-semibold mb-2 text-red-600">
              3. Render Error (Uncaught)
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              ⚠️ This will crash the component! Caught by ErrorBoundary.
            </p>
            <button
              onClick={triggerRenderError}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              Trigger Render Error
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li>Click a button to trigger an error</li>
            <li>Open your Sentry dashboard</li>
            <li>Look for the new error event</li>
            <li>Verify environment tags and context</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
