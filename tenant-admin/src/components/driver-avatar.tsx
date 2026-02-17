"use client";

import { useState } from "react";

export function DriverAvatar({
  driverId,
  firstName,
  lastName,
  size = 40,
  className = "",
}: {
  driverId: string;
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const showImage = !failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white font-semibold shadow-md ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {showImage ? (
        <img
          src={`/api/drivers/${driverId}/picture`}
          alt={`${firstName ?? ""} ${lastName ?? ""}`.trim() || "Driver"}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
