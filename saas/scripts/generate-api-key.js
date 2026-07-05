#!/usr/bin/env node
'use strict';

// Manual fallback for issuing a client an API key without them signing up
// through the dashboard — useful when you're onboarding a client yourself.
// Prints the raw key (give this to the client) and its hash (paste into a
// Supabase SQL editor insert against api_keys.key_hash for their account_id).

const crypto = require('crypto');

const rawKey = crypto.randomBytes(24).toString('base64url');
const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

console.log('Raw key (give this to the client — shown once, never stored):');
console.log('  ' + rawKey);
console.log('');
console.log('Key hash (insert into api_keys.key_hash for the target account_id):');
console.log('  ' + keyHash);
console.log('');
console.log('Example SQL:');
console.log(`  insert into api_keys (account_id, key_hash, label) values ('<account-uuid>', '${keyHash}', 'manual');`);
