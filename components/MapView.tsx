"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
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

// Tooltip text comes from listings / OpenStreetMap, so it's set as text, never HTML.
const tip = (bold: string, rest = "") => {
  const el = document.createElement("span");
  const b = document.createElement("b");
  b.textContent = bold;
  el.append(b, rest);
  return el;
};

// Plain Leaflet (no react-leaflet): Next.js keeps hidden pages alive and re-runs their effects,
// so the map is created and destroyed inside one effect and every redraw starts clean.
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
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef("");
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  });

  const from = origins(settings);
  const placed = properties.filter((p) => p.lat && p.lng);
  const key = JSON.stringify([
    placed.map((p) => [p.id, p.lat, p.lng, p.ai_score, p.status, p.price, p.bedrooms, p.address]),
    from,
    selectedId,
    routes.map((r) => [r.kind, r.mins, r.km, r.line.length]),
    places.map((p) => [p.cat, p.lat, p.lng]),
    fitTo,
  ]);

  // Create the map once per mount; remove it on unmount (or when Next.js hides the page).
  useEffect(() => {
    const home = from.find((o) => o.kind === "home")?.ll;
    const m = L.map(el.current!, { scrollWheelZoom: fitTo === "all" }).setView(home ?? [51.5072, -0.1276], 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(m);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    fitted.current = "";
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw everything when the data changes.
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: LL[] = placed.map((p) => [p.lat!, p.lng!]);

    if (fitTo === "local" && placed[0]) {
      const c: LL = [placed[0].lat!, placed[0].lng!];
      L.circle(c, { radius: 500, color: "#0f766e", weight: 1, fillOpacity: 0.05, dashArray: "4 4" }).addTo(g);
      L.circle(c, { radius: 1000, color: "#0f766e", weight: 1, fillOpacity: 0.02, dashArray: "4 4" }).addTo(g);
      pts.push([c[0] + 0.0055, c[1] + 0.009], [c[0] - 0.0055, c[1] - 0.009]); // frame ~600 m around the house
    } else {
      from.forEach((o) => pts.push(o.ll));
      routes.forEach((r) => pts.push(...r.line.filter((_, i) => i % 20 === 0)));
    }

    for (const pl of places) {
      const warn = pl.cat === "pub" || pl.cat === "takeaway" || pl.cat === "betting";
      L.marker([pl.lat, pl.lng], { icon: emojiPin(CATS[pl.cat].emoji, warn) })
        .bindTooltip(tip(pl.name, ` · ${pl.m} m`), { direction: "top", offset: [0, -10] })
        .addTo(g);
    }
    for (const r of routes) {
      L.polyline(r.line, { color: ORIGINS[r.kind].color, weight: 5, opacity: 0.8 })
        .bindTooltip(tip(ORIGINS[r.kind].name, `: ${r.mins} min · ${r.km} km`), { sticky: true })
        .addTo(g);
    }
    for (const o of from) {
      L.marker(o.ll, { icon: pin(ORIGINS[o.kind].emoji, 34, o.kind === "home" ? "#16181d" : ORIGINS[o.kind].color) })
        .bindTooltip(tip(ORIGINS[o.kind].name, ` · ${o.label}`))
        .addTo(g);
    }
    for (const p of placed) {
      const sel = p.id === selectedId;
      const bg = p.status === "rejected" ? "#9ca3af" : scoreColor(p.ai_score);
      L.marker([p.lat!, p.lng!], { icon: pin(p.ai_score != null ? String(p.ai_score) : "•", sel ? 38 : 30, bg, sel), zIndexOffset: sel ? 1000 : 0 })
        .bindTooltip(tip(gbpShort(p.price), ` · ${p.bedrooms ?? "?"} bed · ${p.address ?? p.title ?? ""}`), { direction: "top", offset: [0, -14] })
        .on("click", () => select.current?.(p.id))
        .addTo(g);
    }

    const fitKey = JSON.stringify(pts);
    if (pts.length && fitKey !== fitted.current) {
      fitted.current = fitKey;
      m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className={`overflow-hidden rounded-2xl border border-line ${className}`}>
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
