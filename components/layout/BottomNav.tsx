"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Map, AlertTriangle, Eye, Shuffle, LogOut, FileText } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Map },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Missing", href: "/report-lost", icon: AlertTriangle },
  { label: "Sighting", href: "/report-found", icon: Eye },
  { label: "Matches", href: "/matches", icon: Shuffle },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-nav-bg border-t border-sidebar-border safe-area-bottom shadow-[var(--shadow-lg)]"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-1 py-1.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center min-w-[44px] min-h-[48px] px-2 py-1 rounded-lg transition-colors duration-150
                ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-sidebar-text hover:text-primary"
                }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] mt-0.5 font-medium leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          className="relative flex flex-col items-center justify-center min-w-[44px] min-h-[48px] px-2 py-1 text-sidebar-text hover:text-danger rounded-lg transition-colors duration-150"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] mt-0.5 font-medium leading-tight">
            Out
          </span>
        </button>
      </div>
    </nav>
  );
}
