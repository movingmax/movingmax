// Rangliste für das Spiel „Einmal um Europa“.
// Gespeichert werden je Eintrag: frei gewählter Name, Kilometer, Datum und eine zufällige Kennung aus dem Browser.
import { getStore } from "@netlify/blobs";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOTAL = 33000, MAX_KM_PER_SEC = 150, KEEP = 200, SHOW = 20;
const BLOCK = /hitler|nazi|fick|fotze|hure|nigg|wichs|arschl|fuck|bitch|cunt/i;

export function cleanName(raw) {
  if (typeof raw !== "string") return "";
  const name = raw.replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
  if (name.length < 2 || BLOCK.test(name.replace(/[^a-zäöüß]/gi, ""))) return "";
  return name;
}

export function view(list, id) {
  const rank = id ? list.findIndex((e) => e.id === id) : -1;
  return {
    top: list.slice(0, SHOW).map((e) => ({ name: e.name, km: e.km, me: e.id === id })),
    rank: rank + 1,
    mine: rank >= 0 ? { name: list[rank].name, km: list[rank].km } : null,
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
    if (old) { old.name = name; if (km > old.km) { old.km = km; old.at = Date.now(); } }
    else list.push({ id, name, km, at: Date.now() });
    list.sort((a, b) => b.km - a.km || a.at - b.at);
    list = list.slice(0, KEEP);
    await store.setJSON("top", list);
  }
  return Response.json(view(list, id), { headers: { "Cache-Control": "no-store" } });
}

export default async (req) => handle(req, getStore({ name: "spiel-rangliste", consistency: "strong" }));

export const config = { path: "/api/spiel-rangliste", method: ["GET", "POST"] };
