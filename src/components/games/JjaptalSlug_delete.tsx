
import { useEffect, useRef, useCallback } from 'react';

// ── 상수 ──────────────────────────────────────────────
const W = 680, H = 320;
const GROUND = H - 56;
const PLAYER_MAX_HP = 10;
const LEVEL_WIDTH = 4000;

const COLORS = {
  sky: '#0d0820', ground: '#2a1a0e', groundTop: '#4a3020',
  platform: '#3a2510', platformTop: '#5a3c1a',
};

// ── 타입 정의 ─────────────────────────────────────────
type EnemyType = 'soldier' | 'heavy' | 'sniper';

interface Vec2 { x: number; y: number; }
interface Entity extends Vec2 { vx: number; vy: number; w: number; h: number; onGround: boolean; }

interface Player extends Entity {
  dir: number; crouching: boolean;
  hp: number; maxHp: number;
  shootTimer: number; shooting: boolean;
  grenades: number; invincible: number;
  animFrame: number; animTimer: number;
}

interface Enemy extends Entity {
  type: EnemyType; dir: number; alert: boolean;
  hp: number; hp_max: number; speed: number; score: number;
  fireRate: number; fireTimer: number;
  animFrame: number; animTimer: number;
  dying: number;
}

interface Bullet extends Vec2 { vx: number; vy: number; dmg: number; life: number; }
interface Grenade extends Vec2 { vx: number; vy: number; life: number; }
interface Particle extends Vec2 { vx: number; vy: number; life: number; color: string; isStar?: boolean; }
interface Explosion extends Vec2 { r: number; life: number; maxLife: number; }
interface Platform { x: number; y: number; w: number; h: number; }
interface Pickup { x: number; y: number; type: 'hp' | 'grenade'; taken: boolean; respawn: number; }

// ── 게임 상태 (ref에 담길 mutable 객체) ────────────────
interface GameState {
  active: boolean;
  score: number; wave: number; kills: number;
  camX: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  enemyBullets: Bullet[];
  explosions: Explosion[];
  particles: Particle[];
  grenades: Grenade[];
  pickups: Pickup[];
  platforms: Platform[];
  spawnTimer: number;
  spawnInterval: number;
  waveEnemiesLeft: number;
  waveBannerTimer: number;
  keys: Record<string, boolean>;
  frameId: number;
}

// ── 헬퍼 ──────────────────────────────────────────────
function enemyHp(type: EnemyType, w: number) {
  return { soldier: 3, heavy: 10, sniper: 2 }[type] + Math.floor(w / 2);
}
function enemySpeed(type: EnemyType, w: number) {
  return { soldier: 0.9, heavy: 0.5, sniper: 0.45 }[type] + w * 0.05;
}
function enemyFireRate(type: EnemyType, w: number) {
  return Math.max(30, { soldier: 90, heavy: 110, sniper: 180 }[type] - w * 5);
}

function mkPlayer(): Player {
  return {
    x: 80, y: GROUND, w: 24, h: 44, vx: 0, vy: 0, onGround: false,
    dir: 1, crouching: false,
    hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP,
    shootTimer: 0, shooting: false, grenades: 5, invincible: 0,
    animFrame: 0, animTimer: 0,
  };
}

function mkEnemy(x: number, type: EnemyType, wave: number): Enemy {
  const hp = enemyHp(type, wave);
  return {
    x, y: GROUND,
    w: type === 'heavy' ? 28 : 22,
    h: type === 'heavy' ? 52 : 44,
    vx: 0, vy: 0, onGround: false, dir: -1, alert: false,
    type, hp, hp_max: hp,
    speed: enemySpeed(type, wave),
    score: { soldier: 100, heavy: 300, sniper: 200 }[type],
    fireRate: enemyFireRate(type, wave),
    fireTimer: Math.floor(Math.random() * enemyFireRate(type, wave)),
    animFrame: 0, animTimer: 0, dying: 0,
  };
}

function buildPlatforms(): Platform[] {
  return [
    { x: 240, y: GROUND - 60, w: 120, h: 16 }, { x: 480, y: GROUND - 80, w: 100, h: 16 },
    { x: 700, y: GROUND - 60, w: 80, h: 16 },  { x: 900, y: GROUND - 90, w: 140, h: 16 },
    { x: 1100, y: GROUND - 70, w: 100, h: 16 },{ x: 1300, y: GROUND - 50, w: 80, h: 16 },
    { x: 1500, y: GROUND - 80, w: 120, h: 16 },{ x: 1750, y: GROUND - 65, w: 100, h: 16 },
    { x: 1950, y: GROUND - 90, w: 130, h: 16 },{ x: 2100, y: GROUND - 55, w: 90, h: 16 },
    { x: 2400, y: GROUND - 70, w: 110, h: 16 },{ x: 2700, y: GROUND - 85, w: 100, h: 16 },
    { x: 3000, y: GROUND - 60, w: 120, h: 16 },{ x: 3300, y: GROUND - 90, w: 100, h: 16 },
  ];
}

