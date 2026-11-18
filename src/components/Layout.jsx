import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { routes } from "../app/routes.jsx";

export default function Layout() {
  return (
    <div className="iv-app-shell h-screen">
      <div className="h-full flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 overflow-auto p-5 md:p-8">
            <div className="iv-page">
              <Routes>
                {routes
                  .filter(r => r.path !== "/")
                  .map(r => (
                    <Route key={r.path} path={r.path.replace("/", "")} element={r.element} />
                  ))}
                <Route path="*" element={<Navigate to="/code" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
