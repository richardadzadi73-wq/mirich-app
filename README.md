# Michat 2.1

Michat is a static Progressive Web App backed by Supabase. There is no frontend build step.

## Run locally

```sh
npm install
npm start
```

Open the local URL printed by the server. Configure the Supabase URL and anon key in `config.js` before using backend features.

## Database setup and upgrades

For a fresh project, apply the numbered files in `supabase/migrations/` in order (000001 through 000006), or use the Supabase CLI migration workflow. For an existing project already on v5, apply **only** `supabase/migrations/20260101000006_hardening.sql` (also copied as `supabase-v6.sql` for manual SQL Editor use).

Always apply and verify migrations on a staging project first. Do not rerun older migrations against a live database unless you have reviewed their effects.

## Edge Functions

Deploy the functions under `supabase/functions/` with the Supabase CLI. Keep service-role keys, Anthropic keys, Stripe secrets and VAPID private keys in Supabase Function Secrets; never put them in `config.js` or browser code.

The AI function requires the v6 `consume_ai_quota` database function. Its daily quota reservation is atomic. Post likes use the v6 `toggle_post_like` RPC; do not restore direct client updates to `posts.likes`.

## Checks

```sh
npm test
npm run doctor
```

The smoke test checks JavaScript syntax, required feature functions and script loading. It does not prove database policies, encryption behavior, payment flows, or real-time calls are correct. Follow `STAGING_TEST_PLAN.md` and `tests/rls-test.sql` with real staging accounts before launch.

## Known limitations

- End-to-end encryption coverage is limited to the cases documented in `SECURITY_REVIEW.md`; it is not a guarantee that all app content is end-to-end encrypted.
- Key material is stored in browser local storage, so an XSS vulnerability could expose it.
- Static ECDH does not provide forward secrecy or automatic key rotation.
- TURN, push, payment provider, and production legal configuration require operator setup.
- The client smoke test does not validate live Supabase RLS, Edge Function secrets, or external provider configuration.
