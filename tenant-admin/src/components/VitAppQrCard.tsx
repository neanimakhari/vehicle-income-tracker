"use client";

/** QR for this tenant's path-based app download URL. */
export function VitAppQrCard({ tenantSlug }: { tenantSlug: string }) {
  const base =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_VIT_APP_URL?.replace(/\/$/, "")) ||
    "https://vit-app.vehinc.co.za";
  const url = tenantSlug ? `${base}/${encodeURIComponent(tenantSlug)}` : base;
  const img = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Driver app install QR</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Print this for vehicles or driver cards. Opens your company download page — drivers sign in
        before downloading.
      </p>
      <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt="QR code for VIT app download"
          width={220}
          height={220}
          className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700"
        />
        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          <p>
            URL:{" "}
            <a className="text-teal-700 underline dark:text-teal-400" href={url}>
              {url}
            </a>
          </p>
          <a
            className="btn-secondary mt-3 inline-flex min-h-11 items-center"
            href={img}
            download="vit-app-qr.png"
            target="_blank"
            rel="noreferrer"
          >
            Download QR PNG
          </a>
        </div>
      </div>
    </div>
  );
}
