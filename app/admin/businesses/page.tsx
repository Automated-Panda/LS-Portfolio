// app/admin/businesses/page.tsx
import { requireAdmin } from "@/lib/admin/guard";

import { AdminContentList } from "../content/admin-content-list";
import { fetchContent } from "../content/fetch-content";

// Businesses = property_type 'business' (nightclubs, bunkers, yachts, CEO
// offices, …). Same collapsible + upgrades editor as Properties.
export default async function AdminBusinessesPage() {
  await requireAdmin();
  const rows = await fetchContent(["business"]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Businesses</h1>
      <AdminContentList rows={rows} noun="business" />
    </div>
  );
}
