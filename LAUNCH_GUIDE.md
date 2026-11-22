# Launch guide — things only you can do (accounts, legal, stores)

## 1. Accounts (≈1 hour)
| Service | Why | Steps |
|---|---|---|
| Supabase (Pro) | database, auth, storage, functions | create **staging** + **production** projects; run `supabase-setup.sql` → `supabase-security.sql` → `supabase-v3.sql` → `supabase-v4.sql` |
| Anthropic API | Mirich AI, summaries, translation, interface translation | console.anthropic.com → API key → `supabase secrets set ANTHROPIC_API_KEY=…` → `supabase functions deploy ai-chat` |
| Stripe | Premium payments | create product ($2.99/month) → Payment Link (enable adaptive/local currencies) → paste in `config.js` `paymentUrl` → `supabase functions deploy stripe-webhook --no-verify-jwt` + secrets + webhook for `checkout.session.completed` |
| TURN server | calls on mobile/strict networks | Metered.ca, Twilio or Cloudflare TURN → paste `iceServers` in `config.js` |
| Giphy | GIF search | developers.giphy.com → API key → `giphyKey` in `config.js` |
| Push | closed-app alerts | `node scripts/gen-vapid.js`; public key → `config.js`; private key → `supabase secrets set VAPID_PRIVATE_KEY=…`; deploy `send-push`; add DB webhooks on `messages` and `calls` |
Also deploy `link-preview`. Set `privateCalls:true` after running `supabase-v3.sql`.

## 2. Legal (needs a lawyer)
Have a lawyer review `privacy.html` and `terms.html` for every country you target (GDPR, UK, CCPA, Brazil LGPD, India DPDP, Nigeria NDPA…). Fill `[COMPANY] [EMAIL] [COUNTRY] [DATE]`. Appoint an EU/UK representative if you target them. Set up an abuse-report inbox and a response routine (illegal content must be removed quickly).

## 3. App Store / Google Play (wrap with Capacitor: `npm i @capacitor/core @capacitor/cli && npx cap add ios && npx cap add android`)
**Name:** Michat — Private Chat  **Subtitle (30):** Chat, calls & groups for everyone
**Short description (80):** Private messaging with voice & video calls, groups, channels and stories.
**Long description:** Michat is a fast, free messenger for everyone, everywhere. Send messages, photos, voice notes, polls and files. Make voice and video calls, including group calls. Follow channels, share stories and pick from six distinct themes. Direct messages can be end-to-end encrypted. Available in 20+ languages. Premium adds HD photos, extra themes and more.
**Keywords:** chat, messenger, private, video call, group chat, voice notes, channels, encrypted
**Category:** Social Networking / Communication  **Age rating:** 12+ (user-generated content; has report/block + moderation)
**Permissions to justify:** Microphone (calls, voice notes), Camera (video calls, photos), Location (only when you tap Share location), Notifications (messages & calls).
**Privacy labels / Data safety:** collects contact info (email/phone), user content (messages, photos), identifiers, diagnostics (error logs); linked to the user; used for app functionality; not sold; deletion available in Settings.
**Review notes:** provide a demo login; point to Settings → Delete account, Report/Block tools and the privacy URL.
**Screenshots (capture on real devices):** chats list, chat with reactions, voice/video call, themes (show 3), channels, settings/language.
Apple/Google also require a support URL (use `landing.html`) and a privacy policy URL.

## 4. Added in v5
- `npm run doctor` checks `config.js` and the legal placeholders and tells you what's still missing before launch.
- `store-assets/` has the 1024×1024 App Store icon and the 1024×500 Google Play feature graphic. Phone screenshots must come from real devices.
- Deploy `link-device` (device linking) and `link-preview`. Group-call invites now also ring through push (add the `calls` DB webhook). Raise `maxGroupCall` in `config.js` if you accept lower quality above 4 people.

## Fast path
`cp .env.example .env` → fill in → `npm run deploy:backend` (staging first) → dashboard steps it prints → `npm run doctor` → STAGING_TEST_PLAN.md.

## 5. Added in v7
- Run `supabase-v5.sql` (the deploy script applies it from `supabase/migrations/`). Add `paymentUrlYearly` (a 365-day Stripe Payment Link; the webhook grants a year for payments of $20 or more).
- `store-assets/screenshots/` has 12 App-Store-size (1290×2796) screenshots rendered from the real UI with demo data. Replace them with real-device shots if you prefer.
- Testing kit: `npm test`, `python3 tests/ui/e2ee-test.py` (crypto), `python3 tests/ui/shots.py` (visual), `tests/rls-test.sql` (security rules), `tests/load-k6.js` (load), `SECURITY_REVIEW.md` (hand to an auditor), `BETA_PLAN.md`.
