"use client";

import { BrandMockFrames } from "@/components/brand/BrandMockFrames";
import type { BrandDraft } from "@/lib/brand-tokens";
import { useState } from "react";

export function BrandPreviewClient({
  brand,
  tenantName,
  watermark,
}: {
  brand: BrandDraft;
  tenantName: string;
  watermark: string;
}) {
  const [adminScreen, setAdminScreen] = useState<"login" | "dashboard" | "drivers" | "reports">(
    "dashboard",
  );
  const [phoneScreen, setPhoneScreen] = useState<"home" | "income" | "history" | "drawer">("home");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Brand preview
        </h1>
        <BrandMockFrames
          draft={brand}
          tenantName={tenantName}
          adminScreen={adminScreen}
          phoneScreen={phoneScreen}
          onAdminScreen={setAdminScreen}
          onPhoneScreen={setPhoneScreen}
          watermark={watermark}
        />
      </div>
    </div>
  );
}
