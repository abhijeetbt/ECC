'use strict';

// Vercel serverless function: POST /api/ingest
// Receives audit-cost.js --push output. Never receives source code — only
// the findings array (id/title/category/status/detail/recommendation per
// check), the same JSON the CLI's --json flag prints locally.

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

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

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({ ok: false, error: 'Missing X-API-Key header' });
    return;
  }

  const { projectRoot, generatedAt, results } = req.body || {};
  if (!Array.isArray(results)) {
    res.status(400).json({ ok: false, error: '"results" must be an array' });
    return;
  }

  const supabase = getSupabase();
  const { data: keyRow, error: keyError } = await supabase
    .from('api_keys')
    .select('id, account_id, revoked_at')
    .eq('key_hash', hashKey(apiKey))
    .maybeSingle();

  if (keyError || !keyRow || keyRow.revoked_at) {
    res.status(401).json({ ok: false, error: 'Invalid or revoked API key' });
    return;
  }

  const findingsCount = results.filter(entry => entry && entry.status === 'warn').length;
  const passedCount = results.filter(entry => entry && entry.status === 'pass').length;

  const { error: insertError } = await supabase.from('audit_runs').insert({
    account_id: keyRow.account_id,
    project_root: typeof projectRoot === 'string' ? projectRoot : null,
    generated_at: generatedAt || new Date().toISOString(),
    findings_count: findingsCount,
    passed_count: passedCount,
    results
  });

  if (insertError) {
    res.status(500).json({ ok: false, error: insertError.message });
    return;
  }

  await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id);

  res.status(200).json({ ok: true, findingsCount, passedCount });
};
