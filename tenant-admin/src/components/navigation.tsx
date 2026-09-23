"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Receipt,
  Car,
  BarChart3,
  Shield,
  Settings,
  Wrench,
  FileText,
  FileCheck,
  Smartphone,
  Bell,
  Route,
  GraduationCap,
  MapPinned,
  CalendarDays,
  Pentagon,
} from "lucide-react";

const MODULE_NAV: Record<string, string> = {
  "/trips": "trips",
  "/scholar-payments": "scholar_payments",
  "/transport": "scholar_payments",
  "/tracking": "tracking_live",
  "/tracking/geofences": "tracking_geofence",
  "/notifications": "notifications",
  "/target-calendar": "target_calendar",
};

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/tracking") {
    return (
      pathname === "/tracking" ||
      (pathname.startsWith("/tracking/") &&
        !pathname.startsWith("/tracking/geofences"))
    );
  }
  if (href === "/tracking/geofences") {
    return pathname.startsWith("/tracking/geofences");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation({
  onLinkClick,
  entitlements,
}: {
  onLinkClick?: () => void;
  entitlements?: string[] | null;
}) {
  const pathname = usePathname();
  // null entitlements = unknown/legacy unrestricted (show all)
  const allowed = entitlements == null ? null : new Set(entitlements);

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/drivers", icon: Users, label: "Drivers" },
    { href: "/expiry-requests", icon: FileCheck, label: "Expiry Requests" },
    { href: "/incomes", icon: DollarSign, label: "Vehicle Incomes" },
    { href: "/expenses", icon: Receipt, label: "Expenses" },
    { href: "/vehicles", icon: Car, label: "Vehicles" },
    { href: "/maintenance", icon: Wrench, label: "Maintenance" },
    { href: "/trips", icon: Route, label: "Trips" },
    { href: "/transport", icon: GraduationCap, label: "Scholar & Staff" },
    { href: "/tracking", icon: MapPinned, label: "Live Tracking" },
    { href: "/tracking/geofences", icon: Pentagon, label: "Geofences" },
    { href: "/reports", icon: BarChart3, label: "Reports" },
    { href: "/target-calendar", icon: CalendarDays, label: "Target Calendar" },
    { href: "/audit", icon: FileText, label: "Audit Trail" },
    { href: "/mfa", icon: Shield, label: "Security (MFA)" },
    { href: "/sessions", icon: Smartphone, label: "Sessions" },
    { href: "/notifications", icon: Bell, label: "Notifications" },
    { href: "/tenant-security", icon: Settings, label: "Tenant Security" },
  ].filter((item) => {
    const moduleKey = MODULE_NAV[item.href];
    if (!moduleKey) return true;
    if (allowed == null) return true;
    return allowed.has(moduleKey);
  });

  return (
    <nav className="mt-6 px-4 space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isNavActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onLinkClick}
            className={`sidebar-link ${
              isActive ? "sidebar-link-active" : "sidebar-link-inactive"
            } group`}
          >
            <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
