/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/NotificationBell.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthenticatedApi } from "@/lib/api";
import { useNavigate } from "react-router-dom";

type Notif = {
  id: string;
  orderId?: number;
  createdAt: string;
  title: string;
  message?: string;
  read?: boolean;
  type?: "order" | string;
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  
  // Use authenticated API for protected endpoints
  const { authGet, authPost, isSignedIn, isLoading: authLoading } = useAuthenticatedApi();

  // Poll every 15s
  const POLL = 15000;

  // Merge while preserving locally toggled read state
  const mergeNotifications = useCallback((incoming: Notif[]) => {
    setItems((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      incoming.forEach((inc) => {
        const existing = byId.get(inc.id);
        if (existing) {
          const preservedRead =
            typeof existing.read === "boolean" ? existing.read : inc.read;
          byId.set(inc.id, {
            ...existing,
            ...inc,
            read: preservedRead,
          });
        } else {
          byId.set(inc.id, inc);
        }
      });

      const merged = Array.from(byId.values()).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return merged.slice(0, 50);
    });
  }, []);

  // Fetch notifications with auth
  const fetchNotifications = useCallback(async () => {
    // Don't fetch if not signed in
    if (!isSignedIn || authLoading) return;
    
    try {
      // Primary: use /notifications (DB-backed)
      const { data, status } = await authGet<any[]>("/notifications");
      if (status === 200 && Array.isArray(data)) {
        const mapped: Notif[] = data.map((n: any) => ({
          id: String(n.id ?? n._id ?? n.noticeId ?? n.orderId ?? n.order?.id),
          orderId: n.orderId ?? n.order?.id ?? (n.id && Number(n.id)),
          createdAt: n.createdAt ?? n.created_at ?? new Date().toISOString(),
          title:
            n.title ??
            (n.order ? `New order from ${n.order.name || "Customer"}` : "New"),
          message: n.message ?? n.text ?? "",
          read: !!n.read,
          type: "order",
        }));
        mergeNotifications(mapped);
        return;
      }
    } catch (err) {
      // fallback below
    }

    // Fallback: try /orders
    try {
      const { data: ordersData, status: ordersStatus } = await authGet<any[]>("/orders");
      if (ordersStatus === 200 && Array.isArray(ordersData)) {
        const mapped: Notif[] = ordersData
          .slice()
          .sort(
            (a, b) =>
              new Date(b.createdAt || b.created_at || Date.now()).getTime() -
              new Date(a.createdAt || a.created_at || Date.now()).getTime()
          )
          .slice(0, 20)
          .map((o: any) => ({
            id: `order-${o.id}`,
            orderId: o.id,
            createdAt: o.createdAt ?? o.created_at ?? new Date().toISOString(),
            title: `New order from ${o.name ?? o.customerName ?? "Customer"}`,
            message: `Total ${Number(o.total ?? 0).toFixed(2)} — ${
              o.items?.length ?? 0
            } items`,
            read: !!o.read,
            type: "order",
          }));
        mergeNotifications(mapped);
      }
    } catch (err) {
      // give up
    }
  }, [isSignedIn, authLoading, authGet, mergeNotifications]);

  useEffect(() => {
    // initial + polling (only when signed in)
    if (isSignedIn && !authLoading) {
      fetchNotifications();
      const t = setInterval(fetchNotifications, POLL);
      return () => clearInterval(t);
    }
  }, [isSignedIn, authLoading, fetchNotifications]);

  // unread count
  const unread = items.filter((i) => !i.read).length;

  // optimistic local mark read
  const markReadLocal = (id: string) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, read: true } : p))
    );
  };

  // try to mark read on server (best-effort)
  const markReadServer = async (notif: Notif) => {
    try {
      if (notif.orderId) {
        await authPost(`/notifications/orders/${notif.orderId}/mark-read`, {});
      }
      await authPost(`/notifications/${encodeURIComponent(notif.id)}/read`, {});
      await fetchNotifications();
    } catch (err) {
      // Best-effort
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((p) => ({ ...p, read: true })));
    try {
      await authPost("/notifications/mark-all-read", {});
      await fetchNotifications();
    } catch {
      // ignore
    }
  };

  // when user clicks a notification
  const onClickNotif = async (n: Notif) => {
    markReadLocal(n.id);
    markReadServer(n).catch(() => {});

    const orderId = n.orderId ?? (Number(n.id) || undefined);
    if (orderId) {
      navigate("/admin/orders", { state: { openOrderId: orderId } });
      setOpen(false);
      return;
    }

    setOpen(false);
  };

  // >48h pending check
  const isOverdue = (n: Notif) => {
    const diff = Date.now() - new Date(n.createdAt).getTime();
    return diff > 48 * 60 * 60 * 1000;
  };

  // close dropdown when clicking outside
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  // Don't render if not signed in (admin only component)
  if (!isSignedIn) {
    return null;
  }

  // framer-motion variants
  const panelVariants = {
    hidden: { opacity: 0, x: 12, scale: 0.98 },
    enter: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 12, scale: 0.98 },
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white border hover:shadow"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 text-xs flex items-center justify-center rounded-full bg-red-600 text-white font-semibold">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial="hidden"
            animate="enter"
            exit="exit"
            variants={panelVariants}
            transition={{ duration: 0.16 }}
            className="absolute right-0 mt-3 w-96 bg-white rounded-lg border shadow-lg z-50 overflow-hidden"
            style={{ transformOrigin: "right top" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <div className="text-base font-semibold text-gray-800">
                  Notifications
                </div>
                <div className="text-xs text-gray-500">
                  {unread > 0 ? `${unread} new` : "No new notifications"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Mark all read
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-auto divide-y">
              {items.length === 0 && (
                <div className="p-4 text-sm text-gray-500 text-center">
                  No notifications
                </div>
              )}

              {items.map((n) => {
                const overdue = isOverdue(n);
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.14 }}
                    className={`flex gap-3 p-3 cursor-pointer items-start ${
                      !n.read
                        ? "bg-blue-50/30 hover:bg-blue-100/40"
                        : "hover:bg-gray-50"
                    } ${overdue ? "border-l-4 border-orange-500" : ""}`}
                    onClick={() => onClickNotif(n)}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-semibold text-indigo-700">
                      {n.title?.[0]?.toUpperCase() ?? "N"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div
                          className={`text-sm font-medium ${
                            n.read ? "text-gray-700" : "text-gray-900"
                          }`}
                        >
                          {n.title}
                        </div>
                        <div className="text-xs text-gray-400">
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>

                      {n.message && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {n.message}
                        </div>
                      )}

                      {overdue && (
                        <div className="text-xs text-orange-600 mt-1 font-medium">
                          ⚠ Pending for over 48 h
                        </div>
                      )}
                    </div>

                    {!n.read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
