const width = 80;
const height = 24;
let map = [];
let player = { x: 1, y: 1, level: 1, exp: 0, hp: 10, maxhp: 10, str: 10, maxStr: 10 };
let level = 1;
let upStairs = null;
let downStairs = null;
let rooms = [];
let monsters = [];
let monstersData = [];
let itemsData = {};
let items = [];
let inventory = [];
let currentWeapon = null;
let currentArmor = null;
let messages = [];
let gameOverFlag = false;
const maxMessages = 5;

// Random integer in [0, n)
function rnd(n) {
  return Math.floor(Math.random() * n);
}

// Equipment stats mappings from original Rogue specifications
const armorClass = {
  'leather armor': 2,
  'ring mail': 3,
  'studded leather armor': 3,
  'scale mail': 4,
  'chain mail': 5,
  'splint mail': 6,
  'banded mail': 6,
  'plate mail': 7
};
const weaponDamage = {
  'mace': [1, 4],
  'long sword': [1, 8],
  'short bow': [1, 5],
  'arrow': [1, 3],
  'dagger': [1, 4],
  'two handed sword': [2, 4],
  'dart': [1, 3],
  'shuriken': [1, 3],
  'spear': [1, 6]
};

// Compute player's armor class including enchantment and protection ring
function getPlayerAC() {
  const base = currentArmor ? (armorClass[currentArmor.item.name] || 0) : 0;
  return base + (currentArmor?.enchant || 0) + (player.protect ? 1 : 0);
}

// Determine if an attack hits based on attacker and defender stats
function attackHits(attacker, defender) {
  if (attacker === player) {
    const chance = 75 + attacker.level * 2 + (currentWeapon?.enchant || 0) * 5;
    return rnd(100) < chance;
  } else {
    const chance = 75 + attacker.lvl * 2 - getPlayerAC() * 5;
    return rnd(100) < chance;
  }
}

// Compute damage dealt by player based on weapon and enchantments
function computePlayerDamage() {
  let dmg;
  if (currentWeapon && weaponDamage[currentWeapon.item.name]) {
    const [n, d] = weaponDamage[currentWeapon.item.name];
    dmg = roll(n, d);
  } else {
    dmg = roll(1, 2);
  }
  dmg += (currentWeapon?.enchant || 0) + (player.increaseDamage ? 1 : 0);
  return dmg;
}

// Compute damage dealt by monster factoring in player's armor class
function computeMonsterDamage(mon) {
  let dmg = parseDamage(mon.dmg);
  dmg -= getPlayerAC();
  return dmg > 0 ? dmg : 0;
}
// Check that the dungeon's passable areas (rooms, corridors, doors, stairs) form one connected component
function isConnected(grid) {
  const h = grid.length, w = grid[0]?.length || 0;
  const seen = Array.from({ length: h }, () => Array(w).fill(false));
  const passable = c => c === '.' || c === '#' || c === '+' || c === '>' || c === '<';
  let start = null;
  for (let y = 0; y < h && !start; y++) {
    for (let x = 0; x < w; x++) {
      if (passable(grid[y][x])) { start = { x, y }; break; }
    }
  }
  if (!start) return true;
  const queue = [start];
  seen[start.y][start.x] = true;
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (ny >= 0 && ny < h && nx >= 0 && nx < w && !seen[ny][nx] && passable(grid[ny][nx])) {
        seen[ny][nx] = true;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (passable(grid[y][x]) && !seen[y][x]) return false;
    }
  }
  return true;
}

// Generate dungeon layout using Rogue's original room/corridor algorithm
function generateDungeon(level = 1) {
  const ISDARK = 0x1;
  const ISMAZE = 0x4;
  const MAXROOMS = 9;

  // Initialize empty grid
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => ' '));

  const localRooms = Array.from({ length: MAXROOMS }, () => ({
    pos: { x: 0, y: 0 },
    max: { x: 0, y: 0 },
    flags: 0,
    exits: []
  }));

  // Subdivision size for 3x3 layout
  const bsze = { x: Math.floor(width / 3), y: Math.floor(height / 3) };


  // Dig rooms
  for (let i = 0; i < MAXROOMS; i++) {
    const rp = localRooms[i];
    const top = { x: (i % 3) * bsze.x + 1, y: Math.floor(i / 3) * bsze.y };


    // Possibly dark or maze room
    if (rnd(10) < level - 1) {
      rp.flags |= ISDARK;
      if (rnd(15) === 0) rp.flags |= ISMAZE;
    }

    if (rp.flags & ISMAZE) {
      rp.max.x = bsze.x - 1;
      rp.max.y = bsze.y - 1;
      rp.pos.x = top.x === 1 ? 0 : top.x;
      rp.pos.y = top.y === 0 ? 1 : top.y;
      if (top.y === 0) {
        rp.pos.y++;
        rp.max.y--;
      }
    } else {
      do {
        rp.max.x = rnd(bsze.x - 4) + 4;
        rp.max.y = rnd(bsze.y - 4) + 4;
        rp.pos.x = top.x + rnd(bsze.x - rp.max.x);
        rp.pos.y = top.y + rnd(bsze.y - rp.max.y);
        if (i > 3 && (localRooms[i - 3].flags & ISMAZE) &&
            (localRooms[i - 3].pos.y + localRooms[i - 3].max.y === rp.pos.y - 1)) {
          rp.pos.y++;
          if (rp.max.y > 4) rp.max.y--;
        }
      } while (rp.pos.y === 0);
    }

    if (rp.flags & ISMAZE) doMaze(rp, grid);
    else drawRoom(rp, grid);
  }

  doPassages(localRooms, grid, level);
  // Ensure no isolated rooms or corridors; retry until fully connected
  if (!isConnected(grid)) {
    return generateDungeon(level);
  }
  rooms = localRooms;
  downStairs = (() => {
    let pos;
    do {
      const rp = rooms[rnd(rooms.length)];
      const x = rp.pos.x + 1 + rnd(rp.max.x - 2);
      const y = rp.pos.y + 1 + rnd(rp.max.y - 2);
      if (grid[y][x] === '.') { pos = { x, y }; break; }
    } while (true);
    grid[pos.y][pos.x] = '>';
    return pos;
  })();
  upStairs = null;
  if (level > 1) {
    upStairs = (() => {
      let pos;
      do {
        const rp = rooms[rnd(rooms.length)];
        const x = rp.pos.x + 1 + rnd(rp.max.x - 2);
        const y = rp.pos.y + 1 + rnd(rp.max.y - 2);
        if (grid[y][x] === '.') { pos = { x, y }; break; }
      } while (true);
      grid[pos.y][pos.x] = '<';
      return pos;
    })();
  }
  return grid;
}

// Draw a rectangular room
function drawRoom(rp, grid) {
  vert(rp, rp.pos.x, grid);
  vert(rp, rp.pos.x + rp.max.x - 1, grid);
  horiz(rp.pos.y, rp, grid);
  horiz(rp.pos.y + rp.max.y - 1, rp, grid);
  for (let y = rp.pos.y + 1; y < rp.pos.y + rp.max.y - 1; y++) {
    for (let x = rp.pos.x + 1; x < rp.pos.x + rp.max.x - 1; x++) {
      grid[y][x] = '.';
    }
  }
}

// Draw a vertical wall
function vert(rp, x, grid) {
  for (let y = rp.pos.y + 1; y <= rp.pos.y + rp.max.y - 1; y++) {
    grid[y][x] = '|';
  }
}

// Draw a horizontal wall
function horiz(y, rp, grid) {
  for (let x = rp.pos.x; x <= rp.pos.x + rp.max.x - 1; x++) {
    grid[y][x] = '-';
  }
}

// Dig a maze-style room (simple fill)
function doMaze(rp, grid) {
  for (let y = rp.pos.y; y < rp.pos.y + rp.max.y; y++) {
    for (let x = rp.pos.x; x < rp.pos.x + rp.max.x; x++) {
      grid[y][x] = '.';
    }
  }
}

// Connect rooms with corridors
function doPassages(rooms, grid, level) {
  const MAXROOMS = rooms.length;
  const rdes = rooms.map((_, i) => ({
    conn: rooms.map((__, j) =>
      Math.abs((i % 3) - (j % 3)) + Math.abs(Math.floor(i / 3) - Math.floor(j / 3)) === 1
    ),
    isconn: Array(MAXROOMS).fill(false),
    ingraph: false
  }));

  let roomCount = 1;
  let r1 = rnd(MAXROOMS);
  rdes[r1].ingraph = true;
  let r2;
  while (roomCount < MAXROOMS) {
    let jCount = 0;
    for (let i = 0; i < MAXROOMS; i++) {
      if (rdes[r1].conn[i] && !rdes[i].ingraph) {
        if (rnd(++jCount) === 0) r2 = i;
      }
    }
    if (jCount === 0) {
      do {
        r1 = rnd(MAXROOMS);
      } while (!rdes[r1].ingraph);
    } else {
      rdes[r2].ingraph = true;
      connectRooms(r1, r2, rooms, grid);
      rdes[r1].isconn[r2] = true;
      rdes[r2].isconn[r1] = true;
      roomCount++;
    }
  }
  for (let k = rnd(5); k > 0; k--) {
    r1 = rnd(MAXROOMS);
    let jCount = 0;
    for (let i = 0; i < MAXROOMS; i++) {
      if (rdes[r1].conn[i] && !rdes[r1].isconn[i]) {
        if (rnd(++jCount) === 0) r2 = i;
      }
    }
    if (jCount !== 0) {
      connectRooms(r1, r2, rooms, grid);
      rdes[r1].isconn[r2] = rdes[r2].isconn[r1] = true;
    }
  }
}

// Connect two rooms with a corridor and doors
function connectRooms(i1, i2, rooms, grid) {
  const rp1 = rooms[Math.min(i1, i2)];
  const rp2 = rooms[Math.min(i1, i2) + (Math.abs(i1 - i2) === 1 ? 1 : 3)];
  const down = Math.abs(i1 - i2) !== 1;
  let spos = { x: rp1.pos.x, y: rp1.pos.y };
  let epos = { x: rp2.pos.x, y: rp2.pos.y };
  let del, turnDelta, distance, turnDistance;
  if (down) {
    del = { x: 0, y: 1 };
    spos.x = rp1.pos.x + rnd(rp1.max.x - 2) + 1;
    spos.y = rp1.pos.y + rp1.max.y - 1;
    epos.x = rp2.pos.x + rnd(rp2.max.x - 2) + 1;
    distance = Math.abs(spos.y - epos.y) - 1;
    turnDelta = { x: spos.x < epos.x ? 1 : -1, y: 0 };
    turnDistance = Math.abs(spos.x - epos.x);
  } else {
    del = { x: 1, y: 0 };
    spos.x = rp1.pos.x + rp1.max.x - 1;
    spos.y = rp1.pos.y + rnd(rp1.max.y - 2) + 1;
    epos.y = rp2.pos.y + rnd(rp2.max.y - 2) + 1;
    distance = Math.abs(spos.x - epos.x) - 1;
    turnDelta = { x: 0, y: spos.y < epos.y ? 1 : -1 };
    turnDistance = Math.abs(spos.y - epos.y);
  }
  const turnSpot = rnd(distance - 1) + 1;
  door(rp1, spos, grid);
  door(rp2, epos, grid);
  let curr = { x: spos.x, y: spos.y };
  while (distance-- > 0) {
    curr.x += del.x;
    curr.y += del.y;
    if (distance === turnSpot) {
      let td = turnDistance;
      while (td-- > 0) {
        putpass(curr, grid);
        curr.x += turnDelta.x;
        curr.y += turnDelta.y;
      }
    }
    putpass(curr, grid);
  }
  curr.x += del.x;
  curr.y += del.y;

  function putpass(p, grid) {
    grid[p.y][p.x] = '#';
  }
  function door(rp, p, grid) {
    grid[p.y][p.x] = '+';
    rp.exits.push({ x: p.x, y: p.y });
  }
}

function draw() {
  if (gameOverFlag) return;
  const rows = map.map(r => r.join(''));
  for (const it of items) {
    const sym = symbolFor(it.category);
    const row = rows[it.pos.y];
    rows[it.pos.y] = row.substring(0, it.pos.x) + sym + row.substring(it.pos.x + 1);
  }
  for (const m of monsters) {
    if (m.hp > 0) {
      const r = rows[m.pos.y];
      rows[m.pos.y] = r.substring(0, m.pos.x) + m.type + r.substring(m.pos.x + 1);
    }
  }
  const row = rows[player.y];
  rows[player.y] = row.substring(0, player.x) + '@' + row.substring(player.x + 1);
  document.getElementById('map').textContent = rows.join('\n');
  // Update status line with equipment stats and active effects
  let statusText = `HP: ${player.hp}/${player.maxhp}  Str: ${player.str}/${player.maxStr}  Lv: ${player.level}`;
  if (currentWeapon) {
    statusText += `  Wpn: ${currentWeapon.item.name}${currentWeapon.enchant ? ' +' + currentWeapon.enchant : ''}`;
  }
  if (currentArmor) {
    statusText += `  Arm: ${getPlayerAC()}`;
  }
  const ringEffects = [];
  if (player.protect) ringEffects.push('Prot');
  if (player.sustain) ringEffects.push('Sust');
  if (player.increaseDamage) ringEffects.push('Dmg+');
  if (player.regeneration) ringEffects.push('Regen');
  if (ringEffects.length) {
    statusText += `  Effects: ${ringEffects.join(',')}`;
  }
  document.getElementById('status').textContent = statusText;
  renderLog();
}

// Message log management
// Display the GAME OVER screen and halt further gameplay
function gameOver() {
  gameOverFlag = true;
  const rows = [];
  for (let y = 0; y < height; y++) {
    rows.push(' '.repeat(width));
  }
  const text = 'GAME OVER';
  const row = Math.floor(height / 2);
  const col = Math.floor((width - text.length) / 2);
  rows[row] = ' '.repeat(col) + text + ' '.repeat(width - col - text.length);
  const hint = 'Press any key to restart';
  const hintRow = row + 2;
  if (hintRow < height) {
    const hintCol = Math.floor((width - hint.length) / 2);
    rows[hintRow] = ' '.repeat(hintCol) + hint + ' '.repeat(width - hintCol - hint.length);
  }
  document.getElementById('map').textContent = rows.join('\n');
  document.getElementById('status').textContent = '';
  document.getElementById('log').textContent = '';
}

function msg(text) {
  messages.push(text);
  if (messages.length > maxMessages) messages.shift();
  renderLog();
}

function renderLog() {
  document.getElementById('log').textContent = messages.join('\n');
}

function move(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  const cell = map[ny] && map[ny][nx];
  const monster = monsters.find(m => m.pos.x === nx && m.pos.y === ny && m.hp > 0);
  if (monster) {
    fight(monster);
  } else if (cell === '>' || cell === '<') {
    if (cell === '>') {
      level++;
      msg(`You descend to level ${level}.`);
    } else if (cell === '<' && level > 1) {
      level--;
      msg(`You ascend to level ${level}.`);
    }
    initGame();
    return;
  } else if (cell === '.' || cell === '#' || cell === '+') {
    player.x = nx;
    player.y = ny;
    const idx = items.findIndex(it => it.pos.x === nx && it.pos.y === ny);
    if (idx >= 0) {
      const it = items.splice(idx, 1)[0];
      inventory.push(it);
      msg(`You picked up a ${it.item.name} ${singular(it.category)}`);
    }
  }
  monsterTurn();
  draw();
}

window.addEventListener('keydown', e => {
  if (gameOverFlag) {
    location.reload();
    return;
  }
  if (player.sleep > 0) {
    player.sleep--;
    msg('You are asleep.');
    monsterTurn();
    draw();
    return;
  }
  switch (e.key) {
    case 'ArrowUp':
      move(0, -1);
      break;
    case 'ArrowDown':
      move(0, 1);
      break;
    case 'ArrowLeft':
      move(-1, 0);
      break;
    case 'ArrowRight':
      move(1, 0);
      break;
    case 'i':
      if (inventory.length === 0) {
        msg('You are not carrying anything.');
      } else {
        msg('Inventory:\n' + inventory.map(it => `${it.item.name} ${singular(it.category)}`).join('\n'));
      }
      break;
    case 'u':
      if (inventory.length === 0) {
        msg('You are not carrying anything.');
      } else {
        const choice = prompt('Use which item?\n' +
          inventory.map((it, i) => `${i + 1}: ${it.item.name} ${singular(it.category)}`).join('\n'));
        const idx = parseInt(choice, 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < inventory.length) {
          useItem(inventory[idx]);
        }
      }
      break;
  }
});

// Place the player at a random floor position in a non-vanished room
function placePlayer() {
  for (const rp of rooms) {
    const x = rp.pos.x + 1 + rnd(rp.max.x - 2);
    const y = rp.pos.y + 1 + rnd(rp.max.y - 2);
    if (map[y][x] === '.') {
      player.x = x;
      player.y = y;
      return;
    }
  }
}

async function initGame() {
  monstersData = await fetch('data/monsters.json').then(r => r.json());
  const [potions, scrolls, rings, weapons, armor, sticks] = await Promise.all([
    fetch('data/potions.json').then(r => r.json()),
    fetch('data/scrolls.json').then(r => r.json()),
    fetch('data/rings.json').then(r => r.json()),
    fetch('data/weapons.json').then(r => r.json()),
    fetch('data/armor.json').then(r => r.json()),
    fetch('data/sticks.json').then(r => r.json())
  ]);
  itemsData = { potions, scrolls, rings, weapons, armor, sticks };
  map = generateDungeon(level);
  placePlayer();
  placeMonsters();
  placeItems();
  draw();
}

function placeMonsters() {
  monsters = [];
  for (const rp of rooms) {
    if (rnd(100) < 25) {
      const x = rp.pos.x + 1 + rnd(rp.max.x - 2);
      const y = rp.pos.y + 1 + rnd(rp.max.y - 2);
      if (map[y][x] === '.') newMonster(randMonster(), { x, y });
    }
  }
}

function randMonster() {
  const lvlMons = ['K','E','B','S','H','I','R','O','Z','L','C','Q','A','N','Y','F','T','W','P','X','U','M','V','G','J','D'];
  let d;
  do {
    d = level + (rnd(10) - 6);
    if (d < 0) d = rnd(5);
    if (d > lvlMons.length - 1) d = rnd(5) + lvlMons.length - 6;
  } while (!lvlMons[d]);
  return lvlMons[d];
}

function roll(n, d) {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += rnd(d) + 1;
  return sum;
}

function expAdd(lvl, maxhp) {
  let mod = lvl === 1 ? Math.floor(maxhp / 8) : Math.floor(maxhp / 6);
  if (lvl > 9) mod *= 20;
  else if (lvl > 6) mod *= 4;
  return mod;
}

function parseDamage(dmg) {
  const parts = dmg.split('/');
  const part = parts[rnd(parts.length)];
  const [n, d] = part.split('x').map(Number);
  return roll(n || 0, d || 0);
}

function newMonster(type, pos) {
  const m = monstersData[type.charCodeAt(0) - 65];
  const levAdd = Math.max(level - 1, 0);
  const lvl = m.stats.lvl + levAdd;
  const maxhp = roll(lvl, 8);
  const mon = {
    type,
    name: m.name,
    pos: { x: pos.x, y: pos.y },
    hp: maxhp,
    maxhp,
    lvl,
    arm: m.stats.arm - levAdd,
    dmg: m.stats.dmg,
    str: m.stats.str,
    exp: m.stats.exp + levAdd * 10 + expAdd(lvl, maxhp)
  };
  monsters.push(mon);
}

function placeItems() {
  items = [];
  for (const category of Object.keys(itemsData)) {
    const list = itemsData[category];
    for (const rp of rooms) {
      if (rnd(100) < 25) {
        let x, y;
        do {
          x = rp.pos.x + 1 + rnd(rp.max.x - 2);
          y = rp.pos.y + 1 + rnd(rp.max.y - 2);
        } while (map[y][x] !== '.');
        const item = randItem(list);
        items.push({ category, item, pos: { x, y } });
      }
    }
  }
}

function randItem(list) {
  const total = list.reduce((sum, it) => sum + it.prob, 0);
  let r = rnd(total);
  for (const it of list) {
    if (r < it.prob) return it;
    r -= it.prob;
  }
  return list[0];
}

function symbolFor(category) {
  switch (category) {
    case 'potions': return '!';
    case 'scrolls': return '?';
    case 'rings': return '=';
    case 'weapons': return ')';
    case 'armor': return '[';
    case 'sticks': return '/';
  }
}

function singular(category) {
  switch (category) {
    case 'potions': return 'potion';
    case 'scrolls': return 'scroll';
    case 'rings': return 'ring';
    case 'weapons': return 'weapon';
    case 'armor': return 'armor';
    case 'sticks': return 'stick';
  }
}

// Apply actual potion effects based on original Rogue rules
function applyPotion(name) {
  msg(`You drank a potion of ${name}.`);
  switch (name) {
    case 'poison':
      // lose 1-3 strength
      const psn = rnd(3) + 1;
      player.str = Math.max(0, player.str - psn);
      msg(`You feel very sick! Strength down by ${psn}.`);
      break;
    case 'healing':
      // heal 1d4 per level, up to maxhp
      const heal = roll(player.level, 4);
      player.hp = Math.min(player.maxhp, player.hp + heal);
      msg('You begin to feel better.');
      break;
    case 'extra healing':
      // heal 1d8 per level, possibly increase maxhp
      let heal2 = roll(player.level, 8);
      player.hp += heal2;
      if (player.hp > player.maxhp) {
        if (player.hp > player.maxhp + player.level + 1) player.maxhp++;
        player.hp = player.maxhp;
      }
      msg('You begin to feel much better.');
      break;
    case 'gain strength':
      // gain 1 strength
      player.str++;
      player.maxStr = Math.max(player.maxStr, player.str);
      msg('You feel stronger, now. What bulging muscles!');
      break;
    case 'restore strength':
      // restore strength to max
      player.str = player.maxStr;
      msg('Hey, this tastes great. It makes you feel warm all over.');
      break;
    case 'raise level':
      // level up
      player.level++;
      player.maxhp += roll(player.level, 8);
      player.hp = player.maxhp;
      msg('You suddenly feel much more skillful.');
      break;

    case 'confusion':
      player.confused = rnd(10) + 10;
      msg('You feel confused.');
      break;

    case 'hallucination':
      player.hallucinating = rnd(10) + 10;
      msg('You begin to hallucinate.');
      break;

    case 'see invisible':
      player.seeInvisible = true;
      msg('You can now see invisible creatures.');
      break;

    case 'monster detection':
      player.detectMonsters = rnd(6) + player.level;
      msg('You sense the presence of monsters.');
      break;

    case 'magic detection':
      player.detectMagic = rnd(6) + player.level;
      msg('Your hands tingle.');
      break;

    case 'haste self':
      player.haste = rnd(10) + 5;
      msg('You feel yourself moving much faster.');
      break;

    case 'blindness':
      player.blind = rnd(10) + 5;
      msg('You are blinded!');
      break;

    case 'levitation':
      player.levitation = rnd(10) + player.level;
      msg('You begin to float above the ground.');
      break;

    default:
      // Other potions not implemented yet
      msg(`The potion of ${name} has no obvious effect.`);
  }
  draw();
}

// Apply scroll effects based on original Rogue scrolls
function applyScroll(name) {
  msg(`You read a scroll of ${name}.`);
  switch (name) {
    case 'monster confusion':
      player.canConfuse = true;
      msg('Your hands begin to glow red.');
      break;
    case 'magic mapping':
      msg('You sense a map of the dungeon in your mind.');
      draw();
      break;
    case 'hold monster':
      monsters.forEach(m => {
        if (Math.abs(m.pos.x - player.x) <= 2 && Math.abs(m.pos.y - player.y) <= 2) {
          m.held = (m.held || 0) + 6;
        }
      });
      msg('Monsters around you freeze.');
      break;
    case 'sleep':
      player.sleep = (player.sleep || 0) + (rnd(4) + 4);
      msg('You fall asleep.');
      break;
    case 'enchant armor':
      if (currentArmor) {
        currentArmor.enchant = (currentArmor.enchant || 0) + 1;
        msg('Your armor glows purple for a moment.');
      } else {
        msg('Your arms tingle.');
      }
      break;
    case 'enchant weapon':
      if (currentWeapon) {
        currentWeapon.enchant = (currentWeapon.enchant || 0) + 1;
        msg(`Your ${currentWeapon.item.name} glows silver for a moment.`);
      } else {
        msg('Your hands tingle.');
      }
      break;
    case 'scare monster':
      msg('You hear maniacal laughter in the distance.');
      break;
    case 'food detection':
      msg('Your nose tingles.');
      break;
    case 'teleportation':
      placePlayer();
      msg('You feel very strange.');
      break;
    case 'create monster': {
      const pos = { x: player.x + (rnd(3) - 1), y: player.y + (rnd(3) - 1) };
      newMonster(randMonster(), pos);
    }
      msg('A new monster appears nearby.');
      break;
    case 'identify potion':
    case 'identify scroll':
    case 'identify weapon':
    case 'identify armor':
    case 'identify ring':
      msg(`You identify your ${name.replace('identify ', '')}.`);
      break;
    case 'remove curse':
      msg('You feel as if somebody is watching over you.');
      break;
    case 'aggravate monsters':
      msg('You hear a high pitched humming noise.');
      monsters.forEach(m => { m.held = 0; m.confused = 0; });
      break;
    case 'protect armor':
      if (currentArmor) {
        currentArmor.protect = true;
        msg('Your armor is covered by a shimmering golden shield.');
      } else {
        msg('Your scalp itches.');
      }
      break;
    default:
      msg('Nothing happens.');
  }
  draw();
}

// Apply ring effects based on original Rogue ring_on
function applyRing(name) {
  msg(`You wear a ring of ${name}.`);
  switch (name) {
    case 'add strength':
      player.str++;
      player.maxStr = Math.max(player.maxStr, player.str);
      msg('You feel stronger.');
      break;
    case 'protection':
      player.protect = true;
      msg('You feel protected.');
      break;
    case 'sustain strength':
      player.sustain = true;
      msg('Your strength will not diminish.');
      break;
    case 'searching':
      player.search = true;
      msg('You feel more aware of your surroundings.');
      break;
    case 'see invisible':
      player.seeInvisible = true;
      msg('You can now see invisible creatures.');
      break;
    case 'aggravate monster':
      msg('You hear a high pitched humming noise.');
      break;
    case 'dexterity':
      player.dex = (player.dex || 10) + 1;
      msg('Your movements feel quicker.');
      break;
    case 'increase damage':
      player.increaseDamage = true;
      msg('You feel more dangerous.');
      break;
    case 'regeneration':
      player.regeneration = true;
      msg('Your wounds begin to heal.');
      break;
    case 'slow digestion':
      player.slowDigestion = true;
      msg('You feel your metabolism slow.');
      break;
    case 'teleportation':
      player.teleportation = true;
      msg('You feel a strange sensation.');
      break;
    case 'stealth':
      player.stealth = true;
      msg('You feel stealthy.');
      break;
    case 'maintain armor':
      player.maintainArmor = true;
      msg('Your armor feels more resilient.');
      break;
    case 'adornment':
      msg('You feel incredibly fashionable.');
      break;
    default:
      msg('Nothing happens.');
  }
}

// Apply stick (wand) effects based on original Rogue wands
function applyStick(name) {
  msg(`You zap with a stick of ${name}.`);
  switch (name) {
    case 'light':
      msg('The area is lit by a shimmering glow.');
      break;
    case 'invisibility':
      player.invisible = rnd(10) + player.level;
      msg('You feel invisible.');
      break;
    case 'lightning':
      msg('A bolt of lightning flashes from your wand.');
      break;
    case 'fire':
      msg('A jet of flame roars from your wand!');
      break;
    case 'cold':
      msg('A frigid blast chills everything nearby.');
      break;
    case 'polymorph':
      msg('You hear a strange rippling sound.');
      break;
    case 'magic missile':
      msg('A magic missile darts forth!');
      break;
    case 'haste monster':
      msg('You hear hurrying noises.');
      break;
    case 'slow monster':
      msg('You feel everything slow down.');
      break;
    case 'drain life':
      msg('You feel a sudden chill in your blood.');
      break;
    case 'nothing':
      msg('Nothing happens.');
      break;
    case 'teleport away':
      msg('You sense the world shift around you.');
      break;
    case 'teleport to':
      placePlayer();
      msg('You feel very strange.');
      break;
    case 'cancellation':
      msg('You sense the magic being drained away.');
      break;
    default:
      msg('Nothing happens.');
      break;
  }
  draw();
}

function useItem(it) {
  const idx = inventory.indexOf(it);
  if (idx < 0) return;
  switch (it.category) {
    case 'potions':
      inventory.splice(idx, 1);
      applyPotion(it.item.name);
      break;
    case 'scrolls':
      inventory.splice(idx, 1);
      applyScroll(it.item.name);
      break;
    case 'sticks':
      inventory.splice(idx, 1);
      applyStick(it.item.name);
      break;
    case 'weapons':
      inventory.splice(idx, 1);
      currentWeapon = it;
      msg(`You wield a ${it.item.name}.`);
      break;
    case 'armor':
      inventory.splice(idx, 1);
      currentArmor = it;
      msg(`You wear ${it.item.name}.`);
      break;
    case 'rings':
      inventory.splice(idx, 1);
      applyRing(it.item.name);
      break;
  }
}

function monsterTurn() {
  for (const m of monsters) {
    if (m.hp <= 0) continue;
    if (m.held > 0) {
      m.held--;
      continue;
    }
    if (m.confused > 0) {
      m.confused--;
      const dx = rnd(3) - 1, dy = rnd(3) - 1;
      const nx = m.pos.x + dx, ny = m.pos.y + dy;
      if (stepOK(map[ny] && map[ny][nx]) &&
          !monsters.some(o => o !== m && o.pos.x === nx && o.pos.y === ny && o.hp > 0)) {
        m.pos.x = nx; m.pos.y = ny;
      }
      continue;
    }
    moveMonster(m);
  }
}

function diagOK(sp, ep) {
  if (ep.x < 0 || ep.x >= width || ep.y < 0 || ep.y >= height) return false;
  if (ep.x === sp.x || ep.y === sp.y) return true;
  const ch1 = map[sp.y][ep.x];
  const ch2 = map[ep.y][sp.x];
  return stepOK(ch1) && stepOK(ch2);
}

function stepOK(ch) {
  return ch === '.' || ch === '#' || ch === '+';
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function moveMonster(mon) {
  const cur = { x: mon.pos.x, y: mon.pos.y };
  const target = { x: player.x, y: player.y };
  let best = distance(cur, target);
  const moves = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const ep = { x: nx, y: ny };
      if (!diagOK(cur, ep)) continue;
      if (!stepOK(map[ny] && map[ny][nx])) continue;
      if (monsters.some(o => o !== mon && o.pos.x === nx && o.pos.y === ny && o.hp > 0)) continue;
      const d = distance(ep, target);
      if (d < best) {
        best = d;
        moves.length = 0;
        moves.push(ep);
      } else if (d === best) {
        moves.push(ep);
      }
    }
  }
  if (moves.length) {
    const mpos = moves[rnd(moves.length)];
      if (mpos.x === player.x && mpos.y === player.y) {
        if (!attackHits(mon, player)) {
          msg(`The ${mon.name}'s attack misses you.`);
        } else {
          const mdmg = computeMonsterDamage(mon);
          player.hp -= mdmg;
          msg(`The ${mon.name} hits you for ${mdmg} damage.`);
          if (player.hp <= 0) { gameOver(); return; }
        }
      } else {
        mon.pos.x = mpos.x;
        mon.pos.y = mpos.y;
      }
  }
}

function fight(mon) {
  if (player.canConfuse) {
    mon.confused = rnd(4) + 4;
    player.canConfuse = false;
    msg('The monster appears confused.');
    return;
  }
  // Player attack phase
  if (!attackHits(player, mon)) {
    msg(`You miss the ${mon.name}.`);
  } else {
    const dmg = computePlayerDamage();
    mon.hp -= dmg;
    msg(`You hit the ${mon.name} for ${dmg} damage.`);
    if (mon.hp <= 0) {
      monsters = monsters.filter(m => m !== mon);
      player.exp += mon.exp;
      msg(`You gain ${mon.exp} experience points.`);
      while (player.exp >= player.level * player.level * 10) {
        player.exp -= player.level * player.level * 10;
        player.level++;
        player.maxhp += roll(player.level, 8);
        player.hp = player.maxhp;
        msg(`You advance to level ${player.level}!`);
      }
      draw();
      return;
    }
  }
  // Monster counterattack if still alive
  if (!attackHits(mon, player)) {
    msg(`The ${mon.name}'s attack misses you.`);
  } else {
    const rdmg = computeMonsterDamage(mon);
    player.hp -= rdmg;
    msg(`The ${mon.name} hits you for ${rdmg} damage.`);
    if (player.hp <= 0) { gameOver(); return; }
  }
  draw();
}

initGame();
