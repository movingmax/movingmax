// Abstimmung für den Community Ride: zählt pro Variante, wie viele dabei wären.
// Gespeichert wird je Stimme nur eine zufällige Kennung aus dem Browser, kein Name und keine IP-Adresse.
import { getStore } from "@netlify/blobs";

const OPTIONS = ["bodensee", "monza", "ganz"];
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function counts(store) {
  const out = {};
  for (const option of OPTIONS) {
    const { blobs } = await store.list({ prefix: option + "/" });
    out[option] = blobs.length;
  }
  return out;
}

export default async (req) => {
  const store = getStore({ name: "community-ride-votes", consistency: "strong" });
  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    const id = body && typeof body.id === "string" ? body.id.toLowerCase() : "";
    if (!ID.test(id) || !Array.isArray(body.picks)) {
      return Response.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }
    for (const option of OPTIONS) {
      if (body.picks.includes(option)) await store.set(option + "/" + id, "1");
      else await store.delete(option + "/" + id);
    }
  }
  return Response.json(await counts(store), { headers: { "Cache-Control": "no-store" } });
};

export const config = { path: "/api/community-ride-votes", method: ["GET", "POST"] };
