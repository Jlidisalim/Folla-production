import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ============================================================================
  // PERFORMANCE: Build optimizations
  // ============================================================================
  build: {
    // Target modern browsers for smaller bundles
    target: "es2020",
    // Enable source maps for production debugging (optional, can disable for smaller builds)
    sourcemap: false,
    // Minification settings
    minify: "esbuild",
    // Split CSS per async chunk
    cssCodeSplit: true,
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Manual chunks for optimal caching and parallel loading
        manualChunks: {
          // Core React ecosystem - rarely changes, cache forever
          "vendor-react": ["react", "react-dom", "react-router-dom"],

          // Authentication - separate chunk for Clerk
          "vendor-clerk": ["@clerk/clerk-react", "@clerk/clerk-js"],

          // UI Components - Radix primitives (large but tree-shakeable)
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-accordion",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-label",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-switch",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-progress",
            "@radix-ui/react-slot",
            "@radix-ui/react-aspect-ratio",
          ],

          // PERFORMANCE: recharts removed from manual chunks
          // It will now bundle with Dashboard.tsx (lazy-loaded)
          // This saves 421KB from loading on non-dashboard admin pages

          // Animations - only needed for animated components
          "vendor-motion": ["framer-motion"],

          // Data fetching
          "vendor-query": ["@tanstack/react-query", "axios"],

          // Forms - checkout and admin forms
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],

          // Date utilities
          "vendor-dates": ["date-fns", "react-day-picker"],

          // Monitoring (loaded lazily where possible)
          "vendor-monitoring": ["@sentry/react"],

          // Utilities
          "vendor-utils": [
            "clsx",
            "tailwind-merge",
            "class-variance-authority",
            "lucide-react",
          ],
        },
      },
    },
    // Increase chunk warning limit slightly (we're intentionally splitting)
    // Dashboard includes recharts which is large but only loaded on-demand
    chunkSizeWarningLimit: 500,
  },
}));

