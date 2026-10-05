import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LogoMark } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DateRangeProvider, DEFAULT_RANGE_KEY } from "@/context/DateRangeContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import type { Preferences } from "@/types";

// Route-level code splitting keeps the initial bundle small.
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const CustomersPage = lazy(() => import("@/pages/CustomersPage").then((m) => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() => import("@/pages/CustomerDetailPage").then((m) => ({ default: m.CustomerDetailPage })));
const SubscriptionsPage = lazy(() => import("@/pages/SubscriptionsPage").then((m) => ({ default: m.SubscriptionsPage })));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage })));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const ReportsPage = lazy(() => import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const ReportDetailPage = lazy(() => import("@/pages/ReportDetailPage").then((m) => ({ default: m.ReportDetailPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-label="Loading FlowMetrics">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-10" />
        <Loader2 className="size-5 animate-spin text-muted" aria-hidden />
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading page">
      <Loader2 className="size-6 animate-spin text-muted" aria-hidden />
    </div>
  );
}

/** Applies the signed-in user's saved preferences (theme, density, default range). */
function PreferencesSync() {
  const { setTheme } = useTheme();
  useEffect(() => {
    api
      .get<Preferences>("/auth/me/preferences/")
      .then((prefs) => {
        setTheme(prefs.theme);
        document.documentElement.dataset.density = prefs.compact_tables ? "compact" : "comfortable";
        try {
          localStorage.setItem(DEFAULT_RANGE_KEY, prefs.default_date_range);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* non-critical */
      });
  }, [setTheme]);
  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return (
    <>
      <PreferencesSync />
      <DateRangeProvider>{children}</DateRangeProvider>
    </>
  );
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-300">404</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page you're looking for doesn't exist or has moved.</p>
        <Link to="/" className="mt-6 inline-block">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
              <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                {[
                  { path: "/", element: <DashboardPage /> },
                  { path: "/customers", element: <CustomersPage /> },
                  { path: "/customers/:id", element: <CustomerDetailPage /> },
                  { path: "/subscriptions", element: <SubscriptionsPage /> },
                  { path: "/transactions", element: <TransactionsPage /> },
                  { path: "/analytics", element: <AnalyticsPage /> },
                  { path: "/reports", element: <ReportsPage /> },
                  { path: "/reports/:id", element: <ReportDetailPage /> },
                  { path: "/settings", element: <SettingsPage /> },
                  { path: "*", element: <NotFound /> },
                ].map(({ path, element }) => (
                  <Route key={path} path={path} element={<Suspense fallback={<PageLoader />}>{element}</Suspense>} />
                ))}
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
