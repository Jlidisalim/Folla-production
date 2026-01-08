import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/**
 * ErrorBoundary component to catch React rendering errors.
 * 
 * - Catches errors in child component tree
 * - Reports to Sentry for monitoring
 * - Shows user-friendly error message
 * - Prevents blank screens from error cascades
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error("ErrorBoundary caught error:", error, errorInfo);

        // Report to Sentry
        Sentry.withScope((scope) => {
            scope.setExtras({
                componentStack: errorInfo.componentStack,
            });
            Sentry.captureException(error);
        });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback or default error UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-background p-4">
                    <div className="text-center max-w-md">
                        <div className="text-6xl mb-4">😢</div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            Oups ! Quelque chose s'est mal passé
                        </h1>
                        <p className="text-muted-foreground mb-6">
                            Nous avons rencontré une erreur inattendue.
                            Notre équipe a été notifiée et travaille à la résolution.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors"
                        >
                            Rafraîchir la page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
