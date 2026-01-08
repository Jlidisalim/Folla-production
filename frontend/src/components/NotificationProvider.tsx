/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/NotificationProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion"; // ✅ new import

type NotificationType = "success" | "error" | "info";
type NotificationAppearance = "dark" | "light";

export interface Notification {
  id: number;
  title?: string;
  message?: string;
  type?: NotificationType;
  appearance?: NotificationAppearance;
  duration?: number; // ms
}

interface NotificationContextValue {
  notify: (n: Omit<Partial<Notification>, "id">) => number;
  dismiss: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null
);

let idCounter = 1;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>(
    {}
  );

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach((t) => {
        if (t) clearTimeout(t as any);
      });
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setNotifs((n) => n.filter((x) => x.id !== id));
    const t = timers.current[id];
    if (t) {
      clearTimeout(t as any);
      timers.current[id] = null;
    }
  }, []);

  const notify = useCallback((n: Omit<Partial<Notification>, "id">) => {
    const id = idCounter++;
    const duration = n.duration ?? 4500;
    const notification: Notification = {
      id,
      title: n.title,
      message: n.message,
      type: n.type ?? "info",
      duration,
      appearance: n.appearance ?? "dark",
    };
    setNotifs((prev) => [notification, ...prev]);

    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        setNotifs((cur) => cur.filter((x) => x.id !== id));
        timers.current[id] = null;
      }, duration);
      timers.current[id] = timer;
    }

    return id;
  }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        className="fixed right-6 top-6 z-[9999] flex flex-col gap-3 max-w-sm w-full"
        style={{ pointerEvents: "none" }}
      >
        <AnimatePresence>
          {" "}
          {/* ✅ wrap with AnimatePresence for exit animations */}
          {notifs.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 60 }} // start slightly right & transparent
              animate={{ opacity: 1, x: 0 }} // slide in
              exit={{ opacity: 0, x: 60 }} // slide out same direction
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                duration: 0.4,
              }}
              layout
            >
              <ToastCard notif={n} onClose={() => dismiss(n.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  return ctx;
};

// ---------- Toast Card component ----------

const iconForType = (type?: NotificationType) => {
  if (type === "success")
    return (
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
        <CheckCircle className="w-6 h-6 text-green-500" />
      </div>
    );
  if (type === "error")
    return (
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>
    );
  return (
    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
      <Info className="w-6 h-6 text-blue-500" />
    </div>
  );
};

const ToastCard: React.FC<{ notif: Notification; onClose: () => void }> = ({
  notif,
  onClose,
}) => {
  const isLight = notif.appearance === "light";
  const containerClass = isLight
    ? "pointer-events-auto max-w-sm w-full bg-white text-black rounded-xl shadow-xl p-4 flex gap-3 items-start border border-gray-100"
    : "pointer-events-auto max-w-sm w-full bg-gradient-to-br from-gray-900/90 to-gray-800/90 text-white rounded-xl shadow-xl p-4 flex gap-3 items-start";
  const bodyTextClass = isLight
    ? "text-sm leading-snug text-gray-700"
    : "text-sm leading-snug text-gray-200";
  const closeClass = isLight
    ? "ml-2 text-gray-500 hover:text-black rounded-full p-1"
    : "ml-2 text-gray-300 hover:text-white rounded-full p-1";

  return (
    <div
      className={containerClass}
      style={{ minHeight: 64 }}
    >
      <div className="flex-shrink-0">{iconForType(notif.type)}</div>

      <div className="flex-1 pt-1">
        {notif.title ? (
          <div className="font-semibold text-base text-black">{notif.title}</div>
        ) : null}
        {notif.message ? (
          <div className={bodyTextClass}>{notif.message}</div>
        ) : null}
      </div>

      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className={closeClass}
        style={{ alignSelf: "start" }}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};
