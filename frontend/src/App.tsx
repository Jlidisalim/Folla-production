// src/App.tsx
import { lazy, Suspense, memo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import { CartProvider } from "@/components/CartContext";
import { WishlistProvider } from "@/components/WishlistContext";
import SyncClerkEmail from "@/components/SyncClerkEmail";
import { NotificationProvider } from "@/components/NotificationProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRoute from "@/components/RoleRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";

// ============================================================================
// PERFORMANCE: Route-based Code Splitting with React.lazy()
// Each page is now a separate chunk loaded on-demand
// ============================================================================

// Core public pages (high priority - preloaded)
const Index = lazy(() => import("./pages/Index"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const ProductListing = lazy(() => import("./pages/ProductListing"));
const Checkout = lazy(() => import("./pages/Checkout"));

// Secondary public pages
const Apropos = lazy(() => import("./pages/Apropos"));
const Contact = lazy(() => import("./pages/Contact"));
const VenteFlash = lazy(() => import("./pages/VenteFlash"));
const FAQ = lazy(() => import("./pages/FAQ"));


// Auth pages
const SignInPage = lazy(() => import("./pages/SignIn"));
const SignUpPage = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// User pages
const MyOrders = lazy(() => import("./pages/MyOrders"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const PaymentPaymeeCallback = lazy(() => import("./pages/PaymentPaymeeCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages (separate chunk group)
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminProducts = lazy(() => import("./pages/admin/ProductsAdmin"));
const AdminOrders = lazy(() => import("./pages/admin/OrdersAdmin"));
const AdminClients = lazy(() => import("./pages/admin/ClientsAdmin"));
const AddProduct = lazy(() => import("./pages/admin/AddProduct"));
const EditProduct = lazy(() => import("./pages/admin/EditProduct"));
const EmployeesAdmin = lazy(() => import("./pages/admin/EmployeesAdmin"));
const SettingsAdmin = lazy(() => import("./pages/admin/SettingsAdmin"));
const MyCalendarPage = lazy(() => import("./pages/admin/MyCalendarPage"));

// Dev-only test page
const SentryTestPage = lazy(() => import("./pages/SentryTestPage"));

// ============================================================================
// PERFORMANCE: Reusable loading fallback (memoized to prevent rerenders)
// ============================================================================
const PageLoader = memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 rounded-full border-2 border-b-transparent border-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Chargement...</p>
    </div>
  </div>
));
PageLoader.displayName = "PageLoader";

// ============================================================================
// PERFORMANCE: LazyRoute wrapper to avoid Suspense repetition
// ============================================================================
interface LazyRouteProps {
  children: React.ReactNode;
}

const LazyRoute = memo(({ children }: LazyRouteProps) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
));
LazyRoute.displayName = "LazyRoute";

// Query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  // PERFORMANCE: Removed artificial 2-second loading delay
  // Content renders immediately for faster FCP/LCP

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />

            <NotificationProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ScrollToTop />
                <WishlistProvider>
                  <CartProvider>
                    <SyncClerkEmail />

                    <Routes>
                      {/* Public - Core Pages */}
                      <Route path="/" element={<LazyRoute><Index /></LazyRoute>} />
                      <Route path="/product/:slug" element={<LazyRoute><ProductDetail /></LazyRoute>} />
                      <Route path="/category/:category" element={<LazyRoute><ProductListing /></LazyRoute>} />
                      <Route path="/category/:category/:subCategory" element={<LazyRoute><ProductListing /></LazyRoute>} />
                      <Route path="/checkout" element={<LazyRoute><Checkout /></LazyRoute>} />
                      <Route path="/payment/paymee/callback" element={<LazyRoute><PaymentPaymeeCallback /></LazyRoute>} />

                      {/* Public - Info Pages */}
                      <Route path="/a-propos" element={<LazyRoute><Apropos /></LazyRoute>} />
                      <Route path="/contact" element={<LazyRoute><Contact /></LazyRoute>} />
                      <Route path="/vente-flash" element={<LazyRoute><VenteFlash /></LazyRoute>} />
                      <Route path="/faq" element={<LazyRoute><FAQ /></LazyRoute>} />

                      {/* Auth Pages */}
                      <Route path="/sign-in/*" element={<LazyRoute><SignInPage /></LazyRoute>} />
                      <Route path="/sign-up/*" element={<LazyRoute><SignUpPage /></LazyRoute>} />
                      <Route path="/forgot-password" element={<LazyRoute><ForgotPassword /></LazyRoute>} />
                      <Route path="/reset-password" element={<LazyRoute><ResetPassword /></LazyRoute>} />

                      {/* User Pages */}
                      <Route path="/my-orders" element={<LazyRoute><MyOrders /></LazyRoute>} />
                      <Route path="/commande/succes/:orderId" element={<LazyRoute><OrderSuccess /></LazyRoute>} />

                      {/* Admin - All admin pages in their own lazy-loaded chunk group */}
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute adminOnly>
                            <LazyRoute>
                              <AdminLayout />
                            </LazyRoute>
                          </ProtectedRoute>
                        }
                      >
                        {/* Dashboard: ADMIN only */}
                        <Route index element={
                          <RoleRoute allowedRoles={["ADMIN"]}>
                            <LazyRoute><AdminDashboard /></LazyRoute>
                          </RoleRoute>
                        } />
                        {/* Products: ADMIN, PRODUCT_MANAGER */}
                        <Route path="products" element={
                          <RoleRoute allowedRoles={["ADMIN", "PRODUCT_MANAGER"]}>
                            <LazyRoute><AdminProducts /></LazyRoute>
                          </RoleRoute>
                        } />
                        <Route path="products/new" element={
                          <RoleRoute allowedRoles={["ADMIN", "PRODUCT_MANAGER"]}>
                            <LazyRoute><AddProduct /></LazyRoute>
                          </RoleRoute>
                        } />
                        <Route path="products/:id/edit" element={
                          <RoleRoute allowedRoles={["ADMIN", "PRODUCT_MANAGER"]}>
                            <LazyRoute><EditProduct /></LazyRoute>
                          </RoleRoute>
                        } />
                        {/* Orders: ADMIN, ORDER_MANAGER */}
                        <Route path="orders" element={
                          <RoleRoute allowedRoles={["ADMIN", "ORDER_MANAGER"]}>
                            <LazyRoute><AdminOrders /></LazyRoute>
                          </RoleRoute>
                        } />
                        {/* Clients: All admin roles */}
                        <Route path="clients" element={
                          <RoleRoute allowedRoles={["ADMIN", "PRODUCT_MANAGER", "ORDER_MANAGER"]}>
                            <LazyRoute><AdminClients /></LazyRoute>
                          </RoleRoute>
                        } />
                        {/* Employees: ADMIN only */}
                        <Route path="employees" element={
                          <RoleRoute allowedRoles={["ADMIN"]}>
                            <LazyRoute><EmployeesAdmin /></LazyRoute>
                          </RoleRoute>
                        } />
                        {/* Settings: ADMIN only */}
                        <Route path="settings" element={
                          <RoleRoute allowedRoles={["ADMIN"]}>
                            <LazyRoute><SettingsAdmin /></LazyRoute>
                          </RoleRoute>
                        } />
                        {/* My Calendar: All manager roles */}
                        <Route path="calendar" element={
                          <RoleRoute allowedRoles={["ADMIN", "PRODUCT_MANAGER", "ORDER_MANAGER"]}>
                            <LazyRoute><MyCalendarPage /></LazyRoute>
                          </RoleRoute>
                        } />
                      </Route>

                      {/* Test routes - DEV ONLY */}
                      {import.meta.env.DEV && (
                        <Route
                          path="/__test__/frontend-error"
                          element={
                            <ProtectedRoute adminOnly>
                              <LazyRoute>
                                <SentryTestPage />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                      )}

                      {/* 404 */}
                      <Route path="*" element={<LazyRoute><NotFound /></LazyRoute>} />
                    </Routes>
                  </CartProvider>
                </WishlistProvider>
              </BrowserRouter>
            </NotificationProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
};

export default App;
