// supabase functions deploy ai-chat
// Secrets: ANTHROPIC_API_KEY, optional AI_MODEL (default claude-sonnet-5-5)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const J = (o: unknown, s = 200) => new Response(
  JSON.stringify(o),
  { status: s, headers: { ...cors, "Content-Type": "application/json" } }
);

const SYS: Record<string, string> = {
  chat: "You are Mirich AI, the friendly assistant inside the Michat messaging app. Be concise (under 120 words), warm and accurate. Reply in the user's language.",
  summarize: "Summarize this chat conversation in 4-6 short bullet points. Mention decisions, questions and tasks. Use the requested language.",
  translate: "Translate the user's text into the requested language. Output only the translation.",
  ui: "The user message is a JSON array of short app-interface strings. Translate each into the target language, keep emojis, symbols and arrows, and return ONLY a JSON array of the same length and order.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
  );

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return J({ error: "auth" }, 401);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let b: any;
  try { b = await req.json(); } catch { return J({ error: "invalid_json" }, 400); }
  if (!b || typeof b !== "object" || Array.isArray(b)) return J({ error: "invalid_body" }, 400);

  const { data: p, error: profileError } = await db
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return J({ error: "profile_lookup_failed" }, 503);

  const dailyLimit = p?.is_premium ? 300 : 30;

  const { data: allowed, error: quotaError } = await db.rpc(
    "consume_ai_quota",
    { p_user_id: user.id, p_daily_limit: dailyLimit }
  );
  if (quotaError) return J({ error: "quota_check_failed" }, 503);
  if (!allowed) return J({ reply: "Daily AI limit reached — try again tomorrow or go Premium 👑" });

  const mode = SYS[b.mode] ? b.mode : "chat";
  if (mode === "chat" && b.messages != null && !Array.isArray(b.messages)) return J({ error: "invalid_messages" }, 400);
  if (mode === "chat" && Array.isArray(b.messages) && b.messages.length > 100) return J({ error: "too_many_messages" }, 400);

  let msgs: { role: string; content: string }[] = mode === "chat"
    ? (b.messages || []).slice(-12).map((m: any) => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: String(m?.text || "").slice(0, 2000)
      })).filter((m: any) => m.content)
    : [{ role: "user", content: String(b.text || "").slice(0, 12000) }];

  msgs = msgs.reduce((a: any[], m) => {
    if (a.length && a[a.length - 1].role === m.role) a[a.length - 1].content += "\n" + m.content;
    else a.push(m);
    return a;
  }, []);

  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) return J({ reply: null });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: Deno.env.get("AI_MODEL") || "claude-sonnet-5-5",
      max_tokens: mode === "ui" ? 4000 : 600,
      system: SYS[mode] + (b.lang ? " Language/target: " + String(b.lang).slice(0, 20) + "." : ""),
      messages: msgs
    })
  });

  if (!r.ok) return J({ reply: null }, 502);
  const d = await r.json();
  return J({ reply: d.content?.map((c: any) => c.text || "").join("") || null });
});