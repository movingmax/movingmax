// Rangliste für das Spiel „Einmal um Europa“. Seit der Umstellung auf die längere Spieldauer unter dem Schlüssel "top-v2" (alte Liste bleibt unter "top" liegen).
// Gespeichert werden je Eintrag: frei gewählter Name, Kilometer, Datum und eine zufällige Kennung aus dem Browser.
import { getStore } from "@netlify/blobs";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOTAL = 33000, MAX_KM = TOTAL * 40, MAX_KM_PER_SEC = 75, KEEP = 200, SHOW = 20;
const BLOCK = /hitler|nazi|fick|fotze|hure|nigg|wichs|arschl|fuck|bitch|cunt/i;

// Instagram-Name: Buchstaben, Ziffern, Punkt, Unterstrich, höchstens 30 Zeichen. Gespeichert mit @ davor.
export function cleanName(raw) {
  if (typeof raw !== "string") return "";
  const h = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(h) || /^\.|\.$|\.\./.test(h) || BLOCK.test(h.replace(/[^a-z]/g, ""))) return "";
  return "@" + h;
}

// Rangfolge: nur Kilometer (das Spiel geht nach 33.000 km in die nächste Runde), bei Gleichstand der frühere Eintrag
const order = (a, b) => b.km - a.km || a.at - b.at;

// Ähnliche Schreibweisen gelten als derselbe Name: Groß/Klein, Leerzeichen, Satzzeichen, Umlaute und doppelte Buchstaben zählen nicht
export const key = (name) => String(name).toLowerCase().replace(/ß/g, "ss").normalize("NFKD").replace(/[^a-z0-9]/g, "").replace(/(.)\1+/g, "$1") || String(name).toLowerCase();

// Je Name nur der beste Eintrag
export function dedupe(list) {
  const seen = new Set();
  return list.slice().sort(order).filter((e) => { const k = key(e.name); if (seen.has(k)) return false; seen.add(k); return true; });
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
  let list = (await store.get("top-v2", { type: "json" })) || [];
  // Einmalige Sicherung des Stands vom 16.11.2026, bevor Runden und Namens-Zusammenlegung kamen (zum Zurückholen)
  if (!(await store.get("sicherung-2026-11-16"))) {
    await store.setJSON("sicherung-2026-11-16", { neu: list, alt: (await store.get("top", { type: "json" })) || [], am: Date.now() });
  }
  // Einmalig: Einträge aus der alten Liste (kurze Spieldauer) übernehmen. Kilometer bleiben, Zeiten werden verdoppelt.
  if (!(await store.get("alt-uebernommen"))) {
    const alt = (await store.get("top", { type: "json" })) || [];
    for (const a of alt) {
      if (!a || !ID.test(a.id) || typeof a.name !== "string" || !(a.km >= 1 && a.km <= TOTAL)) continue;
      const e = { id: a.id, name: a.name, km: Math.floor(a.km), secs: a.secs ? Math.round(a.secs * 2) : 0, at: a.at || 0 };
      const rival = list.find((x) => x.id === e.id);
      if (!rival) list.push(e);
      else if (order(e, rival) < 0) { rival.km = e.km; rival.secs = e.secs; rival.at = e.at; }
    }
    list.sort(order);
    list = list.slice(0, KEEP);
    await store.setJSON("top-v2", list);
    await store.set("alt-uebernommen", "1");
  }
  // Einmalig: doppelte und ähnlich geschriebene Namen zusammenlegen, der beste Wert bleibt
  if (!(await store.get("namen-bereinigt"))) {
    list = dedupe(list);
    await store.setJSON("top-v2", list);
    await store.set("namen-bereinigt", "1");
  }
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
    if (!(km >= 1 && km <= MAX_KM) || !(secs >= 3) || km / secs > MAX_KM_PER_SEC + 5 * Math.floor(km / TOTAL)) return Response.json({ error: "km" }, { status: 400 });
    const old = list.find((e) => e.id === id);
    const s = Math.round(secs);
    if (old) { old.name = name; if (km > old.km) { old.km = km; old.secs = s; old.at = Date.now(); } }
    else list.push({ id, name, km, secs: s, at: Date.now() });
    // Jeder Instagram-Name nur einmal: alte Einträge mit demselben Namen fallen weg, der beste Wert bleibt erhalten
    const mine = list.find((e) => e.id === id), k = key(name), same = list.filter((e) => key(e.name) === k);
    if (same.length > 1) {
      const top = same.slice().sort(order)[0];
      mine.km = top.km; mine.secs = top.secs; mine.at = top.at;
      list = list.filter((e) => key(e.name) !== k || e.id === id);
    }
    list.sort(order);
    list = list.slice(0, KEEP);
    await store.setJSON("top-v2", list);
  }
  return Response.json(view(list, id), { headers: { "Cache-Control": "no-store" } });
}

export default async (req) => handle(req, getStore({ name: "spiel-rangliste", consistency: "strong" }));

export const config = { path: "/api/spiel-rangliste", method: ["GET", "POST"] };
