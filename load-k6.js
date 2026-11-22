// k6 load test: k6 run -e SUPABASE_URL=https://xxx.supabase.co -e ANON=... -e TOKENS=tokens.json tests/load-k6.js
// tokens.json = array of {"jwt":"...","name":"UserName"} for pre-created STAGING test users (never production).
import http from 'k6/http'; import { check, sleep } from 'k6';
const T = JSON.parse(open(__ENV.TOKENS));
export const options = { stages: [{ duration: '1m', target: 50 }, { duration: '3m', target: 200 }, { duration: '1m', target: 0 }],
  thresholds: { http_req_failed: ['rate<0.02'], http_req_duration: ['p(95)<800'] } };
export default function () {
  const u = T[(__VU - 1) % T.length], h = { apikey: __ENV.ANON, Authorization: 'Bearer ' + u.jwt, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const send = http.post(`${__ENV.SUPABASE_URL}/rest/v1/messages`, JSON.stringify({ chat_name: 'General', sender: u.name, sender_name: u.name, text: 'load ' + Date.now(), status: 'sent' }), { headers: h });
  const list = http.get(`${__ENV.SUPABASE_URL}/rest/v1/messages?chat_name=eq.General&order=created_at.desc&limit=50`, { headers: h });
  check(send, { 'sent': r => r.status === 201 || r.status === 429 }); check(list, { 'listed': r => r.status === 200 });
  sleep(1 + Math.random() * 2);
}
