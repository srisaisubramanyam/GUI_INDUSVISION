const ROLE_KEY = "role";
const USERNAME_KEY = "username";
const LOGIN_AT_KEY = "loginAt";

export function getSession() {
  const role = localStorage.getItem(ROLE_KEY) || "";
  const username = localStorage.getItem(USERNAME_KEY) || "";
  const loginAtRaw = localStorage.getItem(LOGIN_AT_KEY) || "";
  const loginAt = loginAtRaw ? Number(loginAtRaw) : null;

  return {
    role,
    username,
    loginAt: Number.isFinite(loginAt) ? loginAt : null
  };
}

export function setSession({ role, username }) {
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
}

export function clearSession() {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(LOGIN_AT_KEY);
}

export function isAuthed() {
  const s = getSession();
  return Boolean(s.role && s.username);
}

export function isDeveloper() {
  return getSession().role === "developer";
}

