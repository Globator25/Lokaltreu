import Link from "next/link";

export default function StaffHomePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Mitarbeiter</h1>
        <p className="text-sm text-neutral-600">Bitte waehle eine Aktion.</p>
      </header>

      <div className="grid gap-3">
        <Link
          href="/staff/stamps"
          className="rounded-md border border-neutral-200 px-4 py-3 text-sm font-medium hover:bg-neutral-50"
        >
          Stempel vergeben
        </Link>
        <Link
          href="/staff/redeem"
          className="rounded-md border border-neutral-200 px-4 py-3 text-sm font-medium hover:bg-neutral-50"
        >
          Praemie einloesen
        </Link>
      </div>
    </main>
  );
}
