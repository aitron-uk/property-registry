// Free OSRM demo server (driving only, fair-use). ponytail: swap for a self-hosted OSRM / paid API if it rate-limits.
const OSRM = "https://router.project-osrm.org";
type LL = [number, number];
const c = (p: LL) => `${p[1]},${p[0]}`;

export type Drive = { mins: number; km: number };

/** Drive time from each origin to every destination, in one request. */
export async function driveTable(origins: LL[], dests: LL[]): Promise<(Drive | null)[][]> {
  if (!origins.length || !dests.length) return [];
  const coords = [...origins, ...dests].map(c).join(";");
  const src = origins.map((_, i) => i).join(";");
  const dst = dests.map((_, i) => i + origins.length).join(";");
  const r = await fetch(`${OSRM}/table/v1/driving/${coords}?sources=${src}&destinations=${dst}&annotations=duration,distance`).then((r) => r.json());
  return origins.map((_, i) =>
    dests.map((_, j) => {
      const d = r.durations?.[i]?.[j];
      return d == null ? null : { mins: Math.round(d / 60), km: Math.round(r.distances[i][j] / 100) / 10 };
    }),
  );
}

export async function driveRoute(from: LL, to: LL): Promise<{ line: LL[]; mins: number; km: number } | null> {
  const r = await fetch(`${OSRM}/route/v1/driving/${c(from)};${c(to)}?overview=full&geometries=geojson`).then((r) => r.json());
  const route = r.routes?.[0];
  if (!route) return null;
  return {
    line: route.geometry.coordinates.map(([lng, lat]: LL) => [lat, lng]),
    mins: Math.round(route.duration / 60),
    km: Math.round(route.distance / 100) / 10,
  };
}
