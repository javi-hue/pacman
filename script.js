const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const tileSize = 20;
const rows = 31;
const cols = 28;

let pacman = {
  x: 13 * tileSize,
  y: 23 * tileSize,
  dx: 0,
  dy: 0,
  radius: 10
};

const map = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "######.##### ## #####.######",
  "######.##          ##.######",
  "######.## ######## ##.######",
  "      .   ########   .      ",
  "######.## ######## ##.######",
  "######.## ######## ##.######",
  "######.##          ##.######",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#...##................##...#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################"
];

function drawMap() {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      let tile = map[y][x];
      if (tile === "#") {
        ctx.fillStyle = "blue";
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      } else if (tile === ".") {
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(x * tileSize + tileSize/2, y * tileSize + tileSize/2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === "o") {
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(x * tileSize + tileSize/2, y * tileSize + tileSize/2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPacman() {
  ctx.beginPath();
  ctx.fillStyle = "yellow";
  ctx.moveTo(pacman.x + tileSize / 2, pacman.y + tileSize / 2);
  ctx.arc(
    pacman.x + tileSize / 2,
    pacman.y + tileSize / 2,
    pacman.radius,
    0.2 * Math.PI,
    1.8 * Math.PI
  );
  ctx.lineTo(pacman.x + tileSize / 2, pacman.y + tileSize / 2);
  ctx.fill();
  ctx.closePath();
}

function movePacman() {
  let nextX = pacman.x + pacman.dx;
  let nextY = pacman.y + pacman.dy;
  let col = Math.floor(nextX / tileSize);
  let row = Math.floor(nextY / tileSize);

  if (map[row][col] !== "#") {
    pacman.x = nextX;
    pacman.y = nextY;
  }
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  drawPacman();
  movePacman();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    pacman.dx = -2;
    pacman.dy = 0;
  } else if (e.key === "ArrowRight") {
    pacman.dx = 2;
    pacman.dy = 0;
  } else if (e.key === "ArrowUp") {
    pacman.dx = 0;
    pacman.dy = -2;
  } else if (e.key === "ArrowDown") {
    pacman.dx = 0;
    pacman.dy = 2;
  }
});

gameLoop();
