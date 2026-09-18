"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  FileText,
  Activity,
  Settings,
  Bell,
} from "lucide-react";

const ALL_NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/health", icon: Activity, label: "Health" },
  { href: "/tenants", icon: Building2, label: "Tenants" },
  { href: "/plans", icon: FileText, label: "Plans", adminOnly: true },
  { href: "/announcement", icon: Bell, label: "Announcement", adminOnly: true },
  { href: "/platform-admins", icon: Users, label: "Platform Admins", adminOnly: true },
  { href: "/sys-accounts", icon: Shield, label: "SYS Accounts", adminOnly: true },
  { href: "/tenant-admins", icon: Users, label: "Tenant Admins", adminOnly: true },
  { href: "/audit", icon: FileText, label: "Audit Logs" },
  { href: "/alerts", icon: Bell, label: "Alerts" },
  { href: "/defaults", icon: Settings, label: "Defaults", adminOnly: true },
  { href: "/mfa", icon: Shield, label: "Security (MFA)" },
];

export function Navigation({
  onLinkClick,
  role,
}: {
  onLinkClick?: () => void;
  role?: string | null;
}) {
  const pathname = usePathname();
  const isSys = role === "SYS";
  const navItems = ALL_NAV.filter((item) => !(isSys && item.adminOnly));

  return (
    <nav className="mt-6 px-4 space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

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
