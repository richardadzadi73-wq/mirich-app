// Syntax-checks every JS file and asserts critical pieces exist.
const fs = require('fs'), vm = require('vm'), path = require('path');
const files = fs.readdirSync('js').filter(f => f.endsWith('.js')).sort().map(f => path.join('js', f));
const all = files.map(f => fs.readFileSync(f, 'utf8'));
files.forEach((f, i) => { try { new vm.Script(all[i], { filename: f }); } catch (e) { console.error(f, e.message); process.exit(1); } });
const js = all.join('\n'), html = fs.readFileSync('index.html', 'utf8');
for (const k of ['normPhone','openPremiumSheet','reportMsg','deleteAccount','exportMyData','startRealCall','onSig','e2eEnc','aiReply','subscribePush','votePoll','startGroupCall','gcSig','browseChannels','gifSheet','linkPreviews','fetchUi','linkDevice','linkNewDevice','lkSend','mediaSeal','mediaOpen','toggleShare','msgSearch','claimRef','findContacts','openModeration'])
  if (!js.includes('function ' + k)) { console.error('missing', k); process.exit(1); }
for (const f of files) if (!html.includes(f.replace(/\\/g, '/'))) { console.error('index.html does not load', f); process.exit(1); }
if (/kumasi|momo|GHS/i.test(js + html)) { console.error('region-specific text found'); process.exit(1); }
console.log('smoke ok:', files.length, 'scripts');
