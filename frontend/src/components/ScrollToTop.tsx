// src/components/ScrollToTop.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop - Global scroll restoration component for React Router v6+
 * 
 * Behavior:
 * - On every pathname change: scrolls to top of page
 * - If URL contains a hash (#section): scrolls to that element instead
 * - Uses "instant" behavior for immediate scroll (no animation)
 * 
 * Usage: Mount ONCE inside <BrowserRouter>, before <Routes>
 */
const ScrollToTop = () => {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        // If URL has a hash (e.g., /page#section), scroll to that element
        if (hash) {
            // Small delay to ensure DOM is ready after route change
            const timeoutId = setTimeout(() => {
                const element = document.querySelector(hash);
                if (element) {
                    element.scrollIntoView({ behavior: "instant", block: "start" });
                }
            }, 0);
            return () => clearTimeout(timeoutId);
        }

        // Otherwise, scroll to top
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname, hash]);

    return null; // This component renders nothing
};

export default ScrollToTop;
