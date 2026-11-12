// Holt die gefahrenen Kilometer der Europaumrundung von Strava und merkt sie sich 30 Minuten.
// Einmalig verbinden: movingmax.cc/api/strava-verbinden aufrufen (nur das Konto STRAVA_ATHLETE_ID wird angenommen).
// Nötige Umgebungsvariablen bei Netlify: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.
// Optional: STRAVA_ATHLETE_ID, TOUR_START (JJJJ-MM-TT), STRAVA_OFFSET_KM (Korrektur, falls Strava abweicht).
import { getStore } from "@netlify/blobs";

const MAX_AGE = 30 * 60 * 1000;
const RIDES = new Set(["Ride", "GravelRide", "MountainBikeRide", "EBikeRide"]);
const env = (k, d) => (globalThis.Netlify && Netlify.env.get(k)) || process.env[k] || d;

export function sumRides(list) {
  let m = 0, hm = 0, n = 0, last = null;
  for (const a of list) {
    if (!RIDES.has(a.sport_type || a.type)) continue;
    m += a.distance || 0; hm += a.total_elevation_gain || 0; n++;
    if (!last || a.start_date > last) last = a.start_date;
  }
  return { km: Math.round(m / 1000), hm: Math.round(hm), rides: n, last };
}

async function token(body) {
  const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: env("STRAVA_CLIENT_ID"), client_secret: env("STRAVA_CLIENT_SECRET"), ...body }) });
  if (!r.ok) throw new Error("token " + r.status);
  return r.json();
}

async function refresh(store) {
  const saved = await store.get("token", { type: "json" });
  if (!saved) return null;
  const t = await token({ grant_type: "refresh_token", refresh_token: saved.refresh_token });
  if (t.refresh_token !== saved.refresh_token) await store.setJSON("token", { refresh_token: t.refresh_token });
  const after = Math.floor(Date.parse(env("TOUR_START", "2026-06-21") + "T00:00:00Z") / 1000);
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`, { headers: { Authorization: "Bearer " + t.access_token } });
    if (!r.ok) throw new Error("activities " + r.status);
    const part = await r.json(); all.push(...part);
    if (part.length < 200) break;
  }
  const s = sumRides(all);
  s.km += Number(env("STRAVA_OFFSET_KM", "0")) || 0;
  const data = { ...s, at: Date.now() };
  await store.setJSON("km", data);
  return data;
}

const out = (data) => Response.json(data ? { km: data.km, hm: data.hm, last: data.last, at: data.at } : { km: null }, { headers: { "Cache-Control": "public, max-age=600", "Netlify-CDN-Cache-Control": "public, s-maxage=900" } });

export default async (req) => {
  const url = new URL(req.url), store = getStore({ name: "strava", consistency: "strong" });
  if (url.pathname.endsWith("/strava-verbinden")) {
    if (!env("STRAVA_CLIENT_ID") || !env("STRAVA_CLIENT_SECRET")) return new Response("STRAVA_CLIENT_ID und STRAVA_CLIENT_SECRET fehlen noch in Netlify.", { status: 500 });
    const code = url.searchParams.get("code"), back = url.origin + "/api/strava-verbinden";
    if (!code) return Response.redirect("https://www.strava.com/oauth/authorize?client_id=" + env("STRAVA_CLIENT_ID") + "&response_type=code&approval_prompt=auto&scope=activity:read&redirect_uri=" + encodeURIComponent(back), 302);
    try {
      const t = await token({ grant_type: "authorization_code", code });
      if (String(t.athlete && t.athlete.id) !== String(env("STRAVA_ATHLETE_ID", "136572386"))) return new Response("Das ist nicht das Strava-Konto von Max. Nichts gespeichert.", { status: 403 });
      await store.setJSON("token", { refresh_token: t.refresh_token });
      const data = await refresh(store);
      return new Response("Strava ist verbunden. Aktuell: " + data.km + " km aus " + data.rides + " Fahrten seit Tourstart.", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    } catch (e) { return new Response("Verbinden hat nicht geklappt: " + e.message, { status: 502 }); }
  }
  let data = await store.get("km", { type: "json" });
  if (!data || Date.now() - data.at > MAX_AGE) { try { data = (await refresh(store)) || data; } catch (e) { /* alter Stand bleibt */ } }
  return out(data);
};

export const config = { path: ["/api/strava-km", "/api/strava-verbinden"] };
