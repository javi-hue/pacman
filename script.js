(()=>{
  const CANVAS=document.getElementById('game');
  const CTX=CANVAS.getContext('2d');

  const TILE=20;
   const COLS = 28, ROWS = 28;
  CANVAS.width = COLS * TILE;
  CANVAS.height = ROWS * TILE;

  const ui = {
    score: document.getElementById('score'),
    lives: document.getElementById('lives'),
    level: document.getElementById('level'),
    status: document.getElementById('status'),
    restart: document.getElementById('restart')
  };

  const base = [
    "1111111111111111111111111111",
    "1222222221111222222211122221",
    "1211111121111211111211121111",
    "1311111122222211112212221131",
    "1211111121111211111211121111",
    "1222222221111222222211122221",
    "1111111121111111111211111111",
    "0000011121222111121222110000",
    "1111011121111111121112111111",
    "2222011121100000112112112222",
    "1111011121104440112112111111",
    "1111011121104440112112111111",
    "2222011121104440112112112222",
    "1111011121100000112112111111",
    "0000011121111111121112110000",
    "1111111121222111121222111111",
    "1222222221111222222211122221",
    "1211111121111211111211121111",
    "1311111122222211112212221131",
    "1211111121111211111211121111",
    "1222222221111222222211122221",
    "1111111111111111111111111111",
    "1000000000000000000000000001",
    "1222222222222222222222222221",
    "1211111111111111111111111121",
    "1211111111111111111111111121",
    "1222222222222222222222222221",
    "1111111111111111111111111111"
  ];
 const WALL=1, PELLET=2, POWER=3, HOUSE=4;	

  let map = base.map(r => r.split('').map(c => {
    if (c==='0') return 0;
    if (c==='1') return WALL;
    if (c==='2') return PELLET;
    if (c==='3') return POWER;
    if (c==='4') return HOUSE;
    return 0;
  }));

  const DIRS = {
    left:  {x:-1,y:0, key:['ArrowLeft','a','A']},
    right: {x:1,y:0,  key:['ArrowRight','d','D']},
    up:    {x:0,y:-1, key:['ArrowUp','w','W']},
    down:  {x:0,y:1,  key:['ArrowDown','s','S']}
  };
  const opposite = (d)=> ({left:'right', right:'left', up:'down', down:'up'})[d];

  const spawn = {
    pac: {x: 14, y: 22},
    ghosts: [
      {x:13,y:12,color:getCSS('--ghost')},
      {x:14,y:12,color:getCSS('--ghost')},
      {x:15,y:12,color:getCSS('--ghost')}
    ]
  };

  let game, pac, ghosts;

  function resetEntities(level=1) {
    pac = {x: spawn.pac.x, y: spawn.pac.y, dir:'left', nextDir:'left', alive:true, mouth:0, powerTimer:0};
    ghosts = spawn.ghosts.map((g,i)=>({
      x:g.x, y:g.y, dir:['left','right','up'][i%3],
      scatterTimer:0, frightened:false, color:g.color, dead:false
    }));
    game = {score: 0, lives: 3, level, tick:0, running:true, win:false};
    updateUI();
    setStatus("Listo");
  }

  function getCSS(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function tile(x,y){ return map[y]?.[x] ?? WALL; }
  function isWall(x,y){ return tile(x,y)===WALL; }
  function wrapX(x){ if(x<0) return COLS-1; if(x>=COLS) return 0; return x; }

  window.addEventListener('keydown', (e)=>{
    for (const [name,dir] of Object.entries(DIRS)){
      if (dir.key.includes(e.key)){
        pac.nextDir = name;
      }
    }
    if (e.key==='r' || e.key==='R') start();
  });
  ui.restart.addEventListener('click', start);

  function start(){ resetEntities(1); }

  function step(){
    if (!game?.running) return;
    game.tick++;
    movePac();
    eatAt(pac.x,pac.y);
    moveGhosts();
    draw();
    requestAnimationFrame(step);
  }

  function movePac(){
    const tryDir = (d)=>{
      const vx = DIRS[d].x, vy = DIRS[d].y;
      const nx = wrapX(pac.x + vx), ny = pac.y + vy;
      if (!isWall(nx, ny)) { pac.dir = d; return true; }
      return false;
    };
    tryDir(pac.nextDir) || tryDir(pac.dir);
    const v = DIRS[pac.dir];
    let nx = wrapX(pac.x + v.x), ny = pac.y + v.y;
    if (!isWall(nx, ny)) {
      pac.x = nx; pac.y = ny; pac.mouth = (pac.mouth + 1) % 10;
    }
    if (pac.powerTimer>0) pac.powerTimer--;
  }

  function eatAt(x,y){
    if (map[y][x]===PELLET){
      map[y][x]=0; game.score += 10; updateUI();
    } else if (map[y][x]===POWER){
      map[y][x]=0; game.score += 50; pac.powerTimer = 60 * 6;
      ghosts.forEach(g=>{ if(!g.dead){ g.frightened=true; g.scatterTimer=60*6; } });
      setStatus("¡Poder!"); updateUI();
    }
  }

  function moveGhosts(){
    for (const g of ghosts){
      if (g.dead){ continue; }
      const target = g.frightened ? mirrorPoint(pac) : {...pac};
      g.dir = chooseDir(g, target, !g.frightened);
      stepEntity(g);
      if (g.x===pac.x && g.y===pac.y){
        if (pac.powerTimer>0 && !g.dead){
          g.dead = true; game.score += 200; setStatus("¡Fantasma comido!"); updateUI();
        } else if (!g.frightened){
          game.lives--; updateUI();
          if (game.lives<0){ game.running=false; setStatus("Game Over"); return; }
          pac.x=spawn.pac.x; pac.y=spawn.pac.y; pac.powerTimer=0;
          ghosts.forEach((gg,i)=>{ gg.x=spawn.ghosts[i].x; gg.y=spawn.ghosts[i].y; gg.dead=false; gg.frightened=false; });
          setStatus("¡Cuidado!");
        }
      }
    }
  }

  function stepEntity(e){
    const v = DIRS[e.dir];
    let nx = wrapX(e.x + v.x), ny = e.y + v.y;
    if (!isWall(nx, ny) && tile(nx,ny)!==HOUSE){
      e.x = nx; e.y = ny;
    } else {
      const dirs = Object.keys(DIRS).filter(d=>d!==opposite(e.dir));
      e.dir = dirs[Math.floor(Math.random()*dirs.length)];
    }
  }

  function chooseDir(e, target, chase=true){
    let bestDir = e.dir, bestScore = chase ? Infinity : -Infinity;
    const options = Object.entries(DIRS).filter(([d,_]) => d!==opposite(e.dir));
    for (const [name, v] of options){
      const nx = wrapX(e.x + v.x), ny = e.y + v.y;
      if (isWall(nx,ny) || tile(nx,ny)===HOUSE) continue;
      const dist = Math.abs(nx-target.x)+Math.abs(ny-target.y);
      if (chase){ if (dist < bestScore){ bestScore = dist; bestDir = name; } }
      else { if (dist > bestScore){ bestScore = dist; bestDir = name; } }
    }
    return bestDir;
  }

  function mirrorPoint(p){ return {x: COLS-1-p.x, y: ROWS-1-p.y}; }

  function draw(){
    CTX.clearRect(0,0,CANVAS.width,CANVAS.height);
    drawMaze(); drawPellets();
    drawPacman(pac.x, pac.y, pac.dir, pac.mouth);
    for (const g of ghosts){
      const frightened = (pac.powerTimer>0 && !g.dead) || g.frightened;
      drawGhost(g.x, g.y, frightened ? getCSS('--ghost-fright') : g.color, g.dir, g.dead);
    }
  }

  function drawMaze(){
    for (let y=0;y<ROWS;y++){
      for (let x=0;x<COLS;x++){
        const t = map[y][x];
        if (t===WALL){
          CTX.fillStyle = getCSS('--maze');
          CTX.fillRect(x*TILE, y*TILE, TILE, TILE);
        }
      }
    }
  }

  function drawPellets(){
    for (let y=0;y<ROWS;y++){
      for (let x=0;x<COLS;x++){
        if (map[y][x]===PELLET){
          CTX.fillStyle = getCSS('--pellet');
          CTX.beginPath(); CTX.arc(x*TILE+TILE/2, y*TILE+TILE/2, 3, 0, Math.PI*2); CTX.fill();
        } else if (map[y][x]===POWER){
          CTX.fillStyle = getCSS('--power');
          CTX.beginPath(); CTX.arc(x*TILE+TILE/2, y*TILE+TILE/2, 6, 0, Math.PI*2); CTX.fill();
        }
      }
    }
  }

  function drawPacman(x,y,dir,mouth){
    const cx = x*TILE+TILE/2, cy = y*TILE+TILE/2, r = TILE*0.45;
    const open = (Math.sin(mouth/2)+1)/2 * 0.4 + 0.1;
    const angle = {right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[dir] || 0;
    CTX.fillStyle = getCSS('--pac');
    CTX.beginPath();
    CTX.moveTo(cx,cy);
    CTX.arc(cx,cy,r, angle+open, angle-open, false);
    CTX.closePath(); CTX.fill();
  }

  function drawGhost(x,y,color,dir,dead=false){
    const px = x*TILE, py = y*TILE, w = TILE, h = TILE;
    CTX.fillStyle = dead ? "#888" : color;
    CTX.fillRect(px, py, w, h);
  }

  function updateUI(){
    ui.score.textContent = game.score;
    ui.lives.textContent = Math.max(0, game.lives);
    ui.level.textContent = game.level;
  }
  function setStatus(text){ ui.status.textContent = text; }

  resetEntities(1);
  requestAnimationFrame(step);
})();
