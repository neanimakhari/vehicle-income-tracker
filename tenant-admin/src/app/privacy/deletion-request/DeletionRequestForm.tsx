"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { getApiUrl } from "@/lib/api-client";

export function DeletionRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch(`${getApiUrl()}/public/privacy/deletion-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company: company || undefined, details: details || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setStatus("err");
        setMessage(
          Array.isArray(body.message)
            ? body.message.join(" ")
            : String(body.message ?? `Request failed (${res.status})`),
        );
        return;
      }
      setStatus("ok");
      setMessage(
        body.message ??
          "Your request was sent. We aim to respond within 30 days.",
      );
      setName("");
      setEmail("");
      setCompany("");
      setDetails("");
    } catch {
      setStatus("err");
      setMessage("Could not send. Email support@vehinc.co.za instead.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Full name
        </label>
        <input
          className="input w-full"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Email
        </label>
        <input
          type="email"
          className="input w-full"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Company / tenant (optional)
        </label>
        <input
          className="input w-full"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          What should we delete? (optional)
        </label>
        <textarea
          className="input w-full min-h-[100px]"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={2000}
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={status === "sending"}
      >
        {status === "sending" ? "Sending…" : "Submit request"}
      </button>
      {message ? (
        <p
          className={`text-sm ${
            status === "ok"
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
          }`}
        >
          {message}
        </p>
      ) : null}
      <p className="text-xs text-zinc-500">
        Or email{" "}
        <a className="underline" href="mailto:support@vehinc.co.za">
          support@vehinc.co.za
        </a>
        . See our{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
