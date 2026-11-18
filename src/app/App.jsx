import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { routes } from "./routes.jsx";
import Layout from "../components/Layout.jsx";
import { isAuthed } from "../utils/auth.js";
import ToastHost from "../components/Toast.jsx";

function Protected({ children }) {
  if (!isAuthed()) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/" element={routes[0].element} />
        <Route
          path="/*"
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        />
      </Routes>
      <ToastHost />
    </Router>
  );
}
