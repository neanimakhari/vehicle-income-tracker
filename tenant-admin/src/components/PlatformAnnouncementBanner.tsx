"use client";

export function PlatformAnnouncementBanner({
  announcement,
}: {
  announcement: {
    enabled?: boolean;
    severity?: string;
    message?: string;
    blockWrites?: boolean;
  } | null;
}) {
  if (!announcement?.enabled || !announcement.message?.trim()) return null;
  const maintenance = announcement.severity === "maintenance";
  return (
    <div
      className={`px-4 py-2.5 text-sm ${
        maintenance
          ? "bg-amber-600 text-white"
          : "bg-teal-700 text-white"
      }`}
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{announcement.message}</p>
        {maintenance && announcement.blockWrites ? (
          <span className="text-xs opacity-90">Writes may be limited during maintenance</span>
        ) : null}
      </div>
    </div>
  );
}
