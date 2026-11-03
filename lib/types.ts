export type Report = {
  summary: string;
  pros: string[];
  cons: string[];
  verify: string[];
  schools: {
    name: string;
    phase: string; // nursery | primary | secondary | all-through | sixth form
    type: string; // community, academy, faith, independent...
    distance_m: number | null;
    rating: string; // latest Ofsted
    last_inspected: string;
    history: { year: string; rating: string }[];
    catchment: string;
    notes: string;
  }[];
  family: { summary: string; childcare: string; play_and_parks: string };
  places: { name: string; kind: string; distance_m: number | null; notes: string }[];
  red_flags: { title: string; severity: "high" | "medium" | "low"; detail: string }[];
  risks: { area: string; level: "low" | "medium" | "high"; assessment: string }[];
  sale: { method: string; extra_fees: number | null; fee_notes: string };
  construction: { type: string; standard: boolean; mortgage_notes: string };
  discrepancies: string[];
  action_plan: string[];
  crime: {
    local_rate: number | null;
    national_rate: number | null;
    district_rate: number | null;
    unit: string;
    assessment: string;
  };
  demographics: { groups: { label: string; percent: number }[]; notes: string };
  transport: { name: string; kind: string; distance_km: number | null; notes: string }[];
  amenities: string[];
  flood_risk: string;
  broadband: string;
  value: {
    comparables: { address: string; price: number | null; date: string; notes: string }[];
    fair_value_low: number | null;
    fair_value_high: number | null;
    assessment: string;
  };
  refurb: { items: { item: string; low: number; high: number }[]; notes: string };
  questions_for_agent: string[];
  scores: { location: number; value: number; condition: number; transport: number; schools: number; safety: number; family?: number };
  verdict: string;
  sources: { title: string; url: string }[];
  images?: string[];
  analysed_at?: string;
};

export type Property = {
  id: string;
  created_at: string;
  url: string | null;
  title: string | null;
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  price: number | null;
  size_sqft: number | null;
  price_per_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  receptions: number | null;
  property_type: string | null;
  tenure: string | null;
  parking: string | null;
  garden: string | null;
  nearest_station: string | null;
  station_distance_km: number | null;
  decor_state: string | null;
  needs_kitchen: boolean;
  needs_bathroom: boolean;
  council_tax_band: string | null;
  epc_rating: string | null;
  agent: string | null;
  listed_date: string | null;
  image_url: string | null;
  status: string;
  my_rating: number | null;
  notes: string | null;
  ai: Report | null;
  ai_score: number | null;
  nearby: Nearby | null;
};

export type Place = {
  cat:
    | "school" | "nursery" | "playground" | "park" | "gp" | "pharmacy" | "dentist" | "library" | "leisure"
    | "supermarket" | "station" | "bus" | "pub" | "takeaway" | "betting";
  name: string;
  lat: number;
  lng: number;
  m: number;
};
export type Nearby = { places: Place[]; fetched_at: string };

export type Settings = {
  id: 1;
  home_label: string | null;
  home_lat: number | null;
  home_lng: number | null;
  office_label: string | null;
  office_lat: number | null;
  office_lng: number | null;
  budget_min: number | null;
  budget_max: number | null;
  buyer_type: "standard" | "first_time" | "additional";
  buyer_context: string | null;
};

export const STATUSES = ["interested", "viewing", "viewed", "offer", "rejected"] as const;
export const DECOR = ["move-in ready", "light refresh", "needs modernising", "full renovation"] as const;
export const PARKING = ["none", "on-street", "permit", "allocated", "driveway", "garage"] as const;
