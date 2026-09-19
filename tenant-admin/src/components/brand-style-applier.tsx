"use client";

import { useEffect } from "react";
import { brandCssVars, type PolicyBrand } from "@/lib/brand-tokens";

/** Applies tenant brand CSS variables onto documentElement (overrides teal scale). */
export function BrandStyleApplier({ brand }: { brand?: PolicyBrand | null }) {
  useEffect(() => {
    const root = document.documentElement;
    const vars = brandCssVars(brand);
    const keys = Object.keys(vars);
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v);
    }
    if (brand?.sidebarStyle === "neutral") {
      root.classList.add("brand-sidebar-neutral");
    } else {
      root.classList.remove("brand-sidebar-neutral");
    }
    return () => {
      for (const k of keys) root.style.removeProperty(k);
      root.classList.remove("brand-sidebar-neutral");
    };
  }, [brand]);

  return null;
}
