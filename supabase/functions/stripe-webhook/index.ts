// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Event: checkout.session.completed

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(
  Deno.env.get("STRIPE_SECRET_KEY")!,
  { apiVersion: "2024-06-20" }
);
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("no signature", { status: 400 });

  let ev: any;
  try {
    ev = await stripe.webhooks.constructEventAsync(
      await req.text(),
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  // Idempotency: if we already saw this
  // event id, do nothing, return ok.
  // Stripe retries with same id.
  const { data: seen } = await db
    .from("stripe_events")
    .select("id")
    .eq("id", ev.id)
    .maybeSingle();

  if (seen) return new Response("ok - duplicate");

  // Claim this event first, so a
  // concurrent retry can't double-credit.
  const { error: claimErr } = await db
    .from("stripe_events")
    .insert({ id: ev.id, type: ev.type });

  if (claimErr) return new Response("ok - duplicate");

  if (ev.type === "checkout.session.completed") {
    const session = ev.data.object;

    // Only paid sessions grant Premium.
    if (session.payment_status !== "paid") {
      return new Response("ok - not paid");
    }

    const id = session.client_reference_id;
    if (!id) return new Response("no profile id", { status: 400 });

    const { data, error } = await db
      .from("profiles")
      .select("premium_until")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return new Response("profile not found", { status: 404 });
    }

    const base = Math.max(
      Date.now(),
      data.premium_until
        ? new Date(data.premium_until).getTime()
        : 0
    );

    // amount_total is in cents.
    // >= $20 = yearly, else monthly.
    const days = session.amount_total >= 2000 ? 365 : 30;

    await db.from("profiles").update({
      is_premium: true,
      premium_until: new Date(
        base + days * 864e5
      ).toISOString(),
    }).eq("id", id);
  }

  return new Response("ok");
});