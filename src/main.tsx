import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import { Enrollment } from "./features/auth/Enrollment";
const AppShell = lazy(() =>
  import("./components/AppShell").then((m) => ({ default: m.AppShell })),
);
const Dashboard = lazy(() =>
  import("./features/dashboard/Dashboard").then((m) => ({
    default: m.Dashboard,
  })),
);
const JournalPage = lazy(() =>
  import("./features/journal/JournalPage").then((m) => ({
    default: m.JournalPage,
  })),
);
const CalendarPage = lazy(() =>
  import("./features/calendar/CalendarPage").then((m) => ({
    default: m.CalendarPage,
  })),
);
const ProgressPage = lazy(() =>
  import("./features/insights/ProgressPage").then((module) => ({
    default: module.ProgressPage,
  })),
);
const PlansPage = lazy(() =>
  import("./features/plans/PlansPage").then((m) => ({ default: m.PlansPage })),
);
const RemindersPage = lazy(() =>
  import("./features/reminders/RemindersPage").then((m) => ({
    default: m.RemindersPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);
import { Loading } from "./components/ui";
const GuidePage = lazy(() =>
  import("./features/guide/GuidePage").then((m) => ({ default: m.GuidePage })),
);
import "./styles.css";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, gcTime: 300000 } },
});
function App() {
  const { loading, profile } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="initial-loading">
        <Loading />
      </div>
    );
  if (!profile)
    return location.pathname === "/guide" ? (
      <main className="public-guide" id="main-content">
        <Suspense fallback={<Loading />}>
          <GuidePage />
        </Suspense>
      </main>
    ) : (
      <Enrollment />
    );
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="meals" element={<JournalPage />} />
          <Route path="activities" element={<JournalPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route
            path="progress"
            element={
              <Suspense fallback={<Loading />}>
                <ProgressPage />
              </Suspense>
            }
          />
          <Route path="plans" element={<PlansPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="guide" element={<GuidePage />} />
          <Route path="enroll" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>เปิดหน้านี้ไม่สำเร็จ</h1>
        <p>ข้อมูลที่บันทึกไว้ยังอยู่ กรุณาโหลดหน้าใหม่เพื่อลองอีกครั้ง</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          โหลดใหม่
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn(
        "Service worker registration unavailable:",
        error instanceof Error ? error.message : "unknown",
      );
    });
  });
