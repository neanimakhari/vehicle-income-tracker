"use client";

import { useState, useTransition } from "react";

type Category = { id: string; name: string; description: string | null };

type SendResult = {
  ok: boolean;
  error?: string;
  status?: string;
  push?: {
    configured: boolean;
    enabled: boolean;
    skipped: boolean;
    reason?: string;
    recipientCount: number;
    onesignalId?: string | null;
    errors?: string[];
  };
};

function humanPushFeedback(res: SendResult): string {
  const push = res.push;
  if (!push) return `Saved (${res.status ?? "ok"}).`;

  if (!push.configured || !push.enabled) {
    return `Saved as ${res.status ?? "recorded"}. Push not sent yet — OneSignal credentials pending (${push.reason ?? "disabled"}).`;
  }
  if (push.skipped) {
    return `Saved (${res.status}). ${push.reason ?? "Push skipped"} · ${push.recipientCount} recipients resolved.`;
  }

  const unsubscribed = (push.errors ?? []).some((e) =>
    /not subscribed|have not opened the app/i.test(e),
  );
  if (unsubscribed && (res.status === "sent_no_devices" || !push.onesignalId)) {
    return (
      `Saved for ${push.recipientCount} recipient(s), but no phone has opted into push yet. ` +
      `Drivers must open the latest app, sign in, and allow notifications — then send again.`
    );
  }

  if (res.status === "push_partial" || (push.onesignalId && push.errors?.length)) {
    const detail = push.errors?.[0];
    return (
      `Sent to devices that are subscribed` +
      (detail ? ` — ${detail}` : "") +
      `. Tip: target Drivers only if admins do not use the mobile app.`
    );
  }

  if (res.status === "push_failed") {
    return `Could not send push${push.errors?.[0] ? `: ${push.errors[0]}` : ""}. Message was still saved.`;
  }

  return `Sent to ${push.recipientCount} recipient(s).`;
}

export function SendNotificationForm({
  categories,
  sendNotification,
}: {
  categories: Category[];
  sendNotification: (formData: FormData) => Promise<SendResult>;
}) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      action={(fd) => {
        setFeedback(null);
        setError(null);
        start(async () => {
          const res = await sendNotification(fd);
          if (!res.ok) {
            setError(res.error ?? "Send failed");
            return;
          }
          setFeedback(humanPushFeedback(res));
        });
      }}
    >
      <select name="categoryId" className="input w-full px-3 py-2 text-sm" disabled={pending}>
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        name="targetRole"
        className="input w-full px-3 py-2 text-sm"
        defaultValue="TENANT_USER"
        disabled={pending}
      >
        <option value="TENANT_USER">Drivers</option>
        <option value="TENANT_ADMIN">Tenant admins</option>
        <option value="">All roles</option>
      </select>
      <input
        name="title"
        placeholder="Title"
        className="input w-full px-3 py-2 text-sm"
        required
        disabled={pending}
      />
      <textarea
        name="message"
        placeholder="Message"
        className="input w-full px-3 py-2 text-sm"
        rows={4}
        required
        disabled={pending}
      />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
      {feedback && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{feedback}</p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
