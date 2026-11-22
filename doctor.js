// node scripts/doctor.js  → launch-readiness check of config.js (run before going live)
const fs = require('fs'), vm = require('vm'); const w = {}; vm.runInNewContext(fs.readFileSync('config.js', 'utf8'), { window: w });
const c = w.MICHAT_CONFIG || {}, ok = (b, m, hint) => console.log((b ? '✅ ' : '⚠️  ') + m + (b ? '' : '  → ' + hint));
ok(c.env === 'production', 'env is production', 'set env:"production"');
ok(!!c.url && !!c.key, 'Supabase url/key set (or built-in defaults used)', 'fill url & key for your PRODUCTION project');
ok(!!c.paymentUrl, 'Stripe payment link (paymentUrl)', 'create a Payment Link');
ok(Array.isArray(c.iceServers) && c.iceServers.some(s => /turn:/.test([].concat(s.urls).join())), 'TURN server for calls', 'add a TURN entry to iceServers');
ok(!!c.vapidPublicKey, 'Push public key (vapidPublicKey)', 'node scripts/gen-vapid.js');
ok(c.privateCalls === true, 'privateCalls enabled', 'run supabase-v3.sql then set privateCalls:true');
ok(!!c.paymentUrlYearly, 'Yearly plan link (paymentUrlYearly)', 'optional: 365-day Stripe Payment Link');
ok(!!c.giphyKey, 'Giphy key (GIF search)', 'optional');
const legal = ['privacy.html', 'terms.html', 'community-guidelines.html'].map(f => fs.readFileSync(f, 'utf8')).join();
ok(!/\[COMPANY\]|\[EMAIL\]|\[COUNTRY\]|\[DATE\]/.test(legal), 'legal placeholders filled', 'replace [COMPANY] [EMAIL] [COUNTRY] [DATE] + lawyer review');