function buildPickups(): Pickup[] {
  const spots: Array<{ x: number; type: 'hp' | 'grenade' }> = [
    { x: 400, type: 'grenade' }, { x: 700, type: 'hp' },
    { x: 1100, type: 'grenade' }, { x: 1500, type: 'hp' },
    { x: 1900, type: 'grenade' }, { x: 2300, type: 'hp' },
    { x: 2700, type: 'grenade' }, { x: 3100, type: 'hp' },
  ];
  return spots.map(s => ({ ...s, y: GROUND - 20, taken: false, respawn: 0 }));
}

function checkOnGround(obj: Entity, platforms: Platform[]): boolean {
  let on = false;
  if (obj.y >= GROUND) { obj.y = GROUND; on = true; }
  for (const p of platforms) {
    if (obj.vy >= 0 && obj.x + obj.w > p.x && obj.x < p.x + p.w
      && obj.y <= p.y + p.h && obj.y + obj.vy + 4 >= p.y) {
      obj.y = p.y; on = true;
    }
  }
  return on;
}

// ── 드로잉 ────────────────────────────────────────────
function drawSDPlayer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, dir: number, frame: number,
  crouching: boolean, shooting: boolean, invincible: number
) {
  if (invincible && Math.floor(invincible / 4) % 2 === 0) return;
  ctx.save();
  if (dir < 0) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
  const bob = crouching ? 6 : [0, -2, 0, 2][frame % 4];
  const bx = cx, by = cy;
  ctx.fillStyle = '#5a7acc'; ctx.fillRect(bx + 3, by - 10 + bob, 7, 10); ctx.fillRect(bx + 13, by - 10 + bob, 7, 10);
  ctx.fillStyle = '#2a2a4a'; ctx.fillRect(bx + 2, by - 2 + bob, 8, 4); ctx.fillRect(bx + 12, by - 2 + bob, 8, 4);
  ctx.fillStyle = '#4a6ab8'; ctx.fillRect(bx + 2, by - 22 + bob, 19, 13);
  ctx.fillStyle = '#6a8ad8'; ctx.fillRect(bx + 4, by - 21 + bob, 7, 4);
  ctx.fillStyle = '#555'; ctx.fillRect(bx + 18, by - 18 + bob, 10, 4);
  ctx.fillStyle = '#777'; ctx.fillRect(bx + 26, by - 17 + bob, 6, 2);
  if (shooting) { ctx.fillStyle = '#ffff80'; ctx.fillRect(bx + 32, by - 18 + bob, 6, 4); }
  ctx.fillStyle = '#f5c080';
  ctx.fillRect(bx - 1, by - 44 + bob, 26, 24); ctx.fillRect(bx + 1, by - 46 + bob, 22, 2);
  ctx.fillRect(bx + 1, by - 22 + bob, 22, 2); ctx.fillRect(bx - 3, by - 42 + bob, 2, 18); ctx.fillRect(bx + 25, by - 42 + bob, 2, 18);
  ctx.fillStyle = '#3a5aa8';
  ctx.fillRect(bx, by - 48 + bob, 24, 12); ctx.fillRect(bx - 1, by - 46 + bob, 2, 8); ctx.fillRect(bx + 23, by - 46 + bob, 2, 8);
  ctx.fillStyle = '#5a7ac8'; ctx.fillRect(bx + 4, by - 47 + bob, 14, 3);
  ctx.fillStyle = '#f0e060'; ctx.fillRect(bx + 9, by - 45 + bob, 6, 2); ctx.fillRect(bx + 11, by - 47 + bob, 2, 6);
  ctx.fillStyle = '#fff'; ctx.fillRect(bx + 3, by - 38 + bob, 8, 8); ctx.fillRect(bx + 13, by - 38 + bob, 8, 8);
  ctx.fillStyle = '#2244cc'; ctx.fillRect(bx + 5, by - 36 + bob, 5, 5); ctx.fillRect(bx + 15, by - 36 + bob, 5, 5);
  ctx.fillStyle = '#111'; ctx.fillRect(bx + 6, by - 35 + bob, 3, 3); ctx.fillRect(bx + 16, by - 35 + bob, 3, 3);
  ctx.fillStyle = '#fff'; ctx.fillRect(bx + 5, by - 36 + bob, 2, 2); ctx.fillRect(bx + 15, by - 36 + bob, 2, 2);
  ctx.fillStyle = 'rgba(255,120,120,0.6)'; ctx.fillRect(bx + 1, by - 32 + bob, 5, 3); ctx.fillRect(bx + 18, by - 32 + bob, 5, 3);
  ctx.fillStyle = '#c06040'; ctx.fillRect(bx + 8, by - 27 + bob, 8, 2); ctx.fillRect(bx + 7, by - 28 + bob, 2, 2); ctx.fillRect(bx + 15, by - 28 + bob, 2, 2);
  ctx.fillStyle = '#f5c080'; ctx.fillRect(bx - 3, by - 40 + bob, 3, 6); ctx.fillRect(bx + 24, by - 40 + bob, 3, 6);
  ctx.restore();
}

function drawSDEnemy(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, dir: number, frame: number,
  type: EnemyType, dying: number
) {
  if (dying > 15) return;
  ctx.save();
  ctx.globalAlpha = dying > 0 ? 1 - dying / 16 : 1;
  if (dir > 0) { ctx.translate(cx * 2 + 24, 0); ctx.scale(-1, 1); }
  const bob = [0, -1, 0, 1][frame % 4];
  const bx = cx, by = cy;

  if (type === 'heavy') {
    ctx.fillStyle = '#c0c0c0'; ctx.fillRect(bx + 2, by - 12 + bob, 9, 12); ctx.fillRect(bx + 15, by - 12 + bob, 9, 12);
    ctx.fillStyle = '#888'; ctx.fillRect(bx + 1, by - 2 + bob, 10, 4); ctx.fillRect(bx + 15, by - 2 + bob, 10, 4);
    ctx.fillStyle = '#a0a0c0'; ctx.fillRect(bx, by - 26 + bob, 28, 15);
    ctx.fillStyle = '#c0c0e0'; ctx.fillRect(bx + 3, by - 25 + bob, 10, 5);
    ctx.fillStyle = '#777'; ctx.fillRect(bx - 6, by - 20 + bob, 10, 6); ctx.fillRect(bx - 12, by - 19 + bob, 8, 4);
    ctx.fillStyle = '#e0c090'; ctx.fillRect(bx + 1, by - 48 + bob, 26, 24); ctx.fillRect(bx + 3, by - 50 + bob, 22, 2); ctx.fillRect(bx + 3, by - 26 + bob, 22, 2);
    ctx.fillStyle = '#707070'; ctx.fillRect(bx + 2, by - 54 + bob, 24, 14);
    ctx.fillStyle = '#909090'; ctx.fillRect(bx + 5, by - 53 + bob, 14, 3);
    ctx.fillStyle = '#606060'; ctx.fillRect(bx + 4, by - 58 + bob, 4, 6); ctx.fillRect(bx + 20, by - 58 + bob, 4, 6);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + 4, by - 41 + bob, 8, 7); ctx.fillRect(bx + 16, by - 41 + bob, 8, 7);
    ctx.fillStyle = '#cc2222'; ctx.fillRect(bx + 5, by - 40 + bob, 5, 5); ctx.fillRect(bx + 17, by - 40 + bob, 5, 5);
    ctx.fillStyle = '#111'; ctx.fillRect(bx + 6, by - 39 + bob, 3, 3); ctx.fillRect(bx + 18, by - 39 + bob, 3, 3);
    ctx.fillStyle = '#555'; ctx.fillRect(bx + 4, by - 43 + bob, 8, 2); ctx.fillRect(bx + 16, by - 43 + bob, 8, 2);
    ctx.fillStyle = 'rgba(180,60,60,0.5)'; ctx.fillRect(bx + 2, by - 36 + bob, 5, 3); ctx.fillRect(bx + 21, by - 36 + bob, 5, 3);
    ctx.fillStyle = '#994422'; ctx.fillRect(bx + 8, by - 31 + bob, 12, 3);
  } else if (type === 'sniper') {
    ctx.fillStyle = '#445544'; ctx.fillRect(bx + 3, by - 10 + bob, 6, 10); ctx.fillRect(bx + 13, by - 10 + bob, 6, 10);
    ctx.fillStyle = '#223322'; ctx.fillRect(bx + 2, by - 2 + bob, 8, 4); ctx.fillRect(bx + 12, by - 2 + bob, 8, 4);
    ctx.fillStyle = '#334433'; ctx.fillRect(bx + 2, by - 22 + bob, 18, 13);
    ctx.fillStyle = '#666'; ctx.fillRect(bx + 18, by - 20 + bob, 14, 3); ctx.fillRect(bx + 22, by - 23 + bob, 2, 8);
    ctx.fillStyle = '#ddc090'; ctx.fillRect(bx, by - 44 + bob, 22, 22); ctx.fillRect(bx + 2, by - 46 + bob, 18, 2);
    ctx.fillStyle = '#2a3a2a'; ctx.fillRect(bx - 1, by - 50 + bob, 24, 10); ctx.fillRect(bx + 1, by - 52 + bob, 20, 4);
    ctx.fillStyle = '#3a4a3a'; ctx.fillRect(bx + 3, by - 51 + bob, 12, 2);
    ctx.fillStyle = '#334433'; ctx.fillRect(bx + 1, by - 33 + bob, 20, 12);
    ctx.fillStyle = '#223322'; ctx.fillRect(bx + 5, by - 30 + bob, 12, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + 3, by - 42 + bob, 7, 7); ctx.fillRect(bx + 12, by - 42 + bob, 7, 7);
    ctx.fillStyle = '#33aa33'; ctx.fillRect(bx + 4, by - 41 + bob, 5, 5); ctx.fillRect(bx + 13, by - 41 + bob, 5, 5);
    ctx.fillStyle = '#111'; ctx.fillRect(bx + 5, by - 40 + bob, 3, 3); ctx.fillRect(bx + 14, by - 40 + bob, 3, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + 4, by - 41 + bob, 2, 2); ctx.fillRect(bx + 13, by - 41 + bob, 2, 2);
  } else {
    ctx.fillStyle = '#b04040'; ctx.fillRect(bx + 3, by - 10 + bob, 7, 10); ctx.fillRect(bx + 13, by - 10 + bob, 7, 10);
    ctx.fillStyle = '#7a1a1a'; ctx.fillRect(bx + 2, by - 2 + bob, 9, 4); ctx.fillRect(bx + 12, by - 2 + bob, 9, 4);
    ctx.fillStyle = '#c05050'; ctx.fillRect(bx + 2, by - 22 + bob, 19, 13);
    ctx.fillStyle = '#e07070'; ctx.fillRect(bx + 4, by - 21 + bob, 7, 4);
    ctx.fillStyle = '#555'; ctx.fillRect(bx + 18, by - 18 + bob, 10, 4);
    ctx.fillStyle = '#777'; ctx.fillRect(bx + 26, by - 17 + bob, 6, 2);
    ctx.fillStyle = '#f0c080'; ctx.fillRect(bx - 1, by - 44 + bob, 25, 23); ctx.fillRect(bx + 1, by - 46 + bob, 21, 2); ctx.fillRect(bx + 1, by - 23 + bob, 21, 2);
    ctx.fillStyle = '#881a1a'; ctx.fillRect(bx, by - 50 + bob, 23, 12); ctx.fillRect(bx - 2, by - 46 + bob, 3, 6); ctx.fillRect(bx + 23, by - 46 + bob, 3, 6);
    ctx.fillStyle = '#aa3333'; ctx.fillRect(bx + 4, by - 49 + bob, 13, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + 7, by - 47 + bob, 9, 8);
    ctx.fillStyle = '#881a1a'; ctx.fillRect(bx + 8, by - 45 + bob, 3, 3); ctx.fillRect(bx + 13, by - 45 + bob, 3, 3); ctx.fillRect(bx + 9, by - 41 + bob, 7, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + 3, by - 40 + bob, 7, 7); ctx.fillRect(bx + 13, by - 40 + bob, 7, 7);
    ctx.fillStyle = '#dd4444'; ctx.fillRect(bx + 4, by - 39 + bob, 5, 5); ctx.fillRect(bx + 14, by - 39 + bob, 5, 5);
    ctx.fillStyle = '#111'; ctx.fillRect(bx + 5, by - 38 + bob, 3, 3); ctx.fillRect(bx + 15, by - 38 + bob, 3, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + 4, by - 39 + bob, 2, 2); ctx.fillRect(bx + 14, by - 39 + bob, 2, 2);
    ctx.fillStyle = '#662222'; ctx.fillRect(bx + 3, by - 42 + bob, 7, 2); ctx.fillRect(bx + 13, by - 42 + bob, 7, 2);
    ctx.fillStyle = 'rgba(180,60,60,0.45)'; ctx.fillRect(bx + 1, by - 35 + bob, 5, 3); ctx.fillRect(bx + 17, by - 35 + bob, 5, 3);
    ctx.fillStyle = '#993322'; ctx.fillRect(bx + 7, by - 29 + bob, 9, 2); ctx.fillRect(bx + 6, by - 28 + bob, 2, 2); ctx.fillRect(bx + 15, by - 28 + bob, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── 메인 컴포넌트 ─────────────────────────────────────
export default function MetalSlugGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameState | null>(null);
  // HUD DOM refs (성능: React state 대신 직접 DOM 조작)
  const hudScore = useRef<HTMLSpanElement>(null);
  const hudHp    = useRef<HTMLSpanElement>(null);
  const hudGren  = useRef<HTMLSpanElement>(null);
  const hudWave  = useRef<HTMLSpanElement>(null);
  const hudKills = useRef<HTMLSpanElement>(null);
  const hudEnemy = useRef<HTMLSpanElement>(null);
  const gameoverRef = useRef<HTMLDivElement>(null);
  const goTitleRef  = useRef<HTMLDivElement>(null);
  const goScoreRef  = useRef<HTMLDivElement>(null);

  const startGame = useCallback(() => {
    const gs: GameState = {
      active: true, score: 0, wave: 1, kills: 0, camX: 0,
      player: mkPlayer(),
      enemies: [], bullets: [], enemyBullets: [],
      explosions: [], particles: [], grenades: [],
      pickups: buildPickups(), platforms: buildPlatforms(),
      spawnTimer: 0, spawnInterval: 80,
      waveEnemiesLeft: 0, waveBannerTimer: 0,
      keys: {}, frameId: 0,
    };
    gsRef.current = gs;
    if (gameoverRef.current) gameoverRef.current.style.display = 'none';

    // startWave 인라인
    gs.waveEnemiesLeft = 8 + gs.wave * 3;
    gs.spawnInterval = Math.max(25, 100 - gs.wave * 8);
    gs.spawnTimer = 60;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    function explode(x: number, y: number, r: number, dmg: number) {
      const g = gsRef.current!;
      g.explosions.push({ x, y, r, life: 20, maxLife: 20 });
      const cols = ['#ff8000', '#ffcc00', '#ff4444', '#ffffff', '#ff69b4'];
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
        g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 35, color: cols[Math.floor(Math.random() * 5)] });
      }
      const p = g.player;
      if (!p.invincible) {
        const dx = p.x - x, dy = (p.y - 20) - y;
        if (Math.sqrt(dx * dx + dy * dy) < r) { p.hp = Math.max(0, p.hp - dmg); p.invincible = 60; }
      }
      for (const e of g.enemies) {
        const dx = (e.x + e.w / 2) - x, dy = (e.y - e.h / 2) - y;
        if (Math.sqrt(dx * dx + dy * dy) < r && !e.dying) { e.hp -= dmg; if (e.hp <= 0) killEnemy(e); }
      }
    }

    function killEnemy(e: Enemy) {
      const g = gsRef.current!;
      if (e.dying) return;
      e.dying = 1; g.score += e.score * g.wave; g.kills++;
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        g.particles.push({ x: e.x + e.w / 2, y: e.y - e.h / 2, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 1, life: 28, color: '#ffcc00', isStar: true });
      }
    }

    function endGame(win = false) {
      const g = gsRef.current!;
      g.active = false;
      cancelAnimationFrame(g.frameId);
      if (gameoverRef.current) gameoverRef.current.style.display = 'flex';
      if (goTitleRef.current) goTitleRef.current.textContent = win ? 'MISSION COMPLETE ★' : 'MISSION FAILED ♥';
      if (goScoreRef.current) goScoreRef.current.textContent = `SCORE: ${g.score} | KILLS: ${g.kills} | WAVE: ${g.wave}`;
    }

    function loop() {
      const g = gsRef.current!;
      if (!g.active) return;
      g.frameId = requestAnimationFrame(loop);

      // ── update player ──
      const p = g.player;
      if (p.hp <= 0) { endGame(false); return; }
      if (p.invincible > 0) p.invincible--;
      p.crouching = !!g.keys['ArrowDown']; p.vx = 0;
      if (!p.crouching) {
        if (g.keys['ArrowLeft']) { p.vx = -3.4; p.dir = -1; }
        else if (g.keys['ArrowRight']) { p.vx = 3.4; p.dir = 1; }
      }
      if ((g.keys['ArrowUp'] || g.keys['z'] || g.keys['Z']) && p.onGround) { p.vy = -11; p.onGround = false; }
      p.vy += 0.6; p.x += p.vx; p.y += p.vy;
      p.x = Math.max(g.camX + 8, Math.min(p.x, g.camX + W - p.w - 8));
      p.onGround = checkOnGround(p, g.platforms);
      if (p.onGround) p.vy = 0;
      p.animTimer++; if (p.animTimer > 6) { p.animTimer = 0; p.animFrame = (p.animFrame + 1) % 4; }
      if (p.shootTimer > 0) p.shootTimer--;
      if ((g.keys['x'] || g.keys['X']) && p.shootTimer === 0) {
        const ay = p.crouching ? p.y - 10 : p.y - 22;
        g.bullets.push({ x: p.x + (p.dir > 0 ? p.w : 0), y: ay, vx: p.dir * 10, vy: 0, dmg: 1, life: 65 });
        p.shootTimer = 8; p.shooting = true;
        g.particles.push({ x: p.x + (p.dir > 0 ? p.w + 8 : 0), y: ay, vx: p.dir * 2 + (Math.random() - 0.5) * 2, vy: -1, life: 8, color: '#ffff80' });
      } else { p.shooting = false; }
      if ((g.keys['c'] || g.keys['C']) && p.grenades > 0) {
        g.keys['c'] = false; g.keys['C'] = false;
        g.grenades.push({ x: p.x + p.w / 2, y: p.y - 20, vx: p.dir * 5, vy: -8, life: 90 });
        p.grenades--;
      }
      for (const pk of g.pickups) {
        if (!pk.taken && Math.abs(p.x - pk.x) < 28 && Math.abs(p.y - pk.y) < 28) {
          pk.taken = true; pk.respawn = 900;
          if (pk.type === 'hp') p.hp = Math.min(p.maxHp, p.hp + 4);
          if (pk.type === 'grenade') p.grenades = Math.min(12, p.grenades + 3);
          for (let j = 0; j < 10; j++)
            g.particles.push({ x: pk.x, y: pk.y - 10, vx: (Math.random() - 0.5) * 5, vy: -3 - Math.random() * 3, life: 22, color: pk.type === 'hp' ? '#ff69b4' : '#80ff80' });
        }
        if (pk.taken && pk.respawn > 0) { pk.respawn--; if (pk.respawn <= 0) pk.taken = false; }
      }
      g.camX = Math.max(0, Math.min(p.x - 160, LEVEL_WIDTH - W));

      // ── update enemies ──
      for (let i = g.enemies.length - 1; i >= 0; i--) {
        const e = g.enemies[i];
        if (e.dying) { e.dying++; if (e.dying > 20) g.enemies.splice(i, 1); continue; }
        const dx = p.x - e.x;
        e.dir = dx < 0 ? -1 : 1; e.alert = Math.abs(dx) < 380;
        if (e.alert) { e.vx = e.dir * e.speed; if (Math.abs(dx) < 44) e.vx = 0; } else { e.vx = 0; }
        e.vy += 0.6; e.x += e.vx; e.y += e.vy;
        e.onGround = checkOnGround(e, g.platforms); if (e.onGround) e.vy = 0;
        e.animTimer++; if (e.animTimer > 7) { e.animTimer = 0; e.animFrame = (e.animFrame + 1) % 4; }
        e.fireTimer++;
        if (e.fireTimer >= e.fireRate && e.alert && Math.abs(dx) > 35) {
          e.fireTimer = 0;
          const speed = e.type === 'sniper' ? 8 : e.type === 'heavy' ? 4.5 : 5.5;
          g.enemyBullets.push({ x: e.x + e.w / 2, y: e.y - e.h * 0.55, vx: e.dir * speed, vy: 0, dmg: 1, life: 80 });
        }
      }

      // ── update bullets ──
      for (let i = g.bullets.length - 1; i >= 0; i--) {
        const b = g.bullets[i]; b.x += b.vx; b.life--;
        if (b.life <= 0 || b.x < g.camX - 20 || b.x > g.camX + W + 20) { g.bullets.splice(i, 1); continue; }
        let hit = false;
        for (const e of g.enemies) {
          if (!e.dying && b.x > e.x && b.x < e.x + e.w && b.y > e.y - e.h && b.y < e.y) {
            e.hp -= b.dmg;
            g.particles.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 3, vy: -2, life: 10, color: '#ffaa44' });
            if (e.hp <= 0) killEnemy(e);
            hit = true; break;
          }
        }
        if (hit) g.bullets.splice(i, 1);
      }
      for (let i = g.enemyBullets.length - 1; i >= 0; i--) {
        const b = g.enemyBullets[i]; b.x += b.vx; b.life--;
        if (b.life <= 0 || b.x < g.camX - 20 || b.x > g.camX + W + 20) { g.enemyBullets.splice(i, 1); continue; }
        if (!p.invincible && b.x > p.x && b.x < p.x + p.w && b.y > p.y - p.h && b.y < p.y) {
          p.hp = Math.max(0, p.hp - 1); p.invincible = 55; g.enemyBullets.splice(i, 1);
        }
      }

      // ── update grenades ──
      for (let i = g.grenades.length - 1; i >= 0; i--) {
        const gr = g.grenades[i]; gr.vx *= 0.96; gr.vy += 0.55; gr.x += gr.vx; gr.y += gr.vy; gr.life--;
        if (gr.y >= GROUND) { gr.y = GROUND; gr.vy = -gr.vy * 0.3; gr.vx *= 0.7; }
        if (gr.life <= 0) { explode(gr.x, gr.y, 80, 4); g.grenades.splice(i, 1); }
      }

      // ── update particles ──
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const pt = g.particles[i]; pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.15; pt.life--;
        if (pt.life <= 0) g.particles.splice(i, 1);
      }
      for (let i = g.explosions.length - 1; i >= 0; i--) {
        g.explosions[i].life--; if (g.explosions[i].life <= 0) g.explosions.splice(i, 1);
      }

      // ── spawn ──
      g.spawnTimer++;
      if (g.spawnTimer >= g.spawnInterval && g.waveEnemiesLeft > 0) {
        g.spawnTimer = 0;
        const sx = g.camX + W + 50 + Math.random() * 100;
        const r = Math.random();
        let type: EnemyType = 'soldier';
        if (g.wave >= 3 && r < 0.15 + g.wave * 0.02) type = 'heavy';
        else if (g.wave >= 2 && r < 0.35 + g.wave * 0.02) type = 'sniper';
        g.enemies.push(mkEnemy(Math.min(sx, LEVEL_WIDTH - 80), type, g.wave));
        g.waveEnemiesLeft--;
      }

      // ── wave check ──
      if (g.waveEnemiesLeft <= 0 && g.enemies.filter(e => !e.dying).length === 0) {
        g.wave++;
        if (g.wave > 20) { endGame(true); return; }
        g.score += g.wave * 800;
        g.waveBannerTimer = 120;
        g.waveEnemiesLeft = -999;
        setTimeout(() => {
          const gs2 = gsRef.current;
          if (!gs2 || !gs2.active) return;
          gs2.waveEnemiesLeft = 8 + gs2.wave * 3;
          gs2.spawnInterval = Math.max(25, 100 - gs2.wave * 8);
          gs2.spawnTimer = 60;
        }, 3000);
      }

      // ── draw ──
      // bg
      ctx.fillStyle = COLORS.sky; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 15; i++) {
        const sx = ((i * 47 - g.camX * 0.05) % (W + 20));
        ctx.fillStyle = 'rgba(255,255,200,0.7)'; ctx.fillRect(sx, 15 + i % 4 * 12, 2, 2);
      }
      for (let i = 0; i < 6; i++) {
        const bx = ((i * 220 - g.camX * 0.15) % (W + 200)) - 40;
        ctx.fillStyle = '#1a0e30'; ctx.fillRect(bx, 80 + i % 2 * 20, 60 + i * 8, 140);
        ctx.fillStyle = '#251545'; ctx.fillRect(bx + 8, 85 + i % 2 * 20, 10, 120);
        ctx.fillStyle = 'rgba(255,240,100,0.4)';
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
          if ((i + r + c) % 3 !== 0) ctx.fillRect(bx + 6 + c * 14, 90 + i % 2 * 20 + r * 20, 8, 10);
      }
      for (let i = 0; i < 5; i++) {
        const tx = ((i * 180 - g.camX * 0.4) % (W + 160)) - 20;
        ctx.fillStyle = '#3a2010'; ctx.fillRect(tx + 12, GROUND - 90, 8, 90);
        ctx.fillStyle = '#2a5a15'; ctx.fillRect(tx, GROUND - 130, 32, 50); ctx.fillRect(tx + 4, GROUND - 155, 24, 35); ctx.fillRect(tx + 8, GROUND - 172, 16, 25);
      }
      ctx.fillStyle = COLORS.ground; ctx.fillRect(0, GROUND + 2, W, H - GROUND - 2);
      ctx.fillStyle = COLORS.groundTop; ctx.fillRect(0, GROUND, W, 4);
      for (let i = 0; i < 34; i++) {
        const tx = ((i * 22 - g.camX) % (W + 22));
        ctx.fillStyle = i % 2 === 0 ? '#5a3a18' : '#4a2e10'; ctx.fillRect(tx, GROUND + 4, 20, 8);
      }

      // platforms
      for (const pl of g.platforms) {
        const sx = pl.x - g.camX; if (sx > W + 50 || sx < -pl.w - 20) continue;
        ctx.fillStyle = COLORS.platform; ctx.fillRect(sx, pl.y, pl.w, pl.h);
        ctx.fillStyle = COLORS.platformTop; ctx.fillRect(sx, pl.y, pl.w, 4);
        for (let i = 0; i < pl.w; i += 16) { ctx.fillStyle = '#2a1808'; ctx.fillRect(sx + i, pl.y + 5, 14, 8); }
      }

      // pickups
      for (const pk of g.pickups) {
        if (pk.taken) continue;
        const sx = pk.x - g.camX; if (sx < -20 || sx > W + 20) continue;
        const bob = Math.sin(Date.now() / 350) * 4;
        if (pk.type === 'grenade') {
          ctx.fillStyle = '#40cc40'; ctx.beginPath(); ctx.arc(sx, pk.y - 14 + bob, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffcc00'; ctx.fillRect(sx - 1, pk.y - 26 + bob, 2, 10);
          ctx.fillStyle = '#fff'; ctx.fillRect(sx - 6, pk.y - 12 + bob, 4, 4); ctx.fillRect(sx + 2, pk.y - 12 + bob, 4, 4);
          ctx.fillStyle = '#111'; ctx.fillRect(sx - 5, pk.y - 11 + bob, 2, 2); ctx.fillRect(sx + 3, pk.y - 11 + bob, 2, 2);
        } else {
          ctx.fillStyle = '#ff4488';
          ctx.beginPath(); ctx.moveTo(sx, pk.y - 6 + bob);
          ctx.bezierCurveTo(sx, pk.y - 16 + bob, sx - 14, pk.y - 16 + bob, sx - 14, pk.y - 8 + bob);
          ctx.bezierCurveTo(sx - 14, pk.y + bob, sx, pk.y + 8 + bob, sx, pk.y + 8 + bob);
          ctx.bezierCurveTo(sx, pk.y + 8 + bob, sx + 14, pk.y + bob, sx + 14, pk.y - 8 + bob);
          ctx.bezierCurveTo(sx + 14, pk.y - 16 + bob, sx, pk.y - 16 + bob, sx, pk.y - 6 + bob);
          ctx.fill();
        }
      }

      // particles
      for (const pt of g.particles) {
        ctx.globalAlpha = pt.life / 35;
        if (pt.isStar) {
          ctx.fillStyle = pt.color; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('★', pt.x - g.camX, pt.y);
        } else {
          ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x - g.camX, pt.y, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1; ctx.textAlign = 'left';

      // explosions
      for (const ex of g.explosions) {
        const t = 1 - ex.life / ex.maxLife;
        ctx.globalAlpha = 0.75 * (1 - t);
        const er = ex.r * (0.3 + t * 0.7);
        ctx.fillStyle = ['#ff8000', '#ffcc00', '#ff4444'][Math.floor(t * 3) % 3];
        ctx.beginPath(); ctx.arc(ex.x - g.camX, ex.y, er, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // bullets
      for (const b of g.bullets) {
        const sx = b.x - g.camX;
        ctx.fillStyle = '#ffff60'; ctx.beginPath(); ctx.arc(sx, b.y, 4, 0, Math.PI * 2); ctx.fill();
      }
      for (const b of g.enemyBullets) {
        const sx = b.x - g.camX;
        ctx.fillStyle = '#ff6060'; ctx.beginPath(); ctx.arc(sx, b.y, 3, 0, Math.PI * 2); ctx.fill();
      }
      for (const gr of g.grenades) {
        const sx = gr.x - g.camX;
        ctx.fillStyle = '#80ff80'; ctx.beginPath(); ctx.arc(sx, gr.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffff00'; ctx.fillRect(sx - 1, gr.y - 8, 2, 6);
      }

      // enemies
      for (const e of g.enemies) {
        const sx = e.x - g.camX; if (sx < -60 || sx > W + 60) continue;
        if (!e.dying && e.hp < e.hp_max) {
          ctx.fillStyle = '#400'; ctx.fillRect(sx, e.y - e.h - 10, e.w, 4);
          ctx.fillStyle = '#f00'; ctx.fillRect(sx, e.y - e.h - 10, e.w * (e.hp / e.hp_max), 4);
        }
        drawSDEnemy(ctx, sx, e.y, e.dir, e.animFrame, e.type, e.dying);
      }

      // player
      drawSDPlayer(ctx, p.x - g.camX, p.y, p.dir, p.animFrame, p.crouching, p.shooting, p.invincible);

      // HUD (DOM 직접 업데이트)
      if (hudScore.current) hudScore.current.textContent = String(g.score);
      if (hudHp.current) hudHp.current.textContent = '♥'.repeat(p.hp) + '♡'.repeat(Math.max(0, p.maxHp - p.hp));
      if (hudGren.current) hudGren.current.textContent = String(p.grenades) + '개';
      if (hudWave.current) hudWave.current.textContent = String(g.wave);
      if (hudKills.current) hudKills.current.textContent = String(g.kills);
      if (hudEnemy.current) hudEnemy.current.textContent = String(g.enemies.filter(e => !e.dying).length + Math.max(0, g.waveEnemiesLeft));

      // wave banner
      if (g.waveBannerTimer > 0) {
        g.waveBannerTimer--;
        ctx.globalAlpha = Math.min(1, g.waveBannerTimer / 20);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 140, H / 2 - 30, 280, 60);
        ctx.fillStyle = '#f0e060'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
        ctx.fillText('WAVE CLEAR! ★', W / 2, H / 2 + 2);
        ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
        ctx.fillText('WAVE ' + g.wave + ' START', W / 2, H / 2 + 24);
        ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      }
    }

    loop();
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const g = gsRef.current;
      if (!g) return;
      g.keys[e.key] = true;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => {
      const g = gsRef.current;
      if (!g) return;
      g.keys[e.key] = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    startGame();
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      if (gsRef.current) cancelAnimationFrame(gsRef.current.frameId);
    };
  }, [startGame]);

  return (
    <div style={{ fontFamily: 'monospace', background: '#0d0820', display: 'inline-block' }}>
      {/* HUD */}
      <div style={{
        display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
        background: '#111', padding: '6px 12px',
        borderBottom: '2px solid #f0e060', fontSize: 13, color: '#f0e060',
      }}>
        {([
          ['SCORE', hudScore], ['HP', hudHp], ['GRENADE', hudGren],
          ['WAVE', hudWave], ['KILLS', hudKills], ['ENEMIES', hudEnemy],
        ] as [string, React.RefObject<HTMLSpanElement>][]).map(([label, ref]) => (
          <span key={label}>
            <span style={{ color: '#f0e060' }}>{label} </span>
            <span ref={ref} style={{ color: '#fff' }}>-</span>
          </span>
        ))}
      </div>

      {/* Canvas + Gameover overlay */}
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', imageRendering: 'pixelated' }} />
        <div
          ref={gameoverRef}
          style={{
            display: 'none', position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12,
            color: '#f0e060', fontSize: 22, letterSpacing: 2,
          }}
        >
          <div ref={goTitleRef}>MISSION FAILED</div>
          <div ref={goScoreRef} style={{ fontSize: 14, color: '#fff' }} />
          <button
            onClick={startGame}
            style={{
              fontFamily: 'monospace', fontSize: 14, background: '#f0e060',
              color: '#111', border: 'none', padding: '8px 24px', cursor: 'pointer', marginTop: 8,
            }}
          >
            INSERT COIN ♥
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap',
        background: '#1a1a1a', padding: '6px 12px',
        borderTop: '1px solid #333', fontSize: 11, color: '#888',
      }}>
        {['← → 이동', '↑ / Z 점프', 'X 사격', '↓ 웅크리기', 'C 수류탄'].map(t => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}
