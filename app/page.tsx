import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";
import { dbErrorHelp, getProperties, getSettings } from "@/lib/db";

async function Data() {
  const data = await Promise.all([getProperties(), getSettings()]).catch((e: unknown) => dbErrorHelp(e));
  if (typeof data === "string")
    return (
      <div className="card mx-auto max-w-2xl space-y-2 border-red-200 p-6">
        <h1 className="h2 text-bad">The database isn&apos;t ready</h1>
        <p className="text-sm">{data}</p>
      </div>
    );
  return <Dashboard properties={data[0]} settings={data[1]} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Data />
    </Suspense>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="h-24 animate-pulse rounded-2xl bg-line/50" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-line/50" />
        ))}
      </div>
      <div className="h-[520px] animate-pulse rounded-2xl bg-line/50" />
    </div>
  );
}
