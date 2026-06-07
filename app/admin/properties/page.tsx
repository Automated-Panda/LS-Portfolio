// app/admin/properties/page.tsx
import { requireAdmin } from "@/lib/admin/guard";

import { AdminContentList } from "../content/admin-content-list";
import { fetchContent } from "../content/fetch-content";

// Properties = residences, garages, and special properties (businesses live on
// /admin/businesses). Each is a collapsible row with its upgrades editor.
export default async function AdminPropertiesPage() {
  await requireAdmin();
  const rows = await fetchContent(["residence", "garage", "special"]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Properties</h1>
      <AdminContentList rows={rows} noun="property" />
    </div>
  );
}
