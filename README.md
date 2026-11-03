# Property Registry

My house hunt in one place. Paste a Rightmove / Zoopla / OnTheMarket link and the app:

- reads the listing and fills in price, size, **£/sq ft**, beds, baths, parking, tenure, station distance, condition, and whether it **needs a new kitchen or bathroom**
- researches the area with OpenAI web search: **schools & Ofsted**, **crime vs national and district**, **Census community mix**, transport, flood risk, broadband, **sold prices nearby** and fair value
- works out **stamp duty**, fees, refurb estimate and the **all-in cost**
- pins it on a map with **driving routes and times from your home and office**, plus Google Maps links for train/bus
- scores it 0–100 and writes a verdict, pros, watch-outs and questions to ask the agent

Dashboard: KPIs, auto insights (best value, shortest commute, over-budget warnings…), cards or a sortable **datasheet**, filters and CSV export.

Free stack: Next.js on Vercel, Supabase Postgres, OpenStreetMap/CARTO tiles, OSRM routing, postcodes.io. Only OpenAI costs money (a few pence per listing).

## Setup (about 10 minutes)

1. **Supabase**: create a free project at [supabase.com](https://supabase.com). Open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql), run it.
   Then copy the **Project URL** and the **service_role / secret key** from Project Settings → API.
2. **OpenAI**: create an API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. **Vercel**: [vercel.com/new](https://vercel.com/new) → import `aitron-uk/property-registry` → add the environment variables from [`.env.example`](.env.example) (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `APP_PASSWORD`) → Deploy.
4. Open the app, sign in with your `APP_PASSWORD`, go to **Settings** and enter your home & office postcodes, budget and a line about yourself.

## Local dev

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

Self-check for the money maths: `node --experimental-strip-types lib/calc.test.ts`

## Notes

- Stamp duty uses England & NI rates from April 2025 (`lib/calc.ts`). Update if HMRC changes them.
- Refurb fallbacks are rough national averages; the AI's itemised estimate is used when available.
- Routing uses the public OSRM demo server (driving only, fair use).
- The service-role key is only used on the server. Tables have row-level security on with no policies, so the public anon key can't read them.
