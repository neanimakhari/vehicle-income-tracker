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
} from "lucide-react";

export function Navigation({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/drivers", icon: Users, label: "Drivers" },
    { href: "/expiry-requests", icon: FileCheck, label: "Expiry requests" },
    { href: "/incomes", icon: DollarSign, label: "Vehicle Incomes" },
    { href: "/expenses", icon: Receipt, label: "Expenses" },
    { href: "/vehicles", icon: Car, label: "Vehicles" },
    { href: "/maintenance", icon: Wrench, label: "Maintenance" },
    { href: "/reports", icon: BarChart3, label: "Reports" },
    { href: "/audit", icon: FileText, label: "Audit Trail" },
    { href: "/mfa", icon: Shield, label: "Security (MFA)" },
    { href: "/sessions", icon: Smartphone, label: "Sessions" },
    { href: "/tenant-security", icon: Settings, label: "Tenant Security" },
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

