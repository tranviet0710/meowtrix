"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, AlertTriangle, Eye, Shuffle, Trophy, User, Settings } from "lucide-react";

interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; }
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A2E] border-t-[3px] border-[#FFDE4D] safe-area-bottom" aria-label="Mobile navigation">
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
                  ? "text-[#FFDE4D] border-[2px] border-[#FFDE4D] shadow-[2px_2px_0px_#FFDE4D] bg-[#FFDE4D]/10"
                  : "text-text-secondary border-2 border-transparent hover:text-[#51E5A5]"
                }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] mt-0.5 font-bold uppercase leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
