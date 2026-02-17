"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";

export function NavLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`sidebar-link ${
        isActive ? "sidebar-link-active" : "sidebar-link-inactive"
      } group`}
    >
      <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
      <span>{label}</span>
    </Link>
  );
}

