// node scripts/gen-vapid.js  → prints a VAPID key pair. Public key → config.js vapidPublicKey. Private key → Edge Function secret ONLY.
const c = require('crypto'); const { publicKey, privateKey } = c.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const a = publicKey.export({ format: 'jwk' }), b = privateKey.export({ format: 'jwk' });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(a.x, 'base64url'), Buffer.from(a.y, 'base64url')]).toString('base64url');
console.log('VAPID_PUBLIC_KEY=' + pub + '\nVAPID_PRIVATE_KEY=' + b.d);
