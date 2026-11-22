// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (SUPABASE_URL / SERVICE_ROLE are provided). Stripe event: checkout.session.completed
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature")!;
  let ev;
  try { ev = await stripe.webhooks.constructEventAsync(await req.text(), sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!); }
  catch { return new Response("bad signature", { status: 400 }); }
  if (ev.type === "checkout.session.completed") {
    const id = (ev.data.object as any).client_reference_id; // = profile id, added by the app
    if (id) {
      const { data } = await db.from("profiles").select("premium_until").eq("id", id).single();
      const base = Math.max(Date.now(), data?.premium_until ? new Date(data.premium_until).getTime() : 0);
      await db.from("profiles").update({ is_premium: true, premium_until: new Date(base + ((ev.data.object as any).amount_total >= 2000 ? 365 : 30) * 864e5).toISOString() }).eq("id", id);
    }
  }
  return new Response("ok");
});
