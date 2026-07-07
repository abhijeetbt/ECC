#!/usr/bin/env node

const fs = require('fs');
const { encodeTextToPng, decodePngToText, getEncodingStats } = require('./lib/png-text-codec');

function showHelp(exitCode = 0) {
  console.log(`
Pack text into a minimal-pixel PNG (or unpack it back) — a storage/transport
container, not a way to feed images to a model's vision input.

Usage:
  node scripts/png-text-codec.js encode <input.txt> <output.png>
  node scripts/png-text-codec.js decode <input.png> [output.txt]
  node scripts/png-text-codec.js stats <input.txt>

Examples:
  node scripts/png-text-codec.js encode notes.txt notes.png
  node scripts/png-text-codec.js decode notes.png
  node scripts/png-text-codec.js stats notes.txt
`);
  process.exit(exitCode);
}

function main(argv) {
  const [command, ...args] = argv;

  if (!command || command === '--help' || command === '-h') {
    showHelp(command ? 0 : 1);
    return;
  }

  if (command === 'encode') {
    const [input, output] = args;
    if (!input || !output) showHelp(1);
    const text = fs.readFileSync(input, 'utf8');
    const png = encodeTextToPng(text);
    fs.writeFileSync(output, png);
    console.log(`Wrote ${output} (${png.length} bytes, ${png.length} px x 1)`);
    return;
  }

  if (command === 'decode') {
    const [input, output] = args;
    if (!input) showHelp(1);
    const buffer = fs.readFileSync(input);
    const text = decodePngToText(buffer);
    if (output) {
      fs.writeFileSync(output, text);
      console.log(`Wrote ${output}`);
    } else {
      process.stdout.write(text);
    }
    return;
  }

  if (command === 'stats') {
    const [input] = args;
    if (!input) showHelp(1);
    const text = fs.readFileSync(input, 'utf8');
    const stats = getEncodingStats(text);
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  showHelp(1);
}

main(process.argv.slice(2));
