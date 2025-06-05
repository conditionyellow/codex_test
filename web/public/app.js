const width = 20;
const height = 10;
let map = [];
let player = { x: 1, y: 1, hp: 10 };

function randMap() {
  map = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        row += '#';
      } else {
        row += Math.random() < 0.1 ? '#' : '.';
      }
    }
    map.push(row);
  }
}

function draw() {
  const rows = map.slice();
  const row = rows[player.y];
  rows[player.y] = row.substring(0, player.x) + '@' + row.substring(player.x + 1);
  document.getElementById('map').textContent = rows.join('\n');
  document.getElementById('status').textContent = `HP: ${player.hp}`;
}

function move(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (map[ny][nx] !== '#') {
    player.x = nx;
    player.y = ny;
  }
  draw();
}

window.addEventListener('keydown', e => {
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
  }
});

randMap();
draw();
