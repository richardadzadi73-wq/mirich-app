# Staging test plan (2 phones + 1 laptop, different networks)
1. Run supabase-security.sql → supabase-v3.sql. Deploy functions (stripe-webhook, send-push, ai-chat) and set secrets. Create the 2 DB webhooks.
2. Auth: sign up A and B (email + phone). Check profiles of others do NOT expose phone/email (query public_profiles).
3. Chat: A↔B text, photo, voice, file, poll, location, reaction, reply, edit, delete, forward, star. Group of 3: add/remove member.
4. E2EE: both enable encryption; confirm rows in `messages.text` start with `e2e1:`; fingerprints match; new device restore with passphrase.
5. Push: close B's app fully → A messages and calls B → notification arrives; tap opens app and call rings.
6. Calls: voice+video on Wi-Fi↔mobile data. If fail → add TURN to config.js.
7. AI: ask Mirich AI; summarize a chat; translate a message; hit the daily limit.
8. Security: as B, try `update messages set text='x' where sender='A'` (must fail); try setting own is_premium (must fail); flood 31 msgs/min (blocked).
9. Premium: Stripe test payment → webhook → premium active; delete account → data gone.
