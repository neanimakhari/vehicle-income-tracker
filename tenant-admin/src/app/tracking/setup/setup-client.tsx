"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";

type VehicleRow = { id: string; label: string; trackerImei?: string | null };
type DeviceRow = {
  id: string;
  imei: string;
  vehicleId: string;
  isActive: boolean;
  lastSeenAt: string | null;
};

const MICODUS_HOST =
  process.env.NEXT_PUBLIC_MICODUS_HOST?.trim() || "104.248.42.192";
const MICODUS_PORT = process.env.NEXT_PUBLIC_MICODUS_PORT?.trim() || "7700";

function normalizeImei(raw: string): string {
  return raw.replace(/\D/g, "");
}

function StepDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
        done
          ? "bg-teal-600 text-white"
          : active
            ? "bg-teal-100 text-teal-800 ring-2 ring-teal-500 dark:bg-teal-950 dark:text-teal-200"
            : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800"
      }`}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : null}
    </span>
  );
}

export function TrackerSetupClient({
  vehicles,
  initialVehicleId,
}: {
  vehicles: VehicleRow[];
  initialVehicleId?: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const fromQuery = search.get("vehicleId") ?? initialVehicleId ?? "";

  const unbound = useMemo(
    () => vehicles.filter((v) => !v.trackerImei),
    [vehicles],
  );

  const [step, setStep] = useState(1);
  const [vehicleId, setVehicleId] = useState(
    fromQuery || unbound[0]?.id || vehicles[0]?.id || "",
  );
  const [imeiRaw, setImeiRaw] = useState("");
  const [boundImei, setBoundImei] = useState<string | null>(null);
  const [simOk, setSimOk] = useState(false);
  const [apnOk, setApnOk] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [signalAt, setSignalAt] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const imei = normalizeImei(imeiRaw);
  const imeiWarn =
    imei.length > 0 && imei.length < 15
      ? "Usually 15 digits on the sticker. Shorter IDs are OK only if that is exactly what the unit sends."
      : null;
  const serverSms = `SERVER,0,${MICODUS_HOST},${MICODUS_PORT}#`;
  const timerSms = "TIMER,30#";

  const selected = vehicles.find((v) => v.id === vehicleId);

  async function bind() {
    if (!vehicleId || !imei) {
      setError("Pick a vehicle and enter the IMEI from the tracker sticker.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/tenant/tracking/devices/${vehicleId}/bind`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imei }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? `Bind failed (${res.status})`);
        return;
      }
      setBoundImei(imei);
      setStep(4);
    } finally {
      setBusy(false);
    }
  }

  const checkSignal = useCallback(async () => {
    const look = boundImei ?? imei;
    if (!look) return false;
    try {
      const [devs, latest] = await Promise.all([
        fetch("/api/proxy/tenant/tracking/devices").then((r) =>
          r.ok ? r.json() : [],
        ),
        fetch("/api/proxy/tenant/tracking/latest").then((r) =>
          r.ok ? r.json() : [],
        ),
      ]);
      const device = (Array.isArray(devs) ? devs : []).find(
        (d: DeviceRow) => d.imei === look,
      );
      if (device?.lastSeenAt) {
        setSignalAt(device.lastSeenAt);
        return true;
      }
      const point = (Array.isArray(latest) ? latest : []).find(
        (p: { deviceId?: string; vehicleId?: string }) =>
          p.deviceId === look || p.vehicleId === vehicleId,
      );
      if (point) {
        setSignalAt(new Date().toISOString());
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }, [boundImei, imei, vehicleId]);

  useEffect(() => {
    if (step !== 6 || !boundImei) return;
    setPolling(true);
    let cancelled = false;
    const tick = async () => {
      const ok = await checkSignal();
      if (!cancelled && ok) {
        setStep(7);
        setPolling(false);
      }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
      setPolling(false);
    };
  }, [step, boundImei, checkSignal]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the text manually.");
    }
  }

  const steps = [
    { n: 1, label: "Vehicle" },
    { n: 2, label: "IMEI" },
    { n: 3, label: "Bind" },
    { n: 4, label: "SIM" },
    { n: 5, label: "Server SMS" },
    { n: 6, label: "Signal" },
    { n: 7, label: "Done" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">
          Tracker setup
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Connect a GPS tracker
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Follow the same path as a first Micodus install: sticker IMEI, bind to
          a vehicle, then point the unit at VIT on port {MICODUS_PORT}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <div key={s.n} className="flex items-center gap-1.5 text-xs text-zinc-500">
            <StepDot done={step > s.n} active={step === s.n} />
            <span className={step === s.n ? "font-semibold text-zinc-800 dark:text-zinc-100" : ""}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {step === 1 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">1. Choose the vehicle</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Prefer a vehicle that does not already have an IMEI bound.
            </p>
            <select
              className="input w-full"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.trackerImei ? ` (bound ${v.trackerImei})` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!vehicleId}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">2. Enter the number on the tracker</h2>
            <div className="rounded-xl border border-teal-200/70 bg-teal-50/80 p-4 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100">
              <p className="font-medium">Use the IMEI on the device sticker</p>
              <p className="mt-1 opacity-90">
                On Micodus MV55G (and most units) this is usually <strong>15 digits</strong> under
                the barcode — not the SIM ICCID, and not the phone number.
              </p>
            </div>
            <label className="block text-xs font-medium text-zinc-500">
              IMEI for {selected?.label ?? "vehicle"}
            </label>
            <input
              className="input w-full font-mono"
              inputMode="numeric"
              placeholder="e.g. 356938035643809"
              value={imeiRaw}
              onChange={(e) => setImeiRaw(e.target.value)}
            />
            {imei ? (
              <p className="text-xs text-zinc-500">
                Digits: {imei.length}
                {imei.length === 15 ? " · looks like a full IMEI" : ""}
              </p>
            ) : null}
            {imeiWarn ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">{imeiWarn}</p>
            ) : null}
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={imei.length < 8}
                onClick={() => setStep(3)}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">3. Bind IMEI to vehicle</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              VIT will only accept GPS from this IMEI for{" "}
              <strong>{selected?.label}</strong>.
            </p>
            <p className="rounded-lg bg-zinc-50 px-3 py-2 font-mono text-sm dark:bg-zinc-950">
              {imei}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void bind()}
              >
                {busy ? "Binding…" : "Bind tracker"}
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">4. SIM and data</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Bound <span className="font-mono">{boundImei}</span>. Confirm the unit can get
              mobile data.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={simOk}
                onChange={(e) => setSimOk(e.target.checked)}
              />
              Micro-SIM inserted and active (data plan, not voice-only).
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={apnOk}
                onChange={(e) => setApnOk(e.target.checked)}
              />
              Carrier APN configured (send the operator’s APN SMS if the unit is new).
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!simOk || !apnOk}
                onClick={() => setStep(5)}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">5. Point the tracker at VIT</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              SMS this command to the tracker’s SIM number (from a phone that can text it). Raw
              TCP on port {MICODUS_PORT} — not HTTPS.
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-3 font-mono text-sm text-teal-300">
              <span className="flex-1 break-all">{serverSms}</span>
              <button
                type="button"
                className="btn btn-secondary shrink-0 text-xs"
                onClick={() => void copyText(serverSms)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Optional report interval:{" "}
              <button
                type="button"
                className="font-mono text-teal-700 underline dark:text-teal-300"
                onClick={() => void copyText(timerSms)}
              >
                {timerSms}
              </button>
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={smsSent}
                onChange={(e) => setSmsSent(e.target.checked)}
              />
              I sent the SERVER SMS (or set the host in the vendor app).
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(4)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!smsSent}
                onClick={() => setStep(6)}
              >
                Wait for signal
              </button>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">6. Waiting for first signal</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Leave the unit outdoors with ignition/ACC on if required. We poll every few seconds
              for IMEI <span className="font-mono">{boundImei}</span>.
            </p>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              {polling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Listening for heartbeat or GPS point…
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void checkSignal().then((ok) => ok && setStep(7))}
            >
              Check now
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(5)}>
              Back
            </button>
          </div>
        ) : null}

        {step === 7 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-teal-800 dark:text-teal-200">
              Tracker is connected
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {selected?.label} · <span className="font-mono">{boundImei}</span>
              {signalAt ? ` · seen ${new Date(signalAt).toLocaleString()}` : ""}
            </p>
            <p className="text-xs text-zinc-500">
              Optional device SMS so alarm bits fire:{" "}
              <code className="text-[11px]">SPEED,80#</code>,{" "}
              <code className="text-[11px]">ACCALM,1#</code>,{" "}
              <code className="text-[11px]">PWRALM,1#</code>
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                router.push(
                  `/tracking?vehicleId=${encodeURIComponent(vehicleId)}`,
                )
              }
            >
              Open live map
            </button>
          </div>
        ) : null}
      </div>

      <p className="text-center text-sm">
        <a href="/tracking" className="text-teal-700 underline-offset-2 hover:underline dark:text-teal-300">
          Back to Live Tracking
        </a>
      </p>
    </div>
  );
}
