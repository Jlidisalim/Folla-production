// src/components/NavDropdown.tsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

export interface SubItem {
    name: string;
    slug: string;
}

export interface NavDropdownProps {
    /** Display label for the trigger */
    label: string;
    /** Base path for the category */
    path: string;
    /** Subcategory items to display in dropdown */
    items: SubItem[];
    /** Whether data is loading */
    loading?: boolean;
    /** Callback when mobile nav should close */
    onNavigate?: () => void;
}

/**
 * NavDropdown - Accessible dropdown with delayed hover logic
 * 
 * Features:
 * - Delayed open/close to prevent flicker when moving between trigger and menu
 * - Keyboard navigation (Enter/Space to open, Escape to close, Tab to navigate)
 * - ARIA attributes for screen readers
 * - Mobile touch support (tap to toggle)
 */
const NavDropdown: React.FC<NavDropdownProps> = ({
    label,
    path,
    items,
    loading = false,
    onNavigate,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const openTimeoutRef = useRef<number | null>(null);
    const closeTimeoutRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Delay constants (ms)
    const OPEN_DELAY = 50;
    const CLOSE_DELAY = 150;

    // Clear all pending timers
    const clearTimers = useCallback(() => {
        if (openTimeoutRef.current) {
            window.clearTimeout(openTimeoutRef.current);
            openTimeoutRef.current = null;
        }
        if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => clearTimers();
    }, [clearTimers]);

    // Handle mouse enter on container (trigger or dropdown)
    const handleMouseEnter = useCallback(() => {
        // Cancel any pending close
        if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        // Set delayed open (prevents flicker on quick mouse movements)
        if (!isOpen && !openTimeoutRef.current) {
            openTimeoutRef.current = window.setTimeout(() => {
                setIsOpen(true);
                openTimeoutRef.current = null;
            }, OPEN_DELAY);
        }
    }, [isOpen]);

    // Handle mouse leave from container
    const handleMouseLeave = useCallback(() => {
        // Cancel any pending open
        if (openTimeoutRef.current) {
            window.clearTimeout(openTimeoutRef.current);
            openTimeoutRef.current = null;
        }
        // Set delayed close (allows time to move to dropdown)
        if (isOpen && !closeTimeoutRef.current) {
            closeTimeoutRef.current = window.setTimeout(() => {
                setIsOpen(false);
                closeTimeoutRef.current = null;
            }, CLOSE_DELAY);
        }
    }, [isOpen]);

    // Keyboard handler for trigger
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            switch (e.key) {
                case "Enter":
                case " ":
                    e.preventDefault();
                    setIsOpen((prev) => !prev);
                    break;
                case "Escape":
                    e.preventDefault();
                    setIsOpen(false);
                    triggerRef.current?.focus();
                    break;
                case "ArrowDown":
                    if (isOpen) {
                        e.preventDefault();
                        // Focus first menu item
                        const firstItem = containerRef.current?.querySelector(
                            '[role="menuitem"]'
                        ) as HTMLElement;
                        firstItem?.focus();
                    }
                    break;
            }
        },
        [isOpen]
    );

    // Handle click on trigger (for mobile/touch)
    const handleTriggerClick = useCallback(
        (e: React.MouseEvent) => {
            // Check if this is likely a touch device
            const isTouchDevice =
                "ontouchstart" in window ||
                navigator.maxTouchPoints > 0 ||
                window.matchMedia("(hover: none)").matches;

            if (isTouchDevice) {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            // On desktop, let the link navigate (hover handles dropdown)
        },
        []
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Close on Escape key (global)
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleGlobalKeyDown);
        }
        return () => document.removeEventListener("keydown", handleGlobalKeyDown);
    }, [isOpen]);

    // Handle menu item click
    const handleItemClick = useCallback(() => {
        setIsOpen(false);
        onNavigate?.();
    }, [onNavigate]);

    // Normalize subcategory slug for URL
    const normalizeSlug = (text: string): string => {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "-");
    };

    return (
        <div
            ref={containerRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Trigger: Label as clickable link + Chevron for dropdown */}
            <div className="flex items-center gap-0.5">
                {/* Main category link - clickable to navigate to category page */}
                <Link
                    to={path}
                    className="text-black hover:text-gray-700 transition-transform transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded"
                    onClick={() => {
                        setIsOpen(false);
                        onNavigate?.();
                    }}
                >
                    {label}
                </Link>

                {/* Chevron button to toggle dropdown (for subcategories) */}
                <button
                    ref={triggerRef}
                    type="button"
                    className="p-1 text-black hover:text-gray-700 transition-transform transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded"
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    aria-label={`Ouvrir le menu ${label}`}
                    onClick={handleTriggerClick}
                    onKeyDown={handleKeyDown}
                >
                    <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                            }`}
                    />
                </button>
            </div>

            {/* Dropdown menu */}
            <div
                className={`absolute left-0 top-full mt-1 w-52 bg-white shadow-lg rounded-lg z-50 transform transition-all duration-200 ease-out ${isOpen
                    ? "opacity-100 visible translate-y-0"
                    : "opacity-0 invisible -translate-y-1"
                    }`}
                role="menu"
                aria-label={`${label} submenu`}
            >
                {loading ? (
                    // Loading skeleton
                    <div className="p-2 space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-8 bg-gray-100 rounded animate-pulse"
                            />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    // Empty state
                    <div className="px-4 py-3 text-sm text-gray-500">
                        Aucune sous-catégorie
                    </div>
                ) : (
                    // Menu items - subcategories only
                    <ul className="py-1">
                        {items.map((item, index) => (
                            <li key={item.slug || index}>
                                <Link
                                    to={`${path}/${normalizeSlug(item.name)}`}
                                    role="menuitem"
                                    tabIndex={isOpen ? 0 : -1}
                                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black transition-colors first:rounded-t-lg last:rounded-b-lg focus:outline-none focus-visible:bg-gray-100"
                                    onClick={handleItemClick}
                                >
                                    {item.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Invisible bridge to prevent gap issues */}
            {isOpen && (
                <div
                    className="absolute left-0 right-0 h-2 top-full"
                    aria-hidden="true"
                />
            )}
        </div>
    );
};

export default NavDropdown;
