# Operations checklist
- **Environments:** create a separate Supabase *staging* project; point `config.js` at it for dev. Never test migrations on production first.
- **Backups:** Supabase Pro → daily backups + point-in-time recovery. Test a restore quarterly.
- **Uptime:** add BetterStack/UptimeRobot checks on the site URL and the Supabase REST URL; publish a status page.
- **Errors:** client errors land in `client_errors`; review weekly (or wire Sentry).
- **Secrets:** Stripe/service-role keys only in Edge Function secrets, never in the client. Rotate if leaked.
- **Rate limits:** DB trigger caps 30 messages/min/user; enable Supabase Auth rate limits + CAPTCHA for sign-up.
- **Stores:** `npm i @capacitor/core @capacitor/cli`, `npx cap add ios|android` (uses capacitor.config.json). Apple/Google require report/block, account deletion and a privacy policy URL — all included.
