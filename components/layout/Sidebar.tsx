"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Map,
  AlertTriangle,
  Eye,
  Shuffle,
  Trophy,
  User,
  Settings,
  LogOut,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/layout/NotificationBell";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Map },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Report Missing", href: "/report-lost", icon: AlertTriangle },
  { label: "Report Sighting", href: "/report-found", icon: Eye },
  { label: "Matches", href: "/matches", icon: Shuffle },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const res = await fetch("/api/auth/signout", { method: "POST" });
      if (res.redirected) {
        router.push("/login");
      } else {
        router.push("/login");
      }
    } catch {
      router.push("/login");
    }
  }

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-sidebar-bg border-r border-sidebar-border">
      <div className="flex items-center h-16 px-5 border-b border-sidebar-border">
        <Image
          src="/logo/logo.png"
          alt="Meowtrix logo"
          width={32}
          height={32}
          className="mr-2 rounded-lg"
        />
        <span className="font-[family-name:var(--font-space-grotesk)] text-text-primary font-bold text-lg tracking-tight">
          Meowtrix
        </span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      <nav
        className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150
                ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-text hover:bg-muted hover:text-text-primary"
                }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg text-sidebar-text hover:bg-danger/10 hover:text-danger transition-colors duration-150 disabled:opacity-50"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{isLoggingOut ? "Signing out…" : "Sign Out"}</span>
        </button>
      </div>
    </aside>
  );
}
