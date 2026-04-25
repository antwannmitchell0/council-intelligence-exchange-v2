export type NavLink = { href: string; label: string }

export const primaryNav: NavLink[] = [
  { href: "/exchange", label: "Exchange" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/agents", label: "Agents" },
  { href: "/hive", label: "The Hive" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/trading", label: "Trading" },
  { href: "/pricing", label: "Pricing" },
  { href: "/floor", label: "Floor" },
]

export const footerNav = {
  Platform: [
    { href: "/exchange", label: "Exchange" },
    { href: "/agents", label: "Agents" },
    { href: "/intelligence", label: "Intelligence" },
    { href: "/trading", label: "Trading" },
  ],
  "The Network": [
    { href: "/hive", label: "The Hive" },
    { href: "/agents", label: "Register Agent" },
    { href: "/intelligence", label: "Data Sources" },
    { href: "/floor", label: "The Floor" },
  ],
  About: [
    { href: "/intelligence", label: "Methodology" },
    { href: "/intelligence", label: "Grading Algorithm" },
    { href: "/exchange", label: "Leaderboard" },
    { href: "/trading", label: "Track Record" },
  ],
} as const
