import {
  Building2,
  Car,
  Grid3x3,
  LayoutDashboard,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "vehicles" | "properties";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: NavBadgeKey;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "All Vehicles", href: "/vehicles", icon: Car },
  {
    label: "My Vehicles",
    href: "/my-vehicles",
    icon: Warehouse,
    badgeKey: "vehicles",
  },
  {
    label: "My Properties",
    href: "/my-properties",
    icon: Building2,
    badgeKey: "properties",
  },
  { label: "Visual Garage", href: "/garage", icon: Grid3x3 },
];

export type NavCounts = Partial<Record<NavBadgeKey, number>>;
