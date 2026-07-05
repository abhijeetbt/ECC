'use strict';

// Vercel serverless function: POST /api/create-key
// Called from the dashboard by a logged-in user to self-serve a new API key
// for their own account. The raw key is returned exactly once and never
// stored — only its sha256 hash is persisted, in api_keys.key_hash.

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ ok: false, error: 'Missing bearer token' });
    return;
  }

  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData || !userData.user) {
    res.status(401).json({ ok: false, error: 'Invalid session' });
    return;
  }

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();

  if (accountError || !account) {
    res.status(404).json({ ok: false, error: 'No account found for this user' });
    return;
  }

  const label = (req.body && typeof req.body.label === 'string' && req.body.label.trim()) || 'default';
  const rawKey = crypto.randomBytes(24).toString('base64url');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const { error: insertError } = await supabase.from('api_keys').insert({
    account_id: account.id,
    key_hash: keyHash,
    label
  });

  if (insertError) {
    res.status(500).json({ ok: false, error: insertError.message });
    return;
  }

  res.status(200).json({ ok: true, apiKey: rawKey, label });
};
