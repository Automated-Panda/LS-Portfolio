import Link from "next/link";

const SECTIONS = [
  {
    href: "/admin/vehicles",
    title: "Vehicles",
    desc: "Edit price, availability, and vendors.",
  },
  {
    href: "/admin/properties",
    title: "Properties & Businesses",
    desc: "Edit price, capacity, and garage flag.",
  },
  {
    href: "/admin/upgrades",
    title: "Upgrades",
    desc: "Edit upgrade names, capacity, and price.",
  },
];

export default function AdminHome() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="rounded-lg border p-4 transition-colors hover:border-foreground/40"
        >
          <p className="font-medium">{s.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
        </Link>
      ))}
    </div>
  );
}
