// Zählt die Einträge im Netlify-Formular "community-ride" und gibt NUR Zahlen zurück, keine Namen oder Kontaktdaten.
// Braucht in Netlify die Umgebungsvariable NETLIFY_API_TOKEN (Personal Access Token).
const FORM = "community-ride";
const API = "https://api.netlify.com/api/v1";

export default async (req, context) => {
  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = context?.site?.id || process.env.SITE_ID;
  const headers = { "content-type": "application/json; charset=utf-8" };
  if (!token || !siteId) return new Response(JSON.stringify({ ok: false }), { status: 503, headers });
  const auth = { Authorization: "Bearer " + token };
  try {
    const forms = await (await fetch(`${API}/sites/${siteId}/forms`, { headers: auth })).json();
    const form = Array.isArray(forms) && forms.find((f) => f.name === FORM);
    const out = { ok: true, gesamt: 0, bodensee: 0, monza: 0, ganz: 0 };
    if (form) {
      for (let page = 1; page <= 20; page++) {
        const r = await fetch(`${API}/forms/${form.id}/submissions?per_page=100&page=${page}`, { headers: auth });
        const list = await r.json();
        if (!Array.isArray(list) || !list.length) break;
        for (const s of list) {
          const d = s.data || {};
          out.gesamt++;
          if (d.variante_bodensee) out.bodensee++;
          if (d.variante_monza) out.monza++;
          if (d.variante_ganze_runde) out.ganz++;
        }
        if (list.length < 100) break;
      }
    }
    return new Response(JSON.stringify(out), {
      headers: { ...headers, "Cache-Control": "public, max-age=60", "Netlify-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), { status: 502, headers });
  }
};

export const config = { path: "/api/anmeldungen" };
