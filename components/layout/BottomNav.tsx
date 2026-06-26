"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map,
  AlertTriangle,
  Eye,
  Shuffle,
  Trophy,
  User,
  Settings,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Map", href: "/dashboard", icon: Map },
  { label: "Lost", href: "/report-lost", icon: AlertTriangle },
  { label: "Found", href: "/report-found", icon: Eye },
  { label: "Matches", href: "/matches", icon: Shuffle },
  { label: "Rank", href: "/leaderboard", icon: Trophy },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-1 py-1 overflow-x-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex flex-col items-center justify-center
                min-w-[44px] min-h-[44px] px-1 py-1.5
                rounded-sm transition-colors duration-150
                ${
                  isActive
                    ? "text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }
              `}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={`w-5 h-5 ${isActive ? "text-accent" : ""}`}
                aria-hidden="true"
              />
              <span
                className={`text-[10px] mt-0.5 leading-tight ${
                  isActive ? "font-semibold" : "font-normal"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0.5 w-4 h-0.5 rounded-full bg-accent" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
