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
  { label: "Report Lost", href: "/report-lost", icon: AlertTriangle },
  { label: "Report Found", href: "/report-found", icon: Eye },
  { label: "Matches", href: "/matches", icon: Shuffle },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-card border-r border-border">
      {/* Logo / Brand */}
      <div className="flex items-center h-16 px-6 border-b border-border">
        <span className="text-accent font-mono font-bold text-lg tracking-wider">
          MEOWTRIX
        </span>
        <span className="ml-2 text-text-secondary text-xs font-mono">
          HQ
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
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
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium
                transition-colors duration-150
                ${
                  isActive
                    ? "bg-accent/10 text-accent shadow-[0_0_8px_rgba(255,204,0,0.15)]"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                }
              `}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 ${
                  isActive ? "text-accent" : ""
                }`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border">
        <p className="text-xs font-mono text-text-secondary">
          STATUS: <span className="text-success">ONLINE</span>
        </p>
      </div>
    </aside>
  );
}
