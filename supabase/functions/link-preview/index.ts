// supabase functions deploy link-preview   (needs a logged-in user; fetches https pages only, blocks private IPs and redirects)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const J = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...cors, "Content-Type": "application/json" } });
const priv = (ip: string) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip);
const meta = (h: string, k: string) => { const m = h.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i")) || h.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, "i")); return m ? m[1] : ""; };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  if (!(await sb.auth.getUser()).data.user) return J({});
  try {
    const u = new URL((await req.json()).url);
    if (u.protocol !== "https:" || (u.port && u.port !== "443") || /^(localhost|.*\.(local|internal))$/i.test(u.hostname) || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(":")) return J({});
    const ips = await Deno.resolveDns(u.hostname, "A"); if (!ips.length || ips.some(priv)) return J({});
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(u, { signal: ctl.signal, redirect: "error", headers: { "user-agent": "MichatBot/1.0", accept: "text/html" } });
    if (!(r.headers.get("content-type") || "").includes("text/html")) return J({});
    const h = (await r.text()).slice(0, 200000);
    const title = meta(h, "og:title") || (h.match(/<title[^>]*>([^<]*)/i) || [])[1] || "";
    return J({ title: title.trim().slice(0, 120), desc: (meta(h, "og:description") || meta(h, "description")).slice(0, 200), image: meta(h, "og:image"), site: meta(h, "og:site_name") || u.hostname });
  } catch { return J({}); }
});