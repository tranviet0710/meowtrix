"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Map, AlertTriangle, Eye, Shuffle, Trophy, User, Settings, LogOut, Sun, Moon, FileText } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/layout/NotificationBell";

interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; }

const navItems: NavItem[] = [
  { label: "Map", href: "/dashboard", icon: Map },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Report Lost", href: "/report-lost", icon: AlertTriangle },
  { label: "Report Found", href: "/report-found", icon: Eye },
  { label: "Matches", href: "/matches", icon: Shuffle },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
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
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-sidebar-bg border-r-[3px] border-sidebar-border">
      <div className="flex items-center h-16 px-5 border-b-[3px] border-sidebar-border">
        <Image src="/logo/logo.png" alt="Meowtrix logo" width={28} height={28} className="mr-2" />
        <span className="font-[family-name:var(--font-space-grotesk)] text-sidebar-active font-bold text-lg uppercase tracking-wider">
          Meowtrix
        </span>
        <span className="ml-2 text-brutal-pink text-xs font-bold uppercase">HQ</span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-bold uppercase tracking-wide border-[2px] transition-all duration-100
                ${isActive
                  ? "border-sidebar-active bg-sidebar-active/10 text-sidebar-active shadow-[3px_3px_0px_var(--color-sidebar-active)]"
                  : "border-transparent text-sidebar-text hover:border-brutal-mint hover:text-brutal-mint hover:shadow-[3px_3px_0px_var(--color-brutal-mint)]"
                }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t-[3px] border-sidebar-border space-y-2">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-bold uppercase tracking-wide border-[2px] border-transparent text-sidebar-text hover:border-brutal-orange hover:text-brutal-orange hover:shadow-[3px_3px_0px_var(--color-brutal-orange)] transition-all duration-100"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          ) : (
            <Moon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          )}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>

        {/* Logout button */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-bold uppercase tracking-wide border-[2px] border-transparent text-sidebar-text hover:border-destructive hover:text-destructive hover:shadow-[3px_3px_0px_var(--color-destructive)] transition-all duration-100 disabled:opacity-50"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{isLoggingOut ? "Signing out..." : "Log Out"}</span>
        </button>
      </div>
    </aside>
  );
}
