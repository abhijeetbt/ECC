'use strict';

// Shared token-count approximation. English text for Claude/GPT-family
// tokenizers averages ~4 characters per token; this is a rough estimate, not
// a real tokenizer, but centralizing it means every caller applies the same
// heuristic instead of each copying its own "chars / 4" formula.
const CHARS_PER_TOKEN = 4;

// Bounds memory for repeated estimates on identical content (e.g. the same
// agent file or session transcript scored more than once in a single run).
// Reuse pattern: cache the result, do not recompute it.
const MAX_CACHE_ENTRIES = 500;
const cache = new Map();

function estimateTokens(text) {
  const value = String(text || '');
  if (!value) return 0;

  const cached = cache.get(value);
  if (cached !== undefined) return cached;

  const estimate = Math.ceil(value.length / CHARS_PER_TOKEN);

  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(value, estimate);

  return estimate;
}

function clearTokenEstimateCache() {
  cache.clear();
}

module.exports = {
  estimateTokens,
  clearTokenEstimateCache,
  CHARS_PER_TOKEN
};
