import { Suspense } from "react";
import { notFound } from "next/navigation";
import Detail from "@/components/Detail";
import { getProperty, getSettings } from "@/lib/db";

export const maxDuration = 300; // re-analyse runs from this page

async function Data({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, settings] = await Promise.all([getProperty(id), getSettings()]);
  if (!p) notFound();
  return <Detail p={p} settings={settings} />;
}

export default function Page({ params }: PageProps<"/p/[id]">) {
  return (
    <Suspense fallback={<div className="h-[80vh] animate-pulse rounded-2xl bg-line/50" />}>
      <Data params={params} />
    </Suspense>
  );
}
