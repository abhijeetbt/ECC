#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { renderTextToPng, estimateImageTokens, estimateTextTokens } = require('./lib/png-text-render');

const PANGRAM = 'the quick brown fox jumps over the lazy dog ';
const REPEAT = Number(process.argv[2]) || 10;
const outputPath = process.argv[3] || path.join(process.cwd(), 'cost-demo.png');

const text = PANGRAM.repeat(REPEAT).trim();
const wordCount = text.split(/\s+/).length;

const { png, width, height, renderedText } = renderTextToPng(text);
fs.writeFileSync(outputPath, png);

const imageTokens = estimateImageTokens(width, height);
const textTokens = estimateTextTokens(text);
const pctDifference = ((imageTokens - textTokens) / textTokens) * 100;

console.log(`
Rendered ${wordCount} words (${text.length} chars) as a legible PNG.
Wrote ${outputPath} (${width}x${height}px, ${png.length} bytes)

NOTE: no Anthropic API credentials are configured in this sandbox, so these
are computed from Anthropic's documented image-token formula
(tokens ~= width*height/750) and the standard ~4-chars/token text heuristic —
not a live count_tokens() call. Provide an API key to get exact measured counts.

  Plain text tokens (est.):  ${textTokens}
  Image tokens (est.):       ${imageTokens}
  Difference:                ${pctDifference >= 0 ? '+' : ''}${pctDifference.toFixed(1)}% (image vs text)

Rendered text (lowercase a-z only, this demo font's coverage):
  "${renderedText}"
`);
