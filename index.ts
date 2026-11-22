// supabase functions deploy send-push --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@domain), WEBHOOK_SECRET
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ok = () => new Response("ok");
Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("no", { status: 401 });
  const { table, record: r } = await req.json();
  let names: string[] = [], title = "Michat", body = "", tag = "m";
  if (table === "calls") { names = [r.callee]; title = "Incoming " + r.kind + " call"; body = r.caller; tag = "call"; }
  else if (table === "messages") {
    if (r.sender === "Mirich AI" || r.chat_name === "General") return ok();
    if (r.group_id) { const { data } = await db.from("group_members").select("member_name").eq("group_id", r.group_id); names = (data || []).map((x: any) => x.member_name).filter((n: string) => n !== r.sender); }
    else names = [r.chat_name];
    title = r.sender_name || r.sender; tag = "m-" + r.sender;
    body = !r.text || /^(e2e1|poll1|geo1|file1|gif1):/.test(r.text) ? "New message" : r.text.slice(0, 120); // never leak ciphertext
  }
  if (!names.length) return ok();
  const { data: subs } = await db.from("push_subscriptions").select("endpoint,sub").in("user_name", names);
  await Promise.allSettled((subs || []).map(async (s: any) => {
    try { await webpush.sendNotification(s.sub, JSON.stringify({ title, body, tag })); }
    catch (e: any) { if (e.statusCode === 404 || e.statusCode === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
  }));
  return ok();
});
