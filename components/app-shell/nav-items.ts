import {
  Briefcase,
  Building2,
  Car,
  Grid3x3,
  Home,
  LayoutDashboard,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "vehicles" | "properties" | "businesses";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: NavBadgeKey;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_PINNED: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Browse",
    items: [
      { label: "All Vehicles", href: "/vehicles", icon: Car },
      { label: "All Properties", href: "/properties", icon: Building2 },
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
    ],
  },
];

export type NavCounts = Partial<Record<NavBadgeKey, number>>;
