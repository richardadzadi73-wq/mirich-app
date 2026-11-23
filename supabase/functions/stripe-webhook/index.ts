// supabase/functions/stripe-webhook/index.ts
// Michat - Stripe webhook, idempotent via 000008 stripe_events

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("No signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (e) {
    console.error("Signature fail:", e.message);
    return new Response("Bad signature", { status: 400 });
  }

  // --- IDEMPOTENCY: 000008 ---
  // If this event id is already in stripe_events, Stripe retried it.
  // Return 200 and do NOTHING, so we never double-credit premium.
  const { error: insertErr } = await supabase
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (insertErr) {
    // 23505 = duplicate key = already processed
    if (insertErr.code === "23505") {
      console.log("Duplicate event, skipping:", event.id);
      return new Response("Already processed", { status: 200 });
    }
    console.error("stripe_events insert fail:", insertErr);
    return new Response("DB error", { status: 500 });
  }

  try {
    // --- PAYMENT SUCCESS ---
    if (
      event.type === "checkout.session.completed" ||
      event.type === "payment_intent.succeeded"
    ) {
      const obj: any =
        event.type === "checkout.session.completed"
          ? (event.data.object as Stripe.Checkout.Session)
          : (event.data.object as Stripe.PaymentIntent);

      const meta = obj.metadata || {};
      // We set these when creating the checkout session:
      // metadata: { user_name: "Kwame", user_id: "uuid" }
      const userName = meta.user_name || meta.username || null;
      const userId = meta.user_id || null;

      if (!userName && !userId) {
        console.error("No user in metadata:", event.id);
        return new Response("No user", { status: 200 });
      }

      const until = new Date();
      until.setDate(until.getDate() + 30); // 30 days premium

      let q = supabase
        .from("profiles")
        .update({
          is_premium: true,
          premium_until: until.toISOString(),
        });

      if (userId) q = q.eq("id", userId);
      else q = q.eq("name", userName);

      const { error } = await q;
      if (error) {
        console.error("Premium update fail:", error);
        return new Response("Update fail", { status: 500 });
      }

      console.log("Premium activated:", userName || userId);
    }

    // --- REFUND / CHARGEBACK ---
    // Optional: remove premium if refunded
    if (
      event.type === "charge.refunded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const obj: any = event.data.object;
      const meta = obj.metadata || {};
      const userName = meta.user_name || null;
      const userId = meta.user_id || null;
      if (userName || userId) {
        let q = supabase
          .from("profiles")
          .update({ is_premium: false, premium_until: null });
        if (userId) q = q.eq("id", userId);
        else q = q.eq("name", userName);
        await q;
      }
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("Webhook handler fail:", e);
    // IMPORTANT: We already inserted into stripe_events,
    // so a retry will be skipped. If you want retry on
    // handler failure, delete the row here:
    await supabase.from("stripe_events").delete().eq("id", event.id);
    return new Response("Handler error", { status: 500 });
  }
});