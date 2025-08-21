/* Pac-Man simple, canvas puro. Fantasmas con IA “greedy” por objetivo:
   - Modos: SCATTER/CHASE; FRIGHTENED por power pellet.
   - Blinky (rojo): target = Pac-Man.
   - Pinky (rosado): target = 4 casillas delante de Pac-Man.
   - Inky (cian): target ≈ reflejo usando Pac-Man y Blinky.
   - Clyde (naranja): persigue si lejos; si cerca (<8), va a su esquina.
*/

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  /*** HUD ***/
  const $score = document.getElementById('score');
  const $lives = document.getElementById('lives');
  const $level = document.getElementById('level');
  const $msg = document.getElementById('message');

  /*** Constantes del grid ***/
  const TILE = 20;                 // tamaño de celda en px
  const ROWS = 31, COLS = 28;      // clásico: 28x31
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE + 60; // margen inferior para centrar visual

  // Colores
  const COLORS = {
    wall: '#2dd2ff',
    pellet: '#ffe27a',
    power: '#ff8ee6',
    pac: '#ffd300',
    blinky: '#ff0000',
    pinky: '#ff7eb9',
    inky: '#00ffff',
    clyde: '#ffb347',
    frightened: '#1437ff',
    eyes: '#ffffff'
  };

  // Direcciones
  const DIRS = {
    LEFT: {x:-1,y:0, key:'ArrowLeft'},
    RIGHT:{x:1,y:0, key:'ArrowRight'},
    UP:   {x:0,y:-1, key:'ArrowUp'},
    DOWN: {x:0,y:1, key:'ArrowDown'}
  };
  const DIR_LIST = [DIRS.LEFT, DIRS.RIGHT, DIRS.UP, DIRS.DOWN];

  // Mapa (0 vacío, 1 pared, 2 pellet, 3 power, 4 puerta casa)
  // Mapa inspirado y simplificado para fines didácticos.
  const MAP = [
    "1111111111111111111111111111",
    "1000000000110000000000000001",
    "1011110110110111011011111101",
    "1030000100000000000100000301",
    "1011110101111111100101111101",
    "1000000101000000100100000001",
    "1111100111011110111101111101",
    "0000100001000100001000100000",
    "1110101111000101111000101111",
    "1000101000000000000000101001",
    "101110101111 11111110 1011101",
    "1000001000004444000000100001",
    "1111101111011110111101111101",
    "1000000000010001000000000001",
    "1011110111110001111101111101",
    "1030000100000000000100000301",
    "1011110101111111100101111101",
    "1000000101000000100100000001",
    "1111100111011110111101111101",
    "1000100001000100001000100001",
    "1010101111000101111000101011",
    "1000101000000000000000101001",
    "1110101011111111111101010111",
    "1000001000000000000000100001",
    "1011111111110111011111111101",
    "1000000000110000000000000001",
    "1111111111111111111111111111"
  ];

  // Normaliza filas: remueve espacios, rellena pellets donde 0 → pellet por defecto
  const grid = [];
  let pelletsTotal = 0;
  for (let r = 0; r < MAP.length; r++) {
    const row = MAP[r].replace(/\s+/g, '').split('').map(ch => {
      if (ch === '1') return 1;     // wall
      if (ch === '4') return 4;     // gate
      if (ch === '3') { pelletsTotal++; return 3; } // power
      if (ch === '0') { pelletsTotal++; return 2; } // pellet
      return 0; // vacío (camino sin pellet)
    });
    grid.push(row);
  }

  // Utilidades
  const inBounds = (c, r) => r >= 0 && r < grid.length && c >= 0 && c < grid[0].length;
  const isWall = (c, r) => !inBounds(c, r) || grid[r][c] === 1;
  const isGate = (c, r) => inBounds(c, r) && grid[r][c] === 4;
  const passable = (c, r) => inBounds(c, r) && grid[r][c] !== 1 && grid[r][c] !== 4;

  // Túneles (envolver lados)
  function wrap(pos) {
    if (pos.c < 0) pos.c = COLS - 1;
    if (pos.c >= COLS) pos.c = 0;
  }

  // Entidades
  const state = {
    score: 0,
    lives: 3,
    level: 1,
    mode: 'PLAYING',
    scatterTimer: 7,     // s
    chaseTimer: 20,      // s
    frightenedTimer: 6,  // s
    modePhase: 'SCATTER',
    modeTimeLeft: 7,
    pelletsLeft: pelletsTotal
  };

  const pacman = {
    c: 13, r: 17, dir: DIRS.LEFT, nextDir: DIRS.LEFT, speed: 6.5, radius: TILE*0.45,
    mouth: 0, mouthDir: 1
  };

  const ghostHome = { c: 13, r: 11 };
  function makeGhost(name, color, corner) {
    return {
      name, color,
      c: ghostHome.c, r: ghostHome.r,
      dir: DIRS.LEFT,
      speed: 6.0,
      mode: 'CHASE',           // CHASE | SCATTER | FRIGHTENED | EYES
      frightenedLeft: 0,
      corner,                  // {c,r}
    };
  }

  const ghosts = [
    makeGhost('blinky', COLORS.blinky, {c: COLS-2, r: 1}),
    makeGhost('pinky',  COLORS.pinky,  {c: 1, r: 1}),
    makeGhost('inky',   COLORS.inky,   {c: COLS-2, r: MAP.length-2}),
    makeGhost('clyde',  COLORS.clyde,  {c: 1, r: MAP.length-2}),
  ];

  // Input
  window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') paused = !paused;
    if (e.key === 'r' || e.key === 'R') hardReset();
    const wanted = DIR_LIST.find(d => d.key === e.key);
    if (wanted) pacman.nextDir = wanted;
  });

  // Loop
  let last = 0, paused = false;

  function hardReset() {
    state.score = 0; state.lives = 3; state.level = 1; state.mode='PLAYING';
    state.modePhase='SCATTER'; state.modeTimeLeft=state.scatterTimer;
    resetLevel(true);
  }

  function resetLevel(full=false) {
    // Recontar pellets si full
    if (full) {
      state.pelletsLeft = 0;
      for (let r=0;r<grid.length;r++) for (let c=0;c<grid[0].length;c++) {
        if (grid[r][c]===0) { /* nada */ }
        else if (grid[r][c]===2 || grid[r][c]===3) state.pelletsLeft++;
      }
    }
    pacman.c = 13; pacman.r = 17; pacman.dir = DIRS.LEFT; pacman.nextDir = DIRS.LEFT;
    ghosts[0].c = 13; ghosts[0].r = 11; ghosts[0].dir = DIRS.LEFT;
    ghosts[1].c = 14; ghosts[1].r = 11; ghosts[1].dir = DIRS.RIGHT;
    ghosts[2].c = 13; ghosts[2].r = 12; ghosts[2].dir = DIRS.UP;
    ghosts[3].c = 14; ghosts[3].r = 12; ghosts[3].dir = DIRS.DOWN;
    ghosts.forEach(g => { g.mode = state.modePhase; g.frightenedLeft = 0; });
    $level.textContent = state.level;
    $score.textContent = state.score;
    $lives.textContent = state.lives;
  }

  function loseLife() {
    state.lives--;
    $lives.textContent = state.lives;
    if (state.lives <= 0) {
      state.mode = 'GAMEOVER';
      showMessage('¡Game Over! (R para reiniciar)');
    } else {
      showMessage('¡Ay! (-1 vida)');
      setTimeout(() => { hideMessage(); resetLevel(); }, 1200);
    }
  }

  function showMessage(t) { $msg.textContent = t; $msg.classList.remove('hidden'); }
  function hideMessage() { $msg.classList.add('hidden'); }

  function tileCenter(c, r) {
    return { x: c*TILE + TILE/2, y: r*TILE + TILE/2 + 30 };
  }

  function drawMaze() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.translate(0, 30); // margen superior para estética

    // Fondo negro ya en canvas; dibuja muros y pellets
    for (let r=0;r<grid.length;r++) {
      for (let c=0;c<grid[0].length;c++) {
        const t = grid[r][c];
        if (t === 1) {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4);
        } else if (t === 2) {
          ctx.fillStyle = COLORS.pellet;
          const cc = tileCenter(c,r);
          ctx.beginPath();
          ctx.arc(cc.x, cc.y, 2.5, 0, Math.PI*2);
          ctx.fill();
        } else if (t === 3) {
          ctx.fillStyle = COLORS.power;
          const cc = tileCenter(c,r);
          ctx.beginPath();
          ctx.arc(cc.x, cc.y, 6, 0, Math.PI*2);
          ctx.fill();
        } else if (t === 4) {
          // puerta fantasma
          ctx.fillStyle = '#9b9b9b';
          ctx.fillRect(c*TILE+4, r*TILE+TILE/2-3, TILE-8, 6);
        }
      }
    }
    ctx.restore();
  }

  function drawPac() {
    const {x,y} = tileCenter(pacman.c, pacman.r);
    const mouthOpen = 0.2 + 0.2*Math.sin(pacman.mouth);
    let start = 0, end = 0;
    if (pacman.dir === DIRS.RIGHT) { start = mouthOpen; end = Math.PI*2 - mouthOpen; }
    if (pacman.dir === DIRS.LEFT)  { start = Math.PI + mouthOpen; end = Math.PI - mouthOpen; }
    if (pacman.dir === DIRS.UP)    { start = -Math.PI/2 + mouthOpen; end = Math.PI*1.5 - mouthOpen; }
    if (pacman.dir === DIRS.DOWN)  { start = Math.PI/2 + mouthOpen; end = Math.PI/2 - mouthOpen; }

    ctx.fillStyle = COLORS.pac;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.arc(x,y,pacman.radius,start,end,false);
    ctx.closePath();
    ctx.fill();
  }

  function drawGhost(g) {
    const {x,y} = tileCenter(g.c,g.r);
    ctx.fillStyle = (g.mode === 'FRIGHTENED') ? COLORS.frightened : g.color;
    ctx.beginPath();
    ctx.arc(x, y-6, TILE*0.45, Math.PI, 0);
    ctx.lineTo(x+TILE*0.45, y+TILE*0.45);
    for (let i=2;i>=-2;i--) {
      ctx.lineTo(x + (i*7), y + TILE*0.45*(i%2?1:0.7));
    }
    ctx.closePath();
    ctx.fill();

    // Ojos
    ctx.fillStyle = COLORS.eyes;
    const ex = (g.dir?.x || 0)*3, ey = (g.dir?.y || 0)*3;
    ctx.beginPath(); ctx.arc(x-6, y-6, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+6, y-6, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0033aa';
    ctx.beginPath(); ctx.arc(x-6+ex, y-6+ey, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+6+ex, y-6+ey, 2, 0, Math.PI*2); ctx.fill();
  }

  function neighbors(c, r) {
    return DIR_LIST.map(d => ({c:c+d.x, r:r+d.y, d})).filter(p => passable(p.c, p.r));
  }

  function dist2(a, b) { const dx=a.c-b.c, dy=a.r-b.r; return dx*dx+dy*dy; }

  function stepEntity(entity, dt) {
    // movimiento por celdas: acumula tiempo y salta de celda en celda
    entity.__acc = (entity.__acc || 0) + entity.speed*dt;
    while (entity.__acc >= 1) {
      entity.__acc -= 1;
      const nc = entity.c + (entity.dir?.x || 0);
      const nr = entity.r + (entity.dir?.y || 0);
      if (passable(nc, nr)) { entity.c = nc; entity.r = nr; wrap(entity); }
      else {
        // si choca, se queda
      }
    }
  }

  function atIntersection(c, r) {
    const opts = neighbors(c,r).length;
    return opts >= 3; // 3+ caminos
  }

  function chooseDirGreedy(fromDir, c, r, target) {
    // no permitir girar atrás salvo en intersección
    const options = neighbors(c,r)
      .filter(n => !(fromDir && n.d.x === -fromDir.x && n.d.y === -fromDir.y));
    if (options.length === 0) return fromDir || DIRS.LEFT;
    // elige el que minimiza distancia al objetivo
    options.sort((a,b)=>dist2({c:a.c,r:a.r},target)-dist2({c:b.c,r:b.r},target));
    return options[0].d;
  }

  function ghostTarget(g) {
    if (g.mode === 'SCATTER') return g.corner;

    // CHASE logic por fantasma
    const p = { c: pacman.c, r: pacman.r };
    if (g.name === 'blinky') return p;

    if (g.name === 'pinky') {
      return { c: p.c + 4*(pacman.dir?.x||0), r: p.r + 4*(pacman.dir?.y||0) };
    }

    if (g.name === 'inky') {
      // target = p2 = p adelantado 2 + vector desde blinky hasta p2
      const ahead = { c: p.c + 2*(pacman.dir?.x||0), r: p.r + 2*(pacman.dir?.y||0) };
      const bl = ghosts[0];
      return { c: ahead.c + (ahead.c - bl.c), r: ahead.r + (ahead.r - bl.r) };
    }

    if (g.name === 'clyde') {
      const d2 = dist2(g, p);
      if (d2 > 64) return p; // >8 casillas
      return g.corner;
    }

    return p;
  }

  function updateGhost(g, dt) {
    if (g.mode === 'FRIGHTENED') {
      g.frightenedLeft -= dt;
      if (g.frightenedLeft <= 0) g.mode = state.modePhase;
      // objetivo aleatorio ligero
      if (atIntersection(g.c,g.r) || !g.dir || Math.random()<0.1) {
        const opts = neighbors(g.c,g.r).filter(n => !(g.dir && n.d.x === -g.dir.x && n.d.y === -g.dir.y));
        if (opts.length) g.dir = opts[Math.floor(Math.random()*opts.length)].d;
      }
      stepEntity(g, dt*0.6); // más lento
      return;
    }

    if (g.mode === 'EYES') {
      // vuelve a la casa (puerta)
      const target = ghostHome;
      if (g.c === ghostHome.c && g.r === ghostHome.r) {
        g.mode = state.modePhase;
      }
      if (atIntersection(g.c,g.r) || !g.dir) {
        g.dir = chooseDirGreedy(g.dir, g.c, g.r, target);
      }
      stepEntity(g, dt*1.1);
      return;
    }

    // SCATTER o CHASE
    if (atIntersection(g.c,g.r) || !g.dir) {
      const target = ghostTarget(g);
      g.dir = chooseDirGreedy(g.dir, g.c, g.r, target);
    }
    stepEntity(g, dt * (1.0 + 0.02*state.level)); // un pelín más rápido por nivel
  }

  function eatAt(c,r) {
    const t = grid[r][c];
    if (t === 2) {
      grid[r][c] = 0;
      state.score += 10; state.pelletsLeft--;
      $score.textContent = state.score;
    } else if (t === 3) {
      grid[r][c] = 0;
      state.score += 50; state.pelletsLeft--;
      $score.textContent = state.score;
      ghosts.forEach(g => { if (g.mode!=='EYES'){ g.mode='FRIGHTENED'; g.frightenedLeft=state.frightenedTimer; }});
    }
  }

  function collide() {
    for (const g of ghosts) {
      if (Math.abs(g.c - pacman.c) <= 0 && Math.abs(g.r - pacman.r) <= 0) {
        if (g.mode === 'FRIGHTENED') {
          g.mode = 'EYES';
          state.score += 200;
          $score.textContent = state.score;
        } else if (g.mode !== 'EYES') {
          loseLife();
        }
      }
    }
  }

  function updateMode(dt) {
    // alterna SCATTER/CHASE mientras no haya FRIGHTENED forzado
    state.modeTimeLeft -= dt;
    if (state.modeTimeLeft <= 0) {
      if (state.modePhase === 'SCATTER') {
        state.modePhase = 'CHASE'; state.modeTimeLeft = state.chaseTimer;
      } else {
        state.modePhase = 'SCATTER'; state.modeTimeLeft = state.scatterTimer;
      }
      ghosts.forEach(g => { if (g.mode!=='FRIGHTENED' && g.mode!=='EYES') g.mode = state.modePhase; });
    }
  }

  function update(dt) {
    if (state.mode !== 'PLAYING') return;

    updateMode(dt);

    // Actualizar dirección de Pac-Man si puede girar
    const nextC = pacman.c + pacman.nextDir.x;
    const nextR = pacman.r + pacman.nextDir.y;
    if (passable(nextC, nextR)) pacman.dir = pacman.nextDir;

    stepEntity(pacman, dt);
    wrap(pacman);

    eatAt(pacman.c, pacman.r);
    collide();

    // Animación boca
    pacman.mouth += dt * 12 * (1 + 0.05*state.level);

    // Comprueba si ganó el nivel
    if (state.pelletsLeft <= 0) {
      state.level++;
      showMessage('¡Nivel superado!');
      setTimeout(() => {
        hideMessage();
        // Recolocar pellets: repoblar todas las celdas 0 que originalmente eran comibles
        for (let r=0;r<grid.length;r++){
          for (let c=0;c<grid[0].length;c++){
            // Heurística: repoblar corredores (no pared ni puerta)
            if (grid[r][c] === 0) grid[r][c] = 2;
          }
        }
        // Reponer 4 power pellets en esquinas seguras
        const pp = [{c:1,r:3},{c:COLS-2,r:3},{c:1,r:MAP.length-3},{c:COLS-2,r:MAP.length-3}];
        for (const p of pp) grid[p.r][p.c] = 3;
        state.pelletsLeft = 0;
        for (let r=0;r<grid.length;r++) for (let c=0;c<grid[0].length;c++) if (grid[r][c]===2||grid[r][c]===3) state.pelletsLeft++;
        resetLevel();
      }, 900);
    }
  }

  function render() {
    drawMaze();
    drawPac();
    ghosts.forEach(drawGhost);
  }

  function loop(ts) {
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (!paused) {
      ghosts.forEach(g => updateGhost(g, dt));
      update(dt);
      render();
    }
    requestAnimationFrame(loop);
  }

  // Start
  hardReset();
  hideMessage();
  requestAnimationFrame(loop);
})();
