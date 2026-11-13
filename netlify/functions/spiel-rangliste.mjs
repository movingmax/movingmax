// Rangliste für das Spiel „Einmal um Europa“.
// Gespeichert werden je Eintrag: frei gewählter Name, Kilometer, Datum und eine zufällige Kennung aus dem Browser.
import { getStore } from "@netlify/blobs";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOTAL = 33000, MAX_KM_PER_SEC = 150, KEEP = 200, SHOW = 20;
const BLOCK = /hitler|nazi|fick|fotze|hure|nigg|wichs|arschl|fuck|bitch|cunt/i;

// Instagram-Name: Buchstaben, Ziffern, Punkt, Unterstrich, höchstens 30 Zeichen. Gespeichert mit @ davor.
export function cleanName(raw) {
  if (typeof raw !== "string") return "";
  const h = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(h) || /^\.|\.$|\.\./.test(h) || BLOCK.test(h.replace(/[^a-z]/g, ""))) return "";
  return "@" + h;
}

const done = (e) => e.km >= TOTAL;
const order = (a, b) => b.km - a.km || (done(a) && done(b) ? (a.secs || 1e9) - (b.secs || 1e9) : 0) || a.at - b.at;

export function view(list, id) {
  const rank = id ? list.findIndex((e) => e.id === id) : -1;
  return {
    top: list.slice(0, SHOW).map((e) => ({ name: e.name, km: e.km, secs: done(e) ? e.secs || null : null, me: e.id === id })),
    rank: rank + 1,
    mine: rank >= 0 ? { name: list[rank].name, km: list[rank].km, secs: done(list[rank]) ? list[rank].secs || null : null } : null,
    total: list.length,
  };
}

export async function handle(req, store) {
  const url = new URL(req.url);
  let list = (await store.get("top", { type: "json" })) || [];
  let id = (url.searchParams.get("id") || "").toLowerCase();
  if (!ID.test(id)) id = "";
  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    id = body && typeof body.id === "string" ? body.id.toLowerCase() : "";
    const name = cleanName(body && body.name);
    const km = body ? Math.floor(Number(body.km)) : NaN;
    const secs = body ? Number(body.secs) : NaN;
    if (!ID.test(id)) return Response.json({ error: "id" }, { status: 400 });
    if (!name) return Response.json({ error: "name" }, { status: 400 });
    if (!(km >= 1 && km <= TOTAL) || !(secs >= 3) || km / secs > MAX_KM_PER_SEC) return Response.json({ error: "km" }, { status: 400 });
    const old = list.find((e) => e.id === id);
    const s = Math.round(secs);
    if (old) { old.name = name; if (km > old.km || (km >= TOTAL && old.km >= TOTAL && s < (old.secs || 1e9))) { old.km = km; old.secs = s; old.at = Date.now(); } }
    else list.push({ id, name, km, secs: s, at: Date.now() });
    // Jeder Instagram-Name nur einmal: alte Einträge mit demselben Namen fallen weg, der beste Wert bleibt erhalten
    const mine = list.find((e) => e.id === id), same = list.filter((e) => e.name === name);
    if (same.length > 1) {
      const top = same.slice().sort(order)[0];
      mine.km = top.km; mine.secs = top.secs; mine.at = top.at;
      list = list.filter((e) => e.name !== name || e.id === id);
    }
    list.sort(order);
    list = list.slice(0, KEEP);
    await store.setJSON("top", list);
  }
  return Response.json(view(list, id), { headers: { "Cache-Control": "no-store" } });
}

export default async (req) => handle(req, getStore({ name: "spiel-rangliste", consistency: "strong" }));

export const config = { path: "/api/spiel-rangliste", method: ["GET", "POST"] };
