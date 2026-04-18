import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your GTA V portfolio at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vehicles owned</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Coming in Phase 5.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Properties</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Coming in Phase 4.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Garage capacity</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Coming in Phase 6.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unassigned</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Coming in Phase 6.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
