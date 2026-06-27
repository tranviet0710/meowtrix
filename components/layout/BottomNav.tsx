"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Map, AlertTriangle, Eye, Shuffle, LogOut, Sun, Moon, FileText } from "lucide-react";

interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; }
const navItems: NavItem[] = [
  { label: "Map", href: "/dashboard", icon: Map },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Lost", href: "/report-lost", icon: AlertTriangle },
  { label: "Found", href: "/report-found", icon: Eye },
  { label: "Matches", href: "/matches", icon: Shuffle },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  async function handleLogout() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-nav-bg border-t-[3px] border-sidebar-border safe-area-bottom" aria-label="Mobile navigation">
      <div className="flex items-center justify-around px-1 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-1 py-1 transition-all duration-100
                ${isActive
                  ? "text-sidebar-active border-[2px] border-sidebar-active shadow-[2px_2px_0px_var(--color-sidebar-active)] bg-sidebar-active/10"
                  : "text-sidebar-text border-2 border-transparent hover:text-brutal-mint"
                }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] mt-0.5 font-bold uppercase leading-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="relative flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-1 py-1 text-sidebar-text border-2 border-transparent hover:text-brutal-orange transition-all duration-100"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Moon className="w-5 h-5" aria-hidden="true" />
          )}
          <span className="text-[10px] mt-0.5 font-bold uppercase leading-tight">Theme</span>
        </button>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="relative flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-1 py-1 text-sidebar-text border-2 border-transparent hover:text-destructive transition-all duration-100"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] mt-0.5 font-bold uppercase leading-tight">Out</span>
        </button>
      </div>
    </nav>
  );
}
