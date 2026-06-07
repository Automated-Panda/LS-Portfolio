// app/admin/upgrades/page.tsx
// Upgrades are now managed inline on each property/business (Content section).
// Keep this route as a redirect so old links/bookmarks don't 404.
import { redirect } from "next/navigation";

export default function AdminUpgradesPage() {
  redirect("/admin/properties");
}
