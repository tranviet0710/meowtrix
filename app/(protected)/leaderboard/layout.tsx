import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard — MEOWTRIX",
  description:
    "Top Informants ranked by Intel Points. See who's leading the charge in finding lost cats on MEOWTRIX.",
  openGraph: {
    title: "MEOWTRIX — Informant Leaderboard",
    description:
      "Check out the top field operatives on MEOWTRIX! Ranked by successful cat recoveries. 🐱🕵️",
    type: "website",
    siteName: "MEOWTRIX — Feline Overlord Tracker",
  },
  twitter: {
    card: "summary_large_image",
    title: "MEOWTRIX — Informant Leaderboard",
    description:
      "Check out the top field operatives on MEOWTRIX! Ranked by successful cat recoveries. 🐱🕵️",
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
