import fs from 'fs';
const cfg = JSON.parse(fs.readFileSync('/Users/admin/.openclaw/openclaw.json', 'utf8'));
console.log(typeof cfg.channels.wecom.accounts);
console.log(Array.isArray(cfg.channels.wecom.accounts));
