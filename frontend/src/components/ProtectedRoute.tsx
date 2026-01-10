// src/components/ProtectedRoute.tsx
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import { createAuthenticatedApi } from "@/lib/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  /**
   * If specified, only these roles can access the route.
   * E.g., ["ADMIN", "PRODUCT_MANAGER"]
   */
  allowedRoles?: string[];
}

/**
 * ProtectedRoute - Uses Employee table roles instead of Clerk metadata
 * 
 * Fetches user role from /api/me/role endpoint which checks Employee table.
 * - adminOnly: Allows ADMIN, PRODUCT_MANAGER, ORDER_MANAGER
 * - allowedRoles: Allows only specific roles
 */
const ProtectedRoute = ({ children, adminOnly, allowedRoles }: ProtectedRouteProps) => {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [employeeRole, setEmployeeRole] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [roleLoading, setRoleLoading] = useState(true);

  // Fetch employee role from database
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setRoleLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (mounted) setRoleLoading(false);
          return;
        }
        const authApi = createAuthenticatedApi(token);
        const res = await authApi.get("/api/me/role");
        if (!mounted) return;
        setEmployeeRole(res.data?.role || null);
        setIsActive(res.data?.isActive !== false);
      } catch {
        // 401 is expected for non-admin users
        if (!mounted) return;
        setEmployeeRole(null);
        setIsActive(true);
      } finally {
        if (mounted) setRoleLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isSignedIn, isLoaded, getToken]);

  // Still loading Clerk data
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    );
  }

  // Not logged in – redirect to sign in
  if (!isSignedIn) {
    return <Navigate to="/sign-in" />;
  }

  // Still loading employee role from API
  if (roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Vérification des accès...
      </div>
    );
  }

  // Check if employee is active
  if (!isActive) {
    return <Navigate to="/" />;
  }

  // Admin-only routes: Allow ADMIN, PRODUCT_MANAGER, ORDER_MANAGER
  const ADMIN_ROLES = ["ADMIN", "PRODUCT_MANAGER", "ORDER_MANAGER"];

  if (adminOnly && (!employeeRole || !ADMIN_ROLES.includes(employeeRole))) {
    // Not an admin-level employee – redirect to home
    return <Navigate to="/" />;
  }

  // Check specific allowed roles
  if (allowedRoles && allowedRoles.length > 0) {
    if (!employeeRole || !allowedRoles.includes(employeeRole)) {
      return <Navigate to="/" />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
