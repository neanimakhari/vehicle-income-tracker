"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CheckAuthOk = {
  ok: true;
  secondsLeft: number;
  canExtend?: boolean;
};

/** Seconds before JWT expiry to show the extend modal. */
const JWT_WARN_SECONDS = 120;
/** How long the user has to answer before hard logout. */
const PROMPT_SECONDS = 90;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_WARN_MS = 2 * 60 * 1000;

async function hardLogout(reason: string) {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
  } catch {
    /* continue */
  }
  window.location.assign(`/login?error=${encodeURIComponent(reason)}`);
}

export function AuthChecker() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"jwt" | "idle">("jwt");
  const [secondsLeft, setSecondsLeft] = useState(PROMPT_SECONDS);
  const [extending, setExtending] = useState(false);
  const [canExtend, setCanExtend] = useState(true);
  const lastActivityRef = useRef(Date.now());
  const promptDeadlineRef = useRef<number | null>(null);
  const openRef = useRef(false);

  const openPrompt = useCallback((kind: "jwt" | "idle", extendable: boolean) => {
    if (openRef.current && reason === kind) return;
    openRef.current = true;
    setReason(kind);
    setCanExtend(extendable);
    setSecondsLeft(PROMPT_SECONDS);
    promptDeadlineRef.current = Date.now() + PROMPT_SECONDS * 1000;
    setOpen(true);
  }, [reason]);

  const closePrompt = useCallback(() => {
    openRef.current = false;
    promptDeadlineRef.current = null;
    setOpen(false);
  }, []);

  const extendSession = useCallback(async () => {
    setExtending(true);
    try {
      // Idle-only: if JWT still healthy, just reset activity without refresh.
      if (reason === "idle") {
        const check = await fetch("/api/check-auth", { credentials: "include" });
        if (check.ok) {
          const data = (await check.json()) as CheckAuthOk;
          if (typeof data.secondsLeft === "number" && data.secondsLeft > JWT_WARN_SECONDS) {
            lastActivityRef.current = Date.now();
            closePrompt();
            return;
          }
        }
      }
      const res = await fetch("/api/session/extend", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        await hardLogout("expired");
        return;
      }
      lastActivityRef.current = Date.now();
      closePrompt();
    } catch {
      await hardLogout("expired");
    } finally {
      setExtending(false);
    }
  }, [closePrompt, reason]);

  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });

    const tick = setInterval(async () => {
      try {
        const response = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        });
        if (response.status === 401) {
          await hardLogout("expired");
          return;
        }
        const data = (await response.json()) as CheckAuthOk;
        const idleFor = Date.now() - lastActivityRef.current;

        if (idleFor >= IDLE_TIMEOUT_MS) {
          await hardLogout("idle-expired");
          return;
        }

        if (openRef.current && promptDeadlineRef.current) {
          const remaining = Math.max(
            0,
            Math.ceil((promptDeadlineRef.current - Date.now()) / 1000),
          );
          setSecondsLeft(remaining);
          if (remaining <= 0) {
            await hardLogout(reason === "idle" ? "idle-expired" : "expired");
          }
          return;
        }

        if (idleFor >= IDLE_TIMEOUT_MS - IDLE_WARN_MS) {
          openPrompt("idle", Boolean(data.canExtend));
          return;
        }

        if (typeof data.secondsLeft === "number" && data.secondsLeft <= JWT_WARN_SECONDS) {
          openPrompt("jwt", Boolean(data.canExtend));
        }
      } catch {
        /* ignore transient */
      }
    }, 5_000);

    window.addEventListener("focus", () => {
      void fetch("/api/check-auth", { credentials: "include" }).then(async (r) => {
        if (r.status === 401) await hardLogout("expired");
      });
    });

    return () => {
      clearInterval(tick);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("scroll", onActivity);
    };
  }, [openPrompt, reason]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-extend-title"
        className="relative w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-zinc-100 shadow-2xl"
      >
        <h3 id="session-extend-title" className="text-lg font-semibold">
          {reason === "idle" ? "Still there?" : "Session expiring soon"}
        </h3>
        <p className="mt-2 text-sm text-zinc-300">
          {reason === "idle"
            ? "You have been idle. Extend your session or you will be signed out."
            : "Your login session is about to expire. Extend it to keep working."}{" "}
          Auto sign-out in{" "}
          <span className="font-semibold text-teal-300">{secondsLeft}s</span>.
        </p>
                        {!canExtend && reason === "jwt" && (
          <p className="mt-2 text-xs text-amber-300/90">
            Re-login required to extend — refresh token is not available on this
            session. Sign in again once to enable Extend.
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={extending}
            onClick={() => void hardLogout(reason === "idle" ? "idle-expired" : "expired")}
          >
            Log out now
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={extending || (reason === "jwt" && !canExtend)}
            onClick={() => void extendSession()}
          >
            {extending ? "Extending…" : "Extend session"}
          </button>
        </div>
      </div>
    </div>
  );
}
