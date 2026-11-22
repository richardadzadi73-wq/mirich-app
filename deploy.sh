#!/usr/bin/env bash
# One-command backend deploy: ./scripts/deploy.sh   (needs the Supabase CLI: npm i -g supabase, and `supabase login`)
set -euo pipefail
[ -f .env ] && set -a && . ./.env && set +a
: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF in .env}"
if [ "${ENV:-staging}" = "production" ] && [ "${CONFIRM_PROD:-}" != "yes" ]; then
  echo "Production deploy: re-run with CONFIRM_PROD=yes after the staging test plan passes."; exit 1; fi
supabase link --project-ref "$SUPABASE_PROJECT_REF"
echo "→ database migrations (setup, security, v3, v4)"; supabase db push
S=(); for k in ANTHROPIC_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT WEBHOOK_SECRET; do
  [ -n "${!k:-}" ] && S+=("$k=${!k}") || echo "⚠️  $k not set — related feature will stay off"; done
[ ${#S[@]} -gt 0 ] && supabase secrets set "${S[@]}"
for f in ai-chat link-preview link-device; do supabase functions deploy $f; done
for f in send-push stripe-webhook; do supabase functions deploy $f --no-verify-jwt; done
cat <<MSG

✅ Backend deployed. Still manual (dashboard):
  1. Database → Webhooks: on INSERT of public.messages AND public.calls → Edge Function send-push, header x-webhook-secret: \$WEBHOOK_SECRET
  2. Stripe → Webhooks → https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/stripe-webhook  (event checkout.session.completed)
  3. Edit config.js (url, key, paymentUrl, iceServers, vapidPublicKey, giphyKey, privateCalls:true), then run: npm run doctor
MSG
