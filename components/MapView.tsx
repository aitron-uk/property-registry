"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Place, Property, Settings } from "@/lib/types";
import { CATS } from "@/lib/places";
import { gbpShort, origins, ORIGINS, type Kind } from "@/lib/calc";
import { scoreColor } from "./ui";

type LL = [number, number];
export type Route = { line: LL[]; mins: number; km: number; kind: Kind };

const pin = (html: string, size: number, bg: string, ring = false) =>
  L.divIcon({
    className: "",
    html: `<div class="pin" style="width:${size}px;height:${size}px;background:${bg};${ring ? "box-shadow:0 0 0 4px rgba(15,118,110,.35),0 4px 10px rgba(0,0,0,.3)" : ""}">${html}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const emojiPin = (emoji: string, warn: boolean) =>
  L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;border-radius:9999px;display:grid;place-items:center;font-size:13px;background:${warn ? "#fee2e2" : "#fff"};border:1px solid ${warn ? "#fca5a5" : "#e6e4de"};box-shadow:0 1px 3px rgba(0,0,0,.2)">${emoji}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

function Fit({ points }: { points: LL[] }) {
  const map = useMap();
  const key = points.map((p) => p.join()).join("|");
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export default function MapView({
  properties,
  settings,
  selectedId,
  onSelect,
  routes = [],
  className = "h-[520px]",
  fitTo,
  places = [],
}: {
  properties: Property[];
  settings: Settings | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  routes?: Route[];
  className?: string;
  fitTo?: "all" | "selected" | "local";
  places?: Place[];
}) {
  const from = origins(settings);
  const home = from.find((o) => o.kind === "home")?.ll ?? null;
  const placed = properties.filter((p) => p.lat && p.lng);

  const pts: LL[] = placed.map((p) => [p.lat!, p.lng!]);
  if (fitTo === "local") {
    // Neighbourhood view: frame roughly a 600 m walk around the property.
    const [lat, lng] = pts[0] ?? [0, 0];
    pts.push([lat + 0.0055, lng + 0.009], [lat - 0.0055, lng - 0.009]);
  } else {
    from.forEach((o) => pts.push(o.ll));
    routes.forEach((r) => pts.push(...r.line.filter((_, i) => i % 20 === 0)));
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-line ${className}`}>
      <MapContainer center={home ?? [51.5072, -0.1276]} zoom={10} className="h-full w-full" scrollWheelZoom={fitTo === "all"}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Fit points={pts} />
        {fitTo === "local" && placed[0] && (
          <>
            <Circle center={[placed[0].lat!, placed[0].lng!]} radius={500} pathOptions={{ color: "#0f766e", weight: 1, fillOpacity: 0.05, dashArray: "4 4" }} />
            <Circle center={[placed[0].lat!, placed[0].lng!]} radius={1000} pathOptions={{ color: "#0f766e", weight: 1, fillOpacity: 0.02, dashArray: "4 4" }} />
          </>
        )}
        {places.map((pl, i) => (
          <Marker key={i} position={[pl.lat, pl.lng]} icon={emojiPin(CATS[pl.cat].emoji, pl.cat === "pub" || pl.cat === "takeaway" || pl.cat === "betting")}>
            <Tooltip direction="top" offset={[0, -10]}>
              {CATS[pl.cat].emoji} <b>{pl.name}</b> · {pl.m} m
            </Tooltip>
          </Marker>
        ))}
        {routes.map((r) => (
          <Polyline
            key={r.kind}
            positions={r.line}
            pathOptions={{ color: ORIGINS[r.kind].color, weight: 5, opacity: 0.8 }}
          >
            <Tooltip sticky>
              {ORIGINS[r.kind].name}: {r.mins} min · {r.km} km
            </Tooltip>
          </Polyline>
        ))}
        {from.map((o) => (
          <Marker key={o.kind} position={o.ll} icon={pin(ORIGINS[o.kind].emoji, 34, o.kind === "home" ? "#16181d" : ORIGINS[o.kind].color)}>
            <Tooltip>
              {ORIGINS[o.kind].name} · {o.label}
            </Tooltip>
          </Marker>
        ))}
        {placed.map((p) => {
          const sel = p.id === selectedId;
          const dim = p.status === "rejected";
          return (
            <Marker
              key={p.id}
              position={[p.lat!, p.lng!]}
              icon={pin(p.ai_score != null ? String(p.ai_score) : "•", sel ? 38 : 30, dim ? "#9ca3af" : scoreColor(p.ai_score), sel)}
              zIndexOffset={sel ? 1000 : 0}
              eventHandlers={{ click: () => onSelect?.(p.id) }}
            >
              <Tooltip direction="top" offset={[0, -14]}>
                <b>{gbpShort(p.price)}</b> · {p.bedrooms ?? "?"} bed · {p.address ?? p.title}
              </Tooltip>
              {!onSelect && (
                <Popup>
                  <b>{p.title}</b>
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
