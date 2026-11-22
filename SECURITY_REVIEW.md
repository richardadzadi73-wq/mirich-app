# Michat security review notes

## Changes in v6

- Message routing and identity columns are now immutable. A non-sender can only change `status`; the sender can edit content without reassigning a message.
- Removed the broad `posts` update policy. Likes now change through `toggle_post_like`, with one like row per authenticated user and post.
- AI daily usage is reserved atomically through the service-role-only `consume_ai_quota` function, preventing concurrent requests from racing past the quota.
- Account deletion now removes additional account-owned records (reactions, poll votes, likes, calls, reports submitted by the user, feedback, premium requests, referrals, push subscriptions, key backups and AI usage). Reports filed by other people about the account are retained for moderation. Group records are retained to avoid deleting other members' conversations.

## Existing limitations requiring decisions before public launch

1. E2EE covers only the content paths described in the UI/code; do not market every feature as end-to-end encrypted. The current implementation notes say 1:1 text, photos and voice notes only.
2. The private key is stored in `localStorage`; an XSS vulnerability could expose it. Key backup security also depends on passphrase strength.
3. Static ECDH has no forward secrecy or automatic key rotation.
4. Media ciphertext is stored in a public bucket; URL secrecy is not access control.
5. Hashed phone-number contact discovery can be enumerable and needs server-side abuse controls.
6. Several app paths identify users by display name. Enforce uniqueness and consider migrating relationships to immutable user IDs.
7. AI and link-preview features send content to external/server-side services. The privacy notice must accurately disclose this.
8. TURN, VAPID, payment provider, production Supabase configuration, hosting headers/CSP, and legal placeholders require operator setup.

## Validation still required

- Apply migration 000006 on staging and test login, DMs, message status updates, group membership, feed likes, account deletion, and AI quotas with multiple accounts.
- Run `tests/rls-test.sql` against staging using separate user sessions and an admin session.
- Run browser E2EE tests in a real supported browser; the Python test alone does not establish full application security.
- Test Edge Function authentication, input limits, webhook signatures, link-preview SSRF protections, push delivery, Stripe events, TURN relay calls, and account deletion end to end.

The repository's `npm test` is a smoke/syntax check only. A passing result is not a production security certification.
