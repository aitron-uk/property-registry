// Run: node --experimental-strip-types lib/calc.test.ts
import assert from "node:assert/strict";
import { stampDuty, haversineKm, median, refurbEstimate } from "./calc.ts";

assert.equal(stampDuty(350_000), 7_500); // matches the Colgate Close example
assert.equal(stampDuty(125_000), 0);
assert.equal(stampDuty(300_000, "first_time"), 0);
assert.equal(stampDuty(400_000, "first_time"), 5_000);
assert.equal(stampDuty(600_000, "first_time"), 20_000); // over £500k: no relief
assert.equal(stampDuty(350_000, "additional"), 7_500 + 17_500);
assert.ok(Math.abs(haversineKm([51.5074, -0.1278], [51.1259, -0.2052]) - 42.7) < 1);
assert.equal(median([3, 1, 2]), 2);
assert.equal(median([4, 1, 2, 3]), 2.5);
const base = { needs_kitchen: false, needs_bathroom: false, decor_state: null, ai: null };
assert.equal(refurbEstimate({ ...base, needs_kitchen: true, decor_state: "light refresh" }), 22_000);
const ai = { refurb: { items: [{ item: "Redecoration", low: 2000, high: 4000 }], notes: "" } } as never;
assert.equal(refurbEstimate({ ...base, ai }), 3_000);
assert.equal(refurbEstimate({ ...base, ai, needs_kitchen: true }), 21_000); // tick adds kitchen the AI missed
const aiK = { refurb: { items: [{ item: "New kitchen", low: 10000, high: 20000 }], notes: "" } } as never;
assert.equal(refurbEstimate({ ...base, ai: aiK, needs_kitchen: true }), 15_000); // no double count
console.log("calc ok");

import { parseFact } from "./calc.ts";
assert.deepEqual(parseFact("size_sqft", "990"), { value: 990 });
assert.deepEqual(parseFact("size_sqft", "990 sq ft"), { value: 990 });
assert.deepEqual(parseFact("size_sqft", "1,050 ft²"), { value: 1050 });
assert.deepEqual(parseFact("size_sqft", "56 sq m"), { value: 603 });
assert.deepEqual(parseFact("size_sqft", "92m²"), { value: 990 });
assert.deepEqual(parseFact("receptions", "2"), { value: 2 });
assert.deepEqual(parseFact("station_distance_km", "1.3 km"), { value: 1.3 });
assert.deepEqual(parseFact("listed_date", "15/10/2026"), { value: "2026-10-15" });
assert.deepEqual(parseFact("listed_date", "2026-10-15"), { value: "2026-10-15" });
assert.ok("error" in parseFact("listed_date", "last week"));
assert.ok("error" in parseFact("bedrooms", "three"));
assert.deepEqual(parseFact("epc_rating", " C "), { value: "C" });
assert.deepEqual(parseFact("size_sqft", ""), { value: null });
console.log("parseFact ok");

import { photoLinks } from "./calc.ts";
assert.deepEqual(photoLinks("https://lid.zoocdn.com/u/1024/768/a.jpg:p\n\n https://lid.zoocdn.com/u/1024/768/b.jpg:p, https://lid.zoocdn.com/u/1024/768/a.jpg:p"), [
  "https://lid.zoocdn.com/u/1024/768/a.jpg:p",
  "https://lid.zoocdn.com/u/1024/768/b.jpg:p",
]);
assert.deepEqual(photoLinks("nothing here"), []);
console.log("photoLinks ok");

import { areaOf } from "./calc.ts";
assert.equal(areaOf("20 Colgate Close, Crawley, RH11 0AZ", "RH11 0AZ"), "Crawley · RH11");
assert.equal(areaOf("Colgate Close, Crawley RH11 0AZ", null), "Crawley · RH11");
assert.equal(areaOf("Flat 2, 10 High St, Sutton, Surrey", "sm1 1aa"), "Surrey · SM1");
assert.equal(areaOf("Colgate Close", null), null);
assert.equal(areaOf(null, "CR7 8AA"), "CR7");
console.log("areaOf ok");
