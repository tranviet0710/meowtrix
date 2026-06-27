"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, AlertTriangle, Eye, Shuffle, Trophy, User, Settings } from "lucide-react";

interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; }

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
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-[#1A1A2E] border-r-[3px] border-[#FFDE4D]">
      <div className="flex items-center h-16 px-5 border-b-[3px] border-[#FFDE4D]">
        <span className="font-[family-name:var(--font-space-grotesk)] text-[#FFDE4D] font-bold text-lg uppercase tracking-wider">
          Meowtrix
        </span>
        <span className="ml-2 text-[#FF6B97] text-xs font-bold uppercase">HQ</span>
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
                  ? "border-[#FFDE4D] bg-[#FFDE4D]/10 text-[#FFDE4D] shadow-[3px_3px_0px_#FFDE4D]"
                  : "border-transparent text-text-secondary hover:border-[#51E5A5] hover:text-[#51E5A5] hover:shadow-[3px_3px_0px_#51E5A5]"
                }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t-[3px] border-[#FFDE4D]">
        <p className="text-xs font-mono font-bold uppercase text-text-secondary">
          Status: <span className="text-[#51E5A5]">● Online</span>
        </p>
      </div>
    </aside>
  );
}
