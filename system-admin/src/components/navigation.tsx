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

export function Navigation({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/health", icon: Activity, label: "Health" },
    { href: "/tenants", icon: Building2, label: "Tenants" },
    { href: "/platform-admins", icon: Users, label: "Platform Admins" },
    { href: "/tenant-admins", icon: Users, label: "Tenant Admins" },
    { href: "/audit", icon: FileText, label: "Audit Logs" },
    { href: "/alerts", icon: Bell, label: "Alerts" },
    { href: "/defaults", icon: Settings, label: "Defaults" },
    { href: "/mfa", icon: Shield, label: "Security (MFA)" },
  ];

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

