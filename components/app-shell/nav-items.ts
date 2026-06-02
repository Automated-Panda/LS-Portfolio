import {
  Briefcase,
  Building2,
  Car,
  Gem,
  Grid3x3,
  Home,
  LayoutDashboard,
  Sparkles,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "vehicles" | "properties" | "businesses";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: NavBadgeKey;
  /** Render with the brand accent so the item stands out (e.g. Credits). */
  highlight?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_PINNED: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Credits", href: "/credits", icon: Gem, highlight: true },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Browse",
    items: [
      { label: "All Vehicles", href: "/vehicles", icon: Car },
      { label: "All Properties", href: "/properties", icon: Building2 },
      { label: "All Businesses", href: "/businesses", icon: Briefcase },
      { label: "Visual Garage", href: "/garage", icon: Grid3x3 },
    ],
  },
  {
    label: "My Portfolio",
    items: [
      {
        label: "My Vehicles",
        href: "/my-vehicles",
        icon: Warehouse,
        badgeKey: "vehicles",
      },
      {
        label: "My Properties",
        href: "/my-properties",
        icon: Home,
        badgeKey: "properties",
      },
      {
        label: "My Businesses",
        href: "/my-businesses",
        icon: Briefcase,
        badgeKey: "businesses",
      },
      {
        label: "Organize",
        href: "/organize",
        icon: Sparkles,
      },
    ],
  },
];

export type NavCounts = Partial<Record<NavBadgeKey, number>>;
