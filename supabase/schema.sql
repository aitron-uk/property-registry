-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  url text unique,
  title text,
  address text,
  postcode text,
  lat double precision,
  lng double precision,
  price integer,
  size_sqft integer,
  price_per_sqft integer generated always as (
    case when size_sqft > 0 then round(price::numeric / size_sqft) end
  ) stored,
  bedrooms integer,
  bathrooms integer,
  receptions integer,
  property_type text,
  tenure text,
  parking text,
  garden text,
  nearest_station text,
  station_distance_km numeric,
  decor_state text,          -- move-in ready | light refresh | needs modernising | full renovation
  needs_kitchen boolean not null default false,
  needs_bathroom boolean not null default false,
  council_tax_band text,
  epc_rating text,
  agent text,
  listed_date date,
  image_url text,
  status text not null default 'interested',  -- interested | viewing | viewed | offer | rejected
  my_rating integer check (my_rating between 1 and 5),
  notes text,
  ai jsonb,                  -- full AI report (schools, crime, demographics, costs, verdict...)
  ai_score integer,
  nearby jsonb               -- OpenStreetMap places within 1.5 km (schools, parks, pubs...)
);
alter table properties add column if not exists nearby jsonb;

create table if not exists settings (
  id integer primary key default 1 check (id = 1),
  home_label text,
  home_lat double precision,
  home_lng double precision,
  office_label text,
  office_lat double precision,
  office_lng double precision,
  office2_label text,
  office2_lat double precision,
  office2_lng double precision,
  budget_min integer,
  budget_max integer,
  buyer_type text not null default 'standard',  -- standard | first_time | additional
  buyer_context text          -- e.g. "family with a young child, selling our current home"
);
alter table settings add column if not exists office2_label text;
alter table settings add column if not exists office2_lat double precision;
alter table settings add column if not exists office2_lng double precision;
insert into settings (id) values (1) on conflict do nothing;

-- Lock tables down: the app only talks to Supabase from the server with the service-role key.
alter table properties enable row level security;
alter table settings enable row level security;
revoke all on properties, settings from anon, authenticated;
grant all on properties, settings to service_role;
