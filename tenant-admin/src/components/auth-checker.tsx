"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

export function AuthChecker() {
  const router = useRouter();
  const pathname = usePathname();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const idleTimeoutMs = 30 * 60 * 1000;
  const warningMs = 2 * 60 * 1000;
  const warningSeconds = useMemo(() => Math.max(1, Math.floor(warningMs / 1000)), [warningMs]);

  useEffect(() => {
    let lastActivity = Date.now();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const forceLogout = async (reason: "expired" | "idle-expired") => {
      try {
        await fetch("/api/logout", { method: "POST", credentials: "include" });
      } catch {
        // continue to redirect even if clear endpoint fails
      }
      router.push(`/login?error=${reason}`);
    };

    // Check for token expiration on client side
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        });
        
        if (response.status === 401) {
          await forceLogout("expired");
          return;
        }

        const now = Date.now();
        const idleFor = now - lastActivity;
        const timeoutAt = idleTimeoutMs;
        const warnAt = idleTimeoutMs - warningMs;
        if (idleFor >= timeoutAt) {
          await forceLogout("idle-expired");
          return;
        }
        if (idleFor >= warnAt) {
          const remaining = Math.max(1, Math.ceil((timeoutAt - idleFor) / 1000));
          setSecondsLeft(remaining);
          setWarningOpen(true);
        } else {
          setWarningOpen(false);
        }
      } catch (error) {
        // Silently fail - server-side checks will handle it
      }
    };

    const onActivity = () => {
      lastActivity = Date.now();
      if (warningOpen) {
        setWarningOpen(false);
        setSecondsLeft(warningSeconds);
      }
    };

    // Check auth and idle status every 15 seconds
    intervalId = setInterval(checkAuth, 15 * 1000);
    
    // Also check on focus
    window.addEventListener("focus", checkAuth);
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("focus", checkAuth);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("scroll", onActivity);
    };
  }, [router, pathname, warningMs, idleTimeoutMs, warningOpen, warningSeconds]);

  useEffect(() => {
    if (!warningOpen) return;
    const tick = setInterval(() => {
      setSecondsLeft((prev) => Math.max(1, prev - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [warningOpen]);

  return warningOpen ? (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-zinc-100 shadow-2xl">
        <h3 className="text-lg font-semibold">Session expiring soon</h3>
        <p className="mt-2 text-sm text-zinc-300">
          You have been idle. You will be logged out in <span className="font-semibold text-teal-300">{secondsLeft}s</span>.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-primary" onClick={() => setWarningOpen(false)}>
            Stay signed in
          </button>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await fetch("/api/logout", { method: "POST", credentials: "include" });
              } catch {}
              router.push("/login?error=idle-expired");
            }}
          >
            Log out now
          </button>
        </div>
      </div>
    </div>
  ) : null;
}

