import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";
import { getProperties, getSettings } from "@/lib/db";

async function Data() {
  const [properties, settings] = await Promise.all([getProperties(), getSettings()]);
  return <Dashboard properties={properties} settings={settings} />;
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
