import { createContext, useContext, useMemo, useState } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const api = useMemo(() => ({
    push: (type, message, options = {}) => {
      const id = Date.now() + Math.random();
      setItems(prev => [...prev, { id, type, message }]);
      const durationMs = Number(options?.durationMs);
      if (!Number.isNaN(durationMs) && durationMs > 0) {
        setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), durationMs);
      } else if (options?.persistent !== true) {
        setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 2800);
      }
      return id;
    },
    remove: (id) => {
      setItems(prev => prev.filter(x => x.id !== id));
    },
    items
  }), [items]);

  return <ToastCtx.Provider value={api}>{children}</ToastCtx.Provider>;
}

export function useToast() {
  return useContext(ToastCtx);
}
