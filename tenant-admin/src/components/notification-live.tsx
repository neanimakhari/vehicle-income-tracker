"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { AlertTriangle, Bell, X } from "lucide-react";
import { fetchJsonClient } from "@/lib/api-client";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(
  /\/v1\/?$/,
  "",
);

type NotificationCreated = {
  id: string;
  title: string;
  message: string;
  source: string;
  deepLink: string | null;
  targetRole?: string | null;
  meta?: Record<string, unknown>;
  createdAt?: string;
};

type IncidentCreated = {
  id: string;
  driverId: string;
  vehicle: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  title?: string;
  message?: string;
};

type LiveToast = {
  title: string;
  message: string;
  href: string;
  severity: "incident" | "info";
};

type Ctx = {
  unread: number;
  refreshUnread: () => void;
};

const NotificationLiveContext = createContext<Ctx>({
  unread: 0,
  refreshUnread: () => undefined,
});

export function useNotificationLive() {
  return useContext(NotificationLiveContext);
}

export function NotificationLiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<LiveToast | null>(null);

  const refreshUnread = useCallback(() => {
    void fetchJsonClient<{ count: number }>(
      "/api/proxy/tenant/notifications/unread-count",
      { tolerate401: true },
    ).then((res) => {
      if (res && typeof res.count === "number") setUnread(res.count);
    });
  }, []);

  useEffect(() => {
    refreshUnread();
    const poll = window.setInterval(refreshUnread, 30_000);
    return () => window.clearInterval(poll);
  }, [refreshUnread]);

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;
    (async () => {
      const creds = await fetchJsonClient<{ token: string; tenantId: string }>(
        "/api/ws-token",
        { tolerate401: true },
      );
      if (!creds?.token || !creds.tenantId || cancelled) return;
      socket = io(`${API_BASE}/tenant-events`, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        auth: { token: creds.token, tenantId: creds.tenantId },
        query: { tenantId: creds.tenantId },
      });
      socket.on("connect", () => {
        socket?.emit("join", { tenantId: creds.tenantId });
      });
      socket.on("notification.created", (ev: NotificationCreated) => {
        const isIncident = ev.source === "incident";
        // Panic toast is owned by incident.created to avoid double toasts.
        if (!isIncident) {
          const href = ev.deepLink?.startsWith("/")
            ? ev.deepLink
            : "/notifications?tab=inbox";
          setToast({
            title: ev.title || "Notification",
            message: ev.message || "",
            href,
            severity: "info",
          });
          window.setTimeout(() => setToast(null), 10_000);
        }
        setUnread((n) => n + 1);
        if (isIncident && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("vit:incident-created", { detail: ev }),
          );
        }
      });
      socket.on("incident.created", (ev: IncidentCreated) => {
        setToast({
          title: ev.title || "Panic alert",
          message: ev.message || "A driver pressed Panic",
          href: `/incidents?id=${encodeURIComponent(ev.id)}`,
          severity: "incident",
        });
        window.setTimeout(() => setToast(null), 10_000);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("vit:incident-created", { detail: ev }),
          );
        }
        refreshUnread();
      });
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [refreshUnread]);

  const value = useMemo(
    () => ({ unread, refreshUnread }),
    [unread, refreshUnread],
  );

  return (
    <NotificationLiveContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          className="fixed top-4 right-4 z-[100] max-w-md animate-in fade-in slide-in-from-top-2 duration-300"
          role="alert"
        >
          <div
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              toast.severity === "incident"
                ? "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100"
                : "border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-100"
            }`}
          >
            <AlertTriangle
              className={`h-5 w-5 flex-shrink-0 ${
                toast.severity === "incident"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-teal-600 dark:text-teal-400"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{toast.title}</p>
              <p className="mt-0.5 text-sm opacity-90 line-clamp-3">{toast.message}</p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold underline underline-offset-2"
                onClick={() => {
                  setToast(null);
                  router.push(toast.href);
                }}
              >
                Open
              </button>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded p-1 hover:opacity-80"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </NotificationLiveContext.Provider>
  );
}

export function NotificationBellLink() {
  const { unread } = useNotificationLive();
  return (
    <Link
      href="/notifications?tab=inbox"
      className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition-all hover:bg-zinc-50 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications inbox"}
      title="Notifications inbox"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

/** Call from Incidents page to soft-refresh when a panic arrives. */
export function useIncidentLiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const onCreated = () => router.refresh();
    window.addEventListener("vit:incident-created", onCreated);
    return () => window.removeEventListener("vit:incident-created", onCreated);
  }, [router]);
}
