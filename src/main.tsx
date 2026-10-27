import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import { Enrollment } from "./features/auth/Enrollment";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./features/dashboard/Dashboard";
import { JournalPage } from "./features/journal/JournalPage";
import { CalendarPage } from "./features/calendar/CalendarPage";
const ProgressPage = lazy(() =>
  import("./features/insights/ProgressPage").then((module) => ({
    default: module.ProgressPage,
  })),
);
import { PlansPage } from "./features/plans/PlansPage";
import { RemindersPage } from "./features/reminders/RemindersPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { Loading } from "./components/ui";
import "./styles.css";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, gcTime: 300000 } },
});
function App() {
  const { loading, profile } = useAuth();
  if (loading)
    return (
      <div className="initial-loading">
        <Loading />
      </div>
    );
  if (!profile) return <Enrollment />;
  return (
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
        <Route path="enroll" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
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
