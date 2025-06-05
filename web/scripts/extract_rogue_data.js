#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const externPath = path.resolve(__dirname, '..', '..', 'rogue5.4.4-ant-r1.1.2', 'extern.c');
const dataDir = path.resolve(__dirname, '..', 'public', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const text = fs.readFileSync(externPath, 'utf8');

const macroXX = (text.match(/^#define\s+XX\s+(\d+)/m) || [])[1] || '10';
const macro___ = (text.match(/^#define\s+___\s+(\d+)/m) || [])[1] || '1';

function parseBlock(regex) {
  const m = text.match(regex);
  return m ? m[1].trim().split(/\r?\n/) : [];
}

const monstersLines = parseBlock(/struct\s+monster\s+monsters\[.*?\]\s*=\s*{([\s\S]*?)^};/m);
const monsters = monstersLines.map(line => {
  const m = line.match(/^\s*\{\s*"([^"]+)"\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*\{([^}]+)\}\s*},?/);
  if (!m) return null;
  const name = m[1];
  const carry = Number(m[2]);
  const flags = m[3].split('|').map(f => f.trim());
  const statsParts = m[4].split(',').map(s => s.trim());
  const str = statsParts[0] === 'XX' ? Number(macroXX) : Number(statsParts[0]);
  const exp = Number(statsParts[1]);
  const lvl = Number(statsParts[2]);
  const arm = Number(statsParts[3]);
  const hpt = statsParts[4] === '___' ? Number(macro___) : Number(statsParts[4]);
  const dmg = statsParts[5].replace(/^"|"$/g, '');
  return { name, carry, flags, stats: { str, exp, lvl, arm, hpt, dmg } };
}).filter(Boolean);
fs.writeFileSync(path.join(dataDir, 'monsters.json'), JSON.stringify(monsters, null, 2));

const itemConfigs = [
  { key: 'armor', regex: /struct\s+obj_info\s+arm_info\[.*?\]\s*=\s*{([\s\S]*?)^};/m },
  { key: 'potions', regex: /struct\s+obj_info\s+pot_info\[.*?\]\s*=\s*{([\s\S]*?)^};/m },
  { key: 'rings', regex: /struct\s+obj_info\s+ring_info\[.*?\]\s*=\s*{([\s\S]*?)^};/m },
  { key: 'scrolls', regex: /struct\s+obj_info\s+scr_info\[.*?\]\s*=\s*{([\s\S]*?)^};/m },
  { key: 'weapons', regex: /struct\s+obj_info\s+weap_info\[.*?\]\s*=\s*{([\s\S]*?)^};/m },
  { key: 'sticks', regex: /struct\s+obj_info\s+ws_info\[.*?\]\s*=\s*{([\s\S]*?)^};/m },
];

for (const { key, regex } of itemConfigs) {
  const lines = parseBlock(regex);
  const items = lines.map(line => {
    const m = line.match(/^\s*\{\s*([^}]+)\s*},?/);
    if (!m) return null;
    const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
    if (parts[0] === 'NULL') return null;
    const name = parts[0].replace(/^"|"$/g, '');
    const prob = Number(parts[1]);
    const worth = Number(parts[2]);
    const guess = parts[3] === 'NULL' ? null : parts[3].replace(/^"|"$/g, '');
    const know = parts[4] === 'FALSE' ? false : parts[4] === 'TRUE';
    return { name, prob, worth, guess, know };
  }).filter(Boolean);
  fs.writeFileSync(path.join(dataDir, `${key}.json`), JSON.stringify(items, null, 2));
}

console.log('Rogue data extracted to public/data');