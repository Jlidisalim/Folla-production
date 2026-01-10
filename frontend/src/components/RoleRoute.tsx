// src/components/RoleRoute.tsx
/**
 * Role-based route protection component.
 * Wraps an admin page and checks if the user has required role(s).
 * If not, redirects to an appropriate page.
 */
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import { createAuthenticatedApi } from "@/lib/api";

interface RoleRouteProps {
  children: React.ReactNode;
  /**
   * Roles that can access this route.
   * E.g., ["ADMIN", "PRODUCT_MANAGER"]
   */
  allowedRoles: string[];
  /**
   * Where to redirect if access denied (default: first allowed section)
   */
  redirectTo?: string;
}

/**
 * RoleRoute - Checks employee role and redirects if not authorized
 * 
 * Usage:
 * <RoleRoute allowedRoles={["ADMIN", "PRODUCT_MANAGER"]}>
 *   <ProductsAdmin />
 * </RoleRoute>
 */
const RoleRoute = ({ children, allowedRoles, redirectTo = "/admin" }: RoleRouteProps) => {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [employeeRole, setEmployeeRole] = useState<string | null>(null);
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
        if (res.data?.role && res.data?.isActive !== false) {
          setEmployeeRole(res.data.role);
        } else {
          setEmployeeRole(null);
        }
      } catch (err) {
        console.warn("[RoleRoute] Failed to fetch role:", err);
        if (!mounted) return;
        setEmployeeRole(null);
      } finally {
        if (mounted) setRoleLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isSignedIn, isLoaded, getToken]);

  // Still loading
  if (!isLoaded || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Vérification des accès...
      </div>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    return <Navigate to="/sign-in" />;
  }

  // Check role
  if (!employeeRole || !allowedRoles.includes(employeeRole)) {
    // Determine best redirect based on user's actual role
    let fallback = redirectTo;
    if (employeeRole === "PRODUCT_MANAGER") {
      fallback = "/admin/products";
    } else if (employeeRole === "ORDER_MANAGER") {
      fallback = "/admin/orders";
    }
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
