#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Generate JSON data if not exists
require('./extract_rogue_data');

const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, '..');
const dataDir = path.resolve(projectRoot, 'public', 'data');
const docsFile = path.resolve(projectRoot, 'SPECIFICATION.md');

function generateMonstersTable(monsters) {
  const header = '| 名前 | 運搬能力 | フラグ | 経験値 | レベル | 装甲 | ヘルス | ダメージ |';
  const separator = '| ---- | -------- | ------ | ---- | ---- | ---- | ---- | ---- |';
  const rows = monsters.map(m => {
    const flags = m.flags.join(', ');
    return `| ${m.name} | ${m.carry} | ${flags} | ${m.stats.exp} | ${m.stats.lvl} | ${m.stats.arm} | ${m.stats.hpt} | ${m.stats.dmg} |`;
  });
  return [header, separator, ...rows].join('\n');
}

function generateItemsTable(items) {
  const header = '| 名前 | 出現確率 | 価値 | 推測名 | 初期既知 |';
  const separator = '| ---- | -------- | ---- | ---- | ---- |';
  const rows = items.map(item => {
    const guess = item.guess || '';
    const know = item.know ? 'Yes' : 'No';
    return `| ${item.name} | ${item.prob} | ${item.worth} | ${guess} | ${know} |`;
  });
  return [header, separator, ...rows].join('\n');
}

function main() {
  let spec = fs.readFileSync(docsFile, 'utf8');

  const monsters = JSON.parse(fs.readFileSync(path.join(dataDir, 'monsters.json'), 'utf8'));
  const armor = JSON.parse(fs.readFileSync(path.join(dataDir, 'armor.json'), 'utf8'));
  const potions = JSON.parse(fs.readFileSync(path.join(dataDir, 'potions.json'), 'utf8'));
  const rings = JSON.parse(fs.readFileSync(path.join(dataDir, 'rings.json'), 'utf8'));
  const scrolls = JSON.parse(fs.readFileSync(path.join(dataDir, 'scrolls.json'), 'utf8'));
  const weapons = JSON.parse(fs.readFileSync(path.join(dataDir, 'weapons.json'), 'utf8'));
  const sticks = JSON.parse(fs.readFileSync(path.join(dataDir, 'sticks.json'), 'utf8'));

  // Insert monsters table and description
  const monsterTable = generateMonstersTable(monsters);
  const monstersSection = `## 11. モンスター一覧

下記の表は、コード中で定義されているモンスターの一覧と各種パラメータを示す。

${monsterTable}

## 12. アイテム一覧`;
  spec = spec.replace(/## 11\. モンスター一覧[\s\S]*?## 12\. アイテム一覧/, monstersSection);

  // Insert items tables
  spec = spec.replace('<!-- ARMOR_TABLE -->', generateItemsTable(armor));
  spec = spec.replace('<!-- POTIONS_TABLE -->', generateItemsTable(potions));
  spec = spec.replace('<!-- RINGS_TABLE -->', generateItemsTable(rings));
  spec = spec.replace('<!-- SCROLLS_TABLE -->', generateItemsTable(scrolls));
  spec = spec.replace('<!-- WEAPONS_TABLE -->', generateItemsTable(weapons));
  spec = spec.replace('<!-- STICKS_TABLE -->', generateItemsTable(sticks));

  fs.writeFileSync(docsFile, spec);
  console.log('SPECIFICATION.md を更新しました。');
}

main();