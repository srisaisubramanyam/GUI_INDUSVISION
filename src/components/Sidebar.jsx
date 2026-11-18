import { createElement } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Code2,
  Camera,
  ToggleLeft,
  Database,
  Stethoscope,
  LayoutDashboard,
  CircleUser,
  LogOut,
} from "lucide-react";
import logo from "../assets/image.png";
import { clearSession, getSession } from "../utils/auth.js";

const baseItems = [
  { to: "/code", label: "Code", icon: Code2 },
  { to: "/camera", label: "Camera", icon: Camera },
  { to: "/diagnosis", label: "Diagnosis", icon: Stethoscope },
  { to: "/defects", label: "Defect Toggles", icon: ToggleLeft },
  { to: "/data", label: "Data Collection", icon: Database },
];

export default function Sidebar() {
  const session = getSession();
  const isDev = session.role === "developer";
  const nav = useNavigate();
  const items = isDev
    ? [{ to: "/admin", label: "Admin", icon: LayoutDashboard }, ...baseItems]
    : baseItems;

  return (
    <aside
      style={{
        width: "286px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        background: "linear-gradient(180deg, #3a302a 0%, #26211d 45%, #151311 100%)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        fontFamily: "'Segoe UI', sans-serif",
        position: "relative",
        boxShadow: "18px 0 36px rgba(35, 28, 22, 0.14)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 8% 6%, rgba(195,157,112,0.18), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 22%)",
        }}
      />

      <div style={{ padding: "22px 18px 18px", position: "relative" }}>
        <div
          style={{
            borderRadius: "28px",
            background: "linear-gradient(180deg, rgba(251,244,234,0.98), rgba(240,227,210,0.96))",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "18px 18px 16px",
            boxShadow: "0 18px 32px rgba(0,0,0,0.18)",
          }}
        >
          <img
            alt="Indus Vision Logo"
            src={logo}
            draggable="false"
            style={{ width: "138px", maxWidth: "100%", display: "block", userSelect: "none" }}
          />
        </div>
      </div>

      <nav
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "8px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          position: "relative",
        }}
      >
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "14px",
              borderRadius: "22px",
              padding: "13px 14px",
              textDecoration: "none",
              transition: "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
              background: isActive
                ? "linear-gradient(180deg, rgba(242,228,206,0.20), rgba(168,126,81,0.16))"
                : "rgba(255,255,255,0.02)",
              border: isActive
                ? "1px solid rgba(214,178,132,0.22)"
                : "1px solid rgba(255,255,255,0.03)",
              boxShadow: isActive ? "inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
            })}
          >
            {({ isActive }) => (
              <>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s ease",
                    background: isActive
                      ? "linear-gradient(180deg, #f0deca, #d9b890)"
                      : "rgba(255,255,255,0.05)",
                    border: isActive
                      ? "1px solid rgba(255,255,255,0.18)"
                      : "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {createElement(Icon, {
                    size: 17,
                    color: isActive ? "#1a1512" : "rgba(247, 235, 218, 0.74)",
                    strokeWidth: 1.9,
                  })}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: isActive ? "#fff6ea" : "rgba(247,235,218,0.85)",
                    }}
                  >
                    {label}
                  </div>
                  {/* <div
                    style={{
                      fontSize: "11px",
                      color: isActive ? "rgba(242,228,206,0.78)" : "rgba(224,205,181,0.52)",
                    }}
                  >
                    Workspace module
                  </div> */}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div
        style={{
          margin: "14px 14px 18px",
          borderRadius: "28px",
          padding: "14px",
          background: "linear-gradient(180deg, rgba(41,34,29,0.94), rgba(24,21,18,0.96))",
          border: "1px solid rgba(214,178,132,0.12)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={() => {
            clearSession();
            nav("/");
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            borderRadius: "20px",
            padding: "12px 14px",
            background: "linear-gradient(180deg, rgba(111,53,53,0.40), rgba(73,34,34,0.58))",
            border: "1px solid rgba(190,130,130,0.24)",
            color: "#fff6ea",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {createElement(LogOut, {
                size: 16,
                color: "rgba(255,246,234,0.92)",
                strokeWidth: 1.8,
              })}
            </div>
            <div style={{ minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff6ea", lineHeight: 1.1 }}>
                Logout
              </div>
              {/* <div style={{ fontSize: "11px", color: "rgba(255,236,218,0.68)", marginTop: "2px" }}>
                End current session
              </div> */}
            </div>
          </div>
          {/* <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em", color: "rgba(255,236,218,0.72)" }}>
            Exit
          </div> */}
        </button>

        <NavLink
          to="/profile"
          style={({ isActive }) => ({
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            borderRadius: "20px",
            padding: "12px 14px",
            textDecoration: "none",
            background: isActive
              ? "linear-gradient(180deg, rgba(247,238,223,0.16), rgba(183,138,87,0.16))"
              : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            transition: "all 0.2s ease",
          })}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {createElement(CircleUser, {
                size: 16,
                color: "rgba(255,246,234,0.86)",
                strokeWidth: 1.8,
              })}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff6ea", lineHeight: 1.1 }}>
                Profile
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(224,205,181,0.78)",
                  marginTop: "2px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {session.username ? `${session.username} - ${isDev ? "Developer" : "Client"}` : "Not signed in"}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em", color: "rgba(224,205,181,0.68)" }}>
            View
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
