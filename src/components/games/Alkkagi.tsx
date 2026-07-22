import { useEffect, useMemo, useRef, useState } from 'react';
import { AlkkagiGameData, AlkkagiStone, StudyMoveRequest, StudyStateResponse } from '../../types';

interface Props {
  studyState: StudyStateResponse | null;
  myPlayerIndex: number;
  sessionId: string;
  sendMove: (req: StudyMoveRequest) => void;
}

interface SimStone extends AlkkagiStone {
  vx: number;
  vy: number;
}

interface VisualEffect {
  id: number;
  x: number;
  y: number;
  type: 'hit' | 'out' | 'launch' | 'heavy';
  life: number;
  maxLife: number;
  color: string;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

const BOARD_W = 1200;
const BOARD_H = 660;
const STONE_R = 15;
const MAX_PULL = 230;
const POWER = 0.12;
const FRICTION = 0.972;
const STOP_SPEED = 0.16;
const VIEW_SCALE = 0.82;
const COLLISION_PASSES = 2;
const MAX_SIM_FRAMES = 900;
const PLAYER_COLORS = ['#4ec9b0', '#ce9178', '#9cdcfe'];
const PLAYER_FILLS = ['#d4d4d4', '#111111', '#2d4f67'];

type MapType = NonNullable<AlkkagiGameData['mapType']>;

const OBSTACLES: Record<MapType, Array<{ x: number; y: number; r: number }>> = {
  CLASSIC: [],
  CENTER_HOLE: [],
  CORNER_HOLES: [],
  SIDE_POCKETS: [],
  PILLARS: [
    { x: BOARD_W * 0.46, y: BOARD_H * 0.34, r: 36 },
    { x: BOARD_W * 0.54, y: BOARD_H * 0.66, r: 36 },
  ],
  BUMPER_FIELD: [
    { x: BOARD_W * 0.36, y: BOARD_H * 0.34, r: 32 },
    { x: BOARD_W * 0.50, y: BOARD_H * 0.50, r: 44 },
    { x: BOARD_W * 0.64, y: BOARD_H * 0.66, r: 32 },
  ],
  PINBALL: [
    { x: BOARD_W * 0.36, y: BOARD_H * 0.28, r: 30 },
    { x: BOARD_W * 0.64, y: BOARD_H * 0.28, r: 30 },
    { x: BOARD_W * 0.42, y: BOARD_H * 0.58, r: 36 },
    { x: BOARD_W * 0.58, y: BOARD_H * 0.58, r: 36 },
  ],
  NARROW_BRIDGE: [
    { x: BOARD_W * 0.50, y: BOARD_H * 0.27, r: 42 },
    { x: BOARD_W * 0.50, y: BOARD_H * 0.73, r: 42 },
  ],
  RIVER: [
    { x: BOARD_W * 0.26, y: BOARD_H * 0.50, r: 32 },
    { x: BOARD_W * 0.74, y: BOARD_H * 0.50, r: 32 },
  ],
  ICE_SAND: [],
  ELASTIC_WALLS: [
    { x: BOARD_W * 0.26, y: BOARD_H * 0.28, r: 30 },
    { x: BOARD_W * 0.74, y: BOARD_H * 0.28, r: 30 },
    { x: BOARD_W * 0.30, y: BOARD_H * 0.72, r: 34 },
    { x: BOARD_W * 0.70, y: BOARD_H * 0.72, r: 34 },
  ],
  MAGNET_FIELD: [
    { x: BOARD_W * 0.50, y: BOARD_H * 0.50, r: 34 },
  ],
  DONUT_RING: [],
  OFFICE_DESK: [
    { x: BOARD_W * 0.38, y: BOARD_H * 0.34, r: 38 },
    { x: BOARD_W * 0.62, y: BOARD_H * 0.36, r: 28 },
    { x: BOARD_W * 0.50, y: BOARD_H * 0.68, r: 44 },
  ],
};

const HOLES: Partial<Record<MapType, Array<{ x: number; y: number; r: number }>>> = {
  CENTER_HOLE: [{ x: BOARD_W / 2, y: BOARD_H / 2, r: 52 }],
  CORNER_HOLES: [
    { x: BOARD_W * 0.10, y: BOARD_H * 0.12, r: 48 },
    { x: BOARD_W * 0.90, y: BOARD_H * 0.12, r: 48 },
    { x: BOARD_W * 0.10, y: BOARD_H * 0.88, r: 48 },
    { x: BOARD_W * 0.90, y: BOARD_H * 0.88, r: 48 },
  ],
  SIDE_POCKETS: [
    { x: BOARD_W * 0.06, y: BOARD_H * 0.50, r: 52 },
    { x: BOARD_W * 0.94, y: BOARD_H * 0.50, r: 52 },
    { x: BOARD_W * 0.50, y: BOARD_H * 0.08, r: 42 },
    { x: BOARD_W * 0.50, y: BOARD_H * 0.92, r: 42 },
  ],
};

const SURFACE_ZONES: Partial<Record<MapType, Array<{ x: number; y: number; w: number; h: number; type: 'ice' | 'sand' }>>> = {
  ICE_SAND: [
    { x: 18, y: BOARD_H * 0.18, w: BOARD_W * 0.42, h: BOARD_H * 0.28, type: 'ice' },
    { x: BOARD_W * 0.58, y: BOARD_H * 0.54, w: BOARD_W * 0.40 - 18, h: BOARD_H * 0.28, type: 'sand' },
  ],
};

const MAGNETS: Partial<Record<MapType, Array<{ x: number; y: number; r: number; strength: number }>>> = {
  MAGNET_FIELD: [
    { x: BOARD_W * 0.50, y: BOARD_H * 0.50, r: 250, strength: 0.42 },
    { x: BOARD_W * 0.22, y: BOARD_H * 0.50, r: 150, strength: -0.22 },
    { x: BOARD_W * 0.78, y: BOARD_H * 0.50, r: 150, strength: -0.22 },
  ],
};

function toSim(stones: AlkkagiStone[]): SimStone[] {
  return stones.map(stone => ({ ...stone, vx: 0, vy: 0 }));
}

function speed(stone: SimStone) {
  return Math.hypot(stone.vx, stone.vy);
}

function clampPull(dx: number, dy: number) {
  const dist = Math.hypot(dx, dy);
  if (dist <= MAX_PULL) return { dx, dy, dist };
  const scale = MAX_PULL / dist;
  return { dx: dx * scale, dy: dy * scale, dist: MAX_PULL };
}

export default function Alkkagi({ studyState, myPlayerIndex, sessionId, sendMove }: Props) {
  const game = studyState?.gameData as AlkkagiGameData | null | undefined;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stonesRef = useRef<SimStone[]>([]);
  const animRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const playedShotRef = useRef<number>(0);
  const effectsRef = useRef<VisualEffect[]>([]);
  const effectSeqRef = useRef(0);
  const trailRef = useRef<TrailPoint[]>([]);
  const shakeRef = useRef(0);
  const [stones, setStones] = useState<SimStone[]>([]);
  const [drag, setDrag] = useState<{ id: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [size, setSize] = useState({ width: BOARD_W, height: BOARD_H });

  const isMyTurn = game?.currentTurn === myPlayerIndex && studyState?.status === 'PLAYING' && !moving && !game?.activeShot;
  const playerNames = studyState?.playerNames ?? [];
  const currentName = game ? playerNames[game.currentTurn] ?? `P${game.currentTurn + 1}` : '';
  const myColor = playerColor(myPlayerIndex);
  const mapType: MapType = game?.mapType ?? 'CLASSIC';

  useEffect(() => {
    if (!game || game.activeShot) return;
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    const next = toSim(game.stones ?? []);
    stonesRef.current = next;
    setStones(next);
    setMoving(false);
  }, [game?.shotCount, game?.currentTurn, game?.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!game?.activeShot || playedShotRef.current === game.activeShot.id) return;
    playedShotRef.current = game.activeShot.id;
    const next = toSim(game.stones ?? []);
    const stone = next.find(s => s.id === game.activeShot?.stoneId);
    if (!stone || !stone.active) return;
    stone.vx = game.activeShot.vx;
    stone.vy = game.activeShot.vy;
    stonesRef.current = next;
    setStones(next);
    setMoving(true);
    effectsRef.current = [];
    trailRef.current = [];
    addEffect(stone.x * BOARD_W, stone.y * BOARD_H, 'launch', playerColor(stone.owner));
    addShake(Math.min(7, Math.hypot(stone.vx, stone.vy) * 0.18));
    runSimulation(game.activeShot.id, game.activeShot.playerIndex, true);
  }, [game?.activeShot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const updateSize = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(720, rect.width - 2);
      const height = Math.max(420, rect.height - 2);
      const scale = Math.min(width / BOARD_W, height / BOARD_H) * VIEW_SCALE;
      setSize({ width: Math.floor(BOARD_W * scale), height: Math.floor(BOARD_H * scale) });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (wrapRef.current) observer.observe(wrapRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const scale = useMemo(() => size.width / BOARD_W, [size.width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.floor(size.width * window.devicePixelRatio);
    canvas.height = Math.floor(size.height * window.devicePixelRatio);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    draw();
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    draw();
  }, [stones, drag, size, studyState?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
  }, []);

  function boardPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    };
  }

  function findStone(x: number, y: number) {
    return stonesRef.current.find(stone =>
      stone.active &&
      stone.owner === myPlayerIndex &&
      Math.hypot(stone.x * BOARD_W - x, stone.y * BOARD_H - y) <= STONE_R + 16
    );
  }

  function playerColor(owner: number) {
    return PLAYER_COLORS[owner % PLAYER_COLORS.length] ?? PLAYER_COLORS[0];
  }

  function playerFill(owner: number) {
    return PLAYER_FILLS[owner % PLAYER_FILLS.length] ?? PLAYER_FILLS[0];
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isMyTurn) return;
    const point = boardPoint(event);
    const stone = findStone(point.x, point.y);
    if (!stone) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDrag = {
      id: stone.id,
      startX: stone.x * BOARD_W,
      startY: stone.y * BOARD_H,
      x: stone.x * BOARD_W,
      y: stone.y * BOARD_H,
    };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const current = dragRef.current;
    if (!current) return;
    const point = boardPoint(event);
    const nextDrag = { ...current, x: point.x, y: point.y };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function handlePointerUp() {
    const current = dragRef.current;
    dragRef.current = null;
    if (!current || !game) {
      setDrag(null);
      return;
    }
    const stone = stonesRef.current.find(s => s.id === current.id);
    if (!stone) {
      setDrag(null);
      return;
    }
    const pull = clampPull(current.x - current.startX, current.y - current.startY);
    setDrag(null);
    if (pull.dist < 8) return;

    sendMove({
      moveType: 'ALKKAGI_AIM',
      data: '',
      sessionId,
      payload: {
        stoneId: stone.id,
        vx: -pull.dx * POWER,
        vy: -pull.dy * POWER,
      },
    });
  }

  function addEffect(x: number, y: number, type: VisualEffect['type'], color: string) {
    const life = type === 'out' ? 34 : type === 'launch' ? 18 : type === 'heavy' ? 24 : 16;
    effectsRef.current = [
      ...effectsRef.current,
      { id: effectSeqRef.current++, x, y, type, color, life, maxLife: life },
    ].slice(-24);
  }

  function addShake(amount: number) {
    shakeRef.current = Math.min(12, Math.max(shakeRef.current, amount));
  }

  function runSimulation(shotId: number, shooterIndex: number, confirmResult: boolean) {
    let quietFrames = 0;
    let frameCount = 0;
    const step = () => {
      const list = stonesRef.current;
      const maxSpeed = Math.max(0, ...list.filter(stone => stone.active).map(speed));
      const subSteps = Math.max(1, Math.min(5, Math.ceil(maxSpeed / (STONE_R * 0.45))));

      for (let subStep = 0; subStep < subSteps; subStep++) {
        for (const stone of list) {
          if (!stone.active) continue;
          applyMapForce(stone, subSteps);
          stone.x += (stone.vx / subSteps) / BOARD_W;
          stone.y += (stone.vy / subSteps) / BOARD_H;
          resolveObstacleCollision(stone);
          if (isOutOfPlay(stone)) {
            const px = stone.x * BOARD_W;
            const py = stone.y * BOARD_H;
            addEffect(Math.max(0, Math.min(BOARD_W, px)), Math.max(0, Math.min(BOARD_H, py)), 'out', playerColor(stone.owner));
            addShake(7);
            stone.active = false;
            stone.vx = 0;
            stone.vy = 0;
          }
        }
        for (let pass = 0; pass < COLLISION_PASSES; pass++) {
          resolveCollisions(list);
        }
      }

      for (const stone of list) {
        if (!stone.active) continue;
        const friction = surfaceFriction(stone);
        stone.vx *= friction;
        stone.vy *= friction;
        if (Math.abs(stone.vx) < 0.01) stone.vx = 0;
        if (Math.abs(stone.vy) < 0.01) stone.vy = 0;
      }

      effectsRef.current = effectsRef.current
        .map((effect) => ({ ...effect, life: effect.life - 1 }))
        .filter((effect) => effect.life > 0);
      shakeRef.current = Math.max(0, shakeRef.current * 0.78 - 0.05);
      const activeShotStone = game?.activeShot ? list.find(stone => stone.id === game.activeShot?.stoneId && stone.active) : null;
      if (activeShotStone && frameCount % 4 === 0 && speed(activeShotStone) > STOP_SPEED * 2) {
        trailRef.current = [
          ...trailRef.current.map(point => ({ ...point, life: point.life - 1 })).filter(point => point.life > 0),
          { x: activeShotStone.x * BOARD_W, y: activeShotStone.y * BOARD_H, life: 24 },
        ].slice(-28);
      } else {
        trailRef.current = trailRef.current.map(point => ({ ...point, life: point.life - 1 })).filter(point => point.life > 0);
      }
      const anyMoving = list.some(stone => stone.active && speed(stone) > STOP_SPEED);
      setStones([...list]);
      draw();

      frameCount++;
      if (anyMoving && frameCount < MAX_SIM_FRAMES) {
        quietFrames = 0;
        animRef.current = requestAnimationFrame(step);
      } else if (quietFrames < 8) {
        quietFrames++;
        animRef.current = requestAnimationFrame(step);
      } else {
        for (const stone of list) {
          stone.vx = 0;
          stone.vy = 0;
        }
        setMoving(false);
        if (confirmResult && shooterIndex === myPlayerIndex) {
          sendMove({
            moveType: 'ALKKAGI_RESULT',
            data: '',
            sessionId,
            payload: {
              shotId,
              stones: list.map(({ id, owner, x, y, active }) => ({
                id,
                owner,
                x: Math.round(x * 100000) / 100000,
                y: Math.round(y * 100000) / 100000,
                active,
              })),
            },
          });
        }
      }
    };
    animRef.current = requestAnimationFrame(step);
  }

  function isOutOfPlay(stone: SimStone) {
    const px = stone.x * BOARD_W;
    const py = stone.y * BOARD_H;
    if (px < -STONE_R || px > BOARD_W + STONE_R || py < -STONE_R || py > BOARD_H + STONE_R) return true;
    for (const hole of HOLES[mapType] ?? []) {
      if (Math.hypot(px - hole.x, py - hole.y) < hole.r - 4) return true;
    }
    if (mapType === 'NARROW_BRIDGE') {
      const inMiddle = px > BOARD_W * 0.38 && px < BOARD_W * 0.62;
      const inGap = py > BOARD_H * 0.33 && py < BOARD_H * 0.67;
      if (inMiddle && !inGap) return true;
    }
    if (mapType === 'RIVER') {
      const inRiver = py > BOARD_H * 0.42 && py < BOARD_H * 0.58;
      const onBridge =
        (px > BOARD_W * 0.36 && px < BOARD_W * 0.44) ||
        (px > BOARD_W * 0.56 && px < BOARD_W * 0.64);
      if (inRiver && !onBridge) return true;
    }
    if (mapType === 'DONUT_RING') {
      const distFromCenter = Math.hypot(px - BOARD_W * 0.50, py - BOARD_H * 0.50);
      if (distFromCenter < 126) return true;
    }
    return false;
  }

  function applyMapForce(stone: SimStone, subSteps: number) {
    const px = stone.x * BOARD_W;
    const py = stone.y * BOARD_H;
    for (const magnet of MAGNETS[mapType] ?? []) {
      const dx = magnet.x - px;
      const dy = magnet.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist < 1 || dist > magnet.r) continue;
      const pull = (1 - dist / magnet.r) * magnet.strength / subSteps;
      stone.vx += (dx / dist) * pull;
      stone.vy += (dy / dist) * pull;
    }
  }

  function surfaceFriction(stone: SimStone) {
    const px = stone.x * BOARD_W;
    const py = stone.y * BOARD_H;
    for (const zone of SURFACE_ZONES[mapType] ?? []) {
      const inside = px >= zone.x && px <= zone.x + zone.w && py >= zone.y && py <= zone.y + zone.h;
      if (!inside) continue;
      return zone.type === 'ice' ? 0.987 : 0.885;
    }
    return FRICTION;
  }

  function resolveObstacleCollision(stone: SimStone) {
    const obstacles = OBSTACLES[mapType] ?? [];
    for (const obstacle of obstacles) {
      const px = stone.x * BOARD_W;
      const py = stone.y * BOARD_H;
      let dx = px - obstacle.x;
      let dy = py - obstacle.y;
      let dist = Math.hypot(dx, dy);
      const minDist = obstacle.r + STONE_R;
      if (dist >= minDist) continue;
      if (dist <= 0.001) {
        dx = 1;
        dy = 0;
        dist = 1;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      stone.x += (nx * overlap) / BOARD_W;
      stone.y += (ny * overlap) / BOARD_H;
      const vn = stone.vx * nx + stone.vy * ny;
      if (vn < 0) {
        const bounce = mapType === 'ELASTIC_WALLS' ? 2.22 : mapType === 'OFFICE_DESK' ? 1.68 : 1.82;
        stone.vx -= bounce * vn * nx;
        stone.vy -= bounce * vn * ny;
        const impact = Math.abs(vn);
        addEffect(obstacle.x + nx * obstacle.r, obstacle.y + ny * obstacle.r, impact > 7 ? 'heavy' : 'hit', '#9cdcfe');
        if (impact > 5) addShake(Math.min(9, impact * 0.6));
      }
    }
  }

  function resolveCollisions(list: SimStone[]) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.active) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.active) continue;
        const ax = a.x * BOARD_W;
        const ay = a.y * BOARD_H;
        const bx = b.x * BOARD_W;
        const by = b.y * BOARD_H;
        let dx = bx - ax;
        let dy = by - ay;
        let dist = Math.hypot(dx, dy);
        const minDist = STONE_R * 2;
        if (dist >= minDist) continue;
        if (dist <= 0.001) {
          dx = 1;
          dy = 0;
          dist = 1;
        }

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2;
        a.x -= (nx * overlap) / BOARD_W;
        a.y -= (ny * overlap) / BOARD_H;
        b.x += (nx * overlap) / BOARD_W;
        b.y += (ny * overlap) / BOARD_H;

        const tx = -ny;
        const ty = nx;
        const vaN = a.vx * nx + a.vy * ny;
        const vbN = b.vx * nx + b.vy * ny;
        const vaT = a.vx * tx + a.vy * ty;
        const vbT = b.vx * tx + b.vy * ty;
        const bounce = 0.94;
        const impact = Math.abs(vaN - vbN);
        if (impact > 1.4) {
          addEffect((ax + bx) / 2, (ay + by) / 2, impact > 8 ? 'heavy' : 'hit', '#dcdcaa');
          if (impact > 6) addShake(Math.min(10, impact * 0.5));
        }
        if (vaN > vbN) {
          a.vx = (vbN * nx + vaT * tx) * bounce;
          a.vy = (vbN * ny + vaT * ty) * bounce;
          b.vx = (vaN * nx + vbT * tx) * bounce;
          b.vy = (vaN * ny + vbT * ty) * bounce;
        }
        dist = minDist;
        dx = nx * dist;
        dy = ny * dist;
      }
    }
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shake = shakeRef.current;
    const shakeX = shake > 0.1 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0.1 ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(
      scale * window.devicePixelRatio,
      0,
      0,
      scale * window.devicePixelRatio,
      shakeX * scale * window.devicePixelRatio,
      shakeY * scale * window.devicePixelRatio
    );

    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(18, 18, BOARD_W - 36, BOARD_H - 36);
    ctx.strokeStyle = '#3e3e42';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, BOARD_W - 36, BOARD_H - 36);
    drawMap(ctx);
    drawTrail(ctx);

    ctx.strokeStyle = '#2b2b2f';
    ctx.lineWidth = 1;
    for (let x = 90; x < BOARD_W; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, BOARD_H - 18);
      ctx.stroke();
    }
    for (let y = 70; y < BOARD_H; y += 70) {
      ctx.beginPath();
      ctx.moveTo(18, y);
      ctx.lineTo(BOARD_W - 18, y);
      ctx.stroke();
    }

    for (const stone of stonesRef.current) {
      if (!stone.active) continue;
      drawStone(ctx, stone, drag?.id === stone.id);
    }

    for (const effect of effectsRef.current) {
      drawEffect(ctx, effect);
    }

    if (drag) {
      const stone = stonesRef.current.find(s => s.id === drag.id);
      if (stone?.active) {
        const sx = stone.x * BOARD_W;
        const sy = stone.y * BOARD_H;
        const pull = clampPull(drag.x - sx, drag.y - sy);
        const powerRatio = pull.dist / MAX_PULL;
        const powerColor = powerRatio > 0.82 ? '#f14c4c' : powerRatio > 0.48 ? '#dcdcaa' : myColor;

        ctx.fillStyle = 'rgba(30,30,30,.72)';
        ctx.fillRect(sx - 58, sy - 46, 116, 8);
        ctx.fillStyle = powerColor;
        ctx.fillRect(sx - 58, sy - 46, 116 * powerRatio, 8);
        ctx.strokeStyle = 'rgba(255,255,255,.22)';
        ctx.strokeRect(sx - 58, sy - 46, 116, 8);
      }
    }

    if (game?.winner != null && game.winner >= 0) {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(0, 0, BOARD_W, BOARD_H);
      ctx.fillStyle = '#4ec9b0';
      ctx.font = '700 42px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${playerNames[game.winner] ?? `P${game.winner + 1}`} wins`, BOARD_W / 2, BOARD_H / 2);
    }
  }

  function drawMap(ctx: CanvasRenderingContext2D) {
    drawSpecialMapAreas(ctx);
    for (const hole of HOLES[mapType] ?? []) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, .85)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(0, 0, 0, .45)';
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, hole.r + 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const gradient = ctx.createRadialGradient(hole.x, hole.y, 4, hole.x, hole.y, hole.r);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(0.62, '#020202');
      gradient.addColorStop(1, 'rgba(120, 18, 18, .32)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#f14c4c';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.setLineDash([14, 10]);
      ctx.strokeStyle = 'rgba(241, 76, 76, .55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, hole.r + 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawMapLabel(ctx, hole.x, hole.y + hole.r + 28, 'HOLE', '#f14c4c');
    }
    if (mapType === 'RIVER') {
      ctx.fillStyle = 'rgba(86, 156, 214, .16)';
      ctx.fillRect(18, BOARD_H * 0.42, BOARD_W - 36, BOARD_H * 0.16);
      ctx.strokeStyle = 'rgba(86, 156, 214, .34)';
      ctx.setLineDash([12, 9]);
      ctx.strokeRect(18, BOARD_H * 0.42, BOARD_W - 36, BOARD_H * 0.16);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(106, 153, 85, .20)';
      ctx.fillRect(BOARD_W * 0.36, BOARD_H * 0.42, BOARD_W * 0.08, BOARD_H * 0.16);
      ctx.fillRect(BOARD_W * 0.56, BOARD_H * 0.42, BOARD_W * 0.08, BOARD_H * 0.16);
      ctx.strokeStyle = 'rgba(106, 153, 85, .50)';
      ctx.strokeRect(BOARD_W * 0.36, BOARD_H * 0.42, BOARD_W * 0.08, BOARD_H * 0.16);
      ctx.strokeRect(BOARD_W * 0.56, BOARD_H * 0.42, BOARD_W * 0.08, BOARD_H * 0.16);
      drawMapLabel(ctx, BOARD_W * 0.50, BOARD_H * 0.50, 'DROP ZONE', '#569cd6');
    }
    for (const obstacle of OBSTACLES[mapType] ?? []) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, .45)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = 7;
      ctx.shadowOffsetY = 9;

      const gradient = ctx.createRadialGradient(obstacle.x - obstacle.r * 0.35, obstacle.y - obstacle.r * 0.42, 4, obstacle.x, obstacle.y, obstacle.r);
      gradient.addColorStop(0, '#74777d');
      gradient.addColorStop(0.48, '#3e4249');
      gradient.addColorStop(1, '#17191d');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(obstacle.x, obstacle.y, obstacle.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = mapType === 'PINBALL' || mapType === 'ELASTIC_WALLS' ? '#dcdcaa' : '#9cdcfe';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, .20)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(obstacle.x - obstacle.r * 0.12, obstacle.y - obstacle.r * 0.14, obstacle.r * 0.62, Math.PI * 1.05, Math.PI * 1.72);
      ctx.stroke();
      ctx.restore();
      const obstacleLabel = mapType === 'MAGNET_FIELD' ? 'MAGNET' : mapType === 'OFFICE_DESK' ? 'DESK ITEM' : mapType === 'ELASTIC_WALLS' ? 'BOUNCE' : 'WALL';
      const obstacleColor = mapType === 'PINBALL' || mapType === 'ELASTIC_WALLS' ? '#dcdcaa' : mapType === 'MAGNET_FIELD' ? '#c586c0' : '#9cdcfe';
      drawMapLabel(ctx, obstacle.x, obstacle.y + obstacle.r + 24, obstacleLabel, obstacleColor);
    }
    if (mapType === 'NARROW_BRIDGE') {
      ctx.fillStyle = 'rgba(244, 76, 76, .10)';
      ctx.fillRect(BOARD_W * 0.38, 18, BOARD_W * 0.24, BOARD_H * 0.27 - 18);
      ctx.fillRect(BOARD_W * 0.38, BOARD_H * 0.73, BOARD_W * 0.24, BOARD_H * 0.27 - 18);
      ctx.strokeStyle = 'rgba(244, 76, 76, .28)';
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(BOARD_W * 0.38, 18, BOARD_W * 0.24, BOARD_H * 0.27 - 18);
      ctx.strokeRect(BOARD_W * 0.38, BOARD_H * 0.73, BOARD_W * 0.24, BOARD_H * 0.27 - 18);
      ctx.setLineDash([]);
      drawMapLabel(ctx, BOARD_W * 0.50, BOARD_H * 0.18, 'DROP ZONE', '#f14c4c');
      drawMapLabel(ctx, BOARD_W * 0.50, BOARD_H * 0.84, 'DROP ZONE', '#f14c4c');
    }
    ctx.fillStyle = '#858585';
    ctx.font = '700 18px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(mapType.toLowerCase(), 30, 42);
  }

  function drawSpecialMapAreas(ctx: CanvasRenderingContext2D) {
    for (const zone of SURFACE_ZONES[mapType] ?? []) {
      ctx.save();
      ctx.fillStyle = zone.type === 'ice' ? 'rgba(86, 156, 214, .18)' : 'rgba(206, 145, 120, .18)';
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.strokeStyle = zone.type === 'ice' ? 'rgba(86, 156, 214, .58)' : 'rgba(206, 145, 120, .58)';
      ctx.lineWidth = 3;
      ctx.setLineDash(zone.type === 'ice' ? [16, 8] : [5, 8]);
      ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
      ctx.setLineDash([]);
      drawMapLabel(ctx, zone.x + zone.w / 2, zone.y + zone.h / 2, zone.type === 'ice' ? 'ICE' : 'SAND', zone.type === 'ice' ? '#569cd6' : '#ce9178');
      ctx.restore();
    }

    for (const magnet of MAGNETS[mapType] ?? []) {
      ctx.save();
      ctx.strokeStyle = magnet.strength > 0 ? 'rgba(197, 134, 192, .36)' : 'rgba(244, 76, 76, .28)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(magnet.x, magnet.y, magnet.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (mapType === 'DONUT_RING') {
      const cx = BOARD_W * 0.50;
      const cy = BOARD_H * 0.50;
      ctx.save();
      ctx.fillStyle = 'rgba(244, 76, 76, .12)';
      ctx.beginPath();
      ctx.arc(cx, cy, 126, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 76, 76, .60)';
      ctx.lineWidth = 5;
      ctx.setLineDash([18, 10]);
      ctx.beginPath();
      ctx.arc(cx, cy, 126, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawMapLabel(ctx, cx, cy, 'CENTER OUT', '#f14c4c');
      ctx.restore();
    }

    if (mapType === 'OFFICE_DESK') {
      ctx.save();
      ctx.fillStyle = 'rgba(106, 153, 85, .10)';
      ctx.fillRect(18, 18, BOARD_W - 36, BOARD_H - 36);
      ctx.strokeStyle = 'rgba(220, 220, 170, .25)';
      ctx.lineWidth = 2;
      for (let x = 120; x < BOARD_W; x += 160) {
        ctx.beginPath();
        ctx.moveTo(x, 18);
        ctx.lineTo(x + 80, BOARD_H - 18);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawMapLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) {
    ctx.save();
    ctx.font = '700 15px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(label).width + 18;
    ctx.fillStyle = 'rgba(20,20,20,.72)';
    ctx.fillRect(x - width / 2, y - 11, width, 22);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - width / 2, y - 11, width, 22);
    ctx.fillStyle = color;
    ctx.fillText(label, x, y + 1);
    ctx.restore();
  }

  function drawTrail(ctx: CanvasRenderingContext2D) {
    for (const point of trailRef.current) {
      const alpha = Math.max(0, Math.min(1, point.life / 24));
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4 + alpha * 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220, 220, 170, ${alpha * 0.34})`;
      ctx.fill();
    }
  }

  function drawStone(ctx: CanvasRenderingContext2D, stone: SimStone, selected = false) {
    const x = stone.x * BOARD_W;
    const y = stone.y * BOARD_H;
    const fill = playerFill(stone.owner);
    const edge = playerColor(stone.owner);
    if (selected) {
      ctx.save();
      ctx.shadowColor = edge;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, STONE_R + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.beginPath();
      ctx.arc(x, y, STONE_R + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(x + 4, y + 5, STONE_R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, STONE_R, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 7, y - 8, 6, 0, Math.PI * 2);
    ctx.fillStyle = stone.owner === 0 ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.2)';
    ctx.fill();
  }

  function drawEffect(ctx: CanvasRenderingContext2D, effect: VisualEffect) {
    const progress = 1 - effect.life / effect.maxLife;
    const alpha = Math.max(0, effect.life / effect.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = effect.type === 'out' ? 5 : effect.type === 'heavy' ? 4 : 3;
    ctx.beginPath();
    const baseRadius = effect.type === 'out' ? 20 : effect.type === 'launch' ? 12 : effect.type === 'heavy' ? 14 : 10;
    const spread = effect.type === 'out' ? 62 : effect.type === 'launch' ? 34 : effect.type === 'heavy' ? 42 : 28;
    ctx.arc(effect.x, effect.y, baseRadius + progress * spread, 0, Math.PI * 2);
    ctx.stroke();
    if (effect.type === 'launch' || effect.type === 'heavy') {
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10 + progress * 0.8;
        const inner = 12 + progress * 18;
        const outer = 22 + progress * (effect.type === 'heavy' ? 44 : 32);
        ctx.beginPath();
        ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
        ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
        ctx.stroke();
      }
    }
    if (effect.type === 'out') {
      ctx.fillStyle = effect.color;
      ctx.font = '700 20px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OUT', effect.x, effect.y - 16 - progress * 18);
    }
    ctx.restore();
  }

  const aliveCounts = Array.from({ length: game?.numPlayers ?? playerNames.length ?? 0 }, (_, owner) =>
    stones.filter(s => s.owner === owner && s.active).length
  );
  const shotLog = game?.shotLog ?? [];

  return (
    <div style={{
      height: '100%',
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr) auto',
      background: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'Consolas, monospace',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '5px 10px',
        borderBottom: '1px solid #3e3e42',
        background: '#252526',
        fontSize: 12,
      }}>
        <span style={{ color: myColor, fontWeight: 700 }}>{isMyTurn ? 'Your turn' : moving ? 'Moving' : `${currentName}'s turn`}</span>
        {aliveCounts.map((count, owner) => (
          <span key={owner} style={{ color: owner === myPlayerIndex ? myColor : '#858585' }}>
            {owner === myPlayerIndex ? 'Mine' : (playerNames[owner] ?? `P${owner + 1}`)} {count}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: '#858585' }}>drag backward and release</span>
      </div>

      <div ref={wrapRef} style={{ minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDrag(null)}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            border: '1px solid #3e3e42',
            background: '#141414',
            cursor: isMyTurn ? 'grab' : 'default',
            touchAction: 'none',
          }}
        />
      </div>

      <div style={{
        minHeight: 32,
        padding: '4px 10px',
        borderTop: '1px solid #3e3e42',
        background: '#202024',
        color: studyState?.message?.startsWith('ERROR:') ? '#f14c4c' : '#858585',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        overflow: 'hidden',
      }}>
        <span style={{ flexShrink: 0 }}>
          {studyState?.message?.startsWith('ERROR:')
            ? studyState.message
            : isMyTurn
              ? 'Click your stone, pull backward, then release.'
              : 'Wait until every stone stops.'}
        </span>
        <div style={{
          display: 'flex',
          gap: 10,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          color: '#6a9955',
          minWidth: 0,
        }}>
          {shotLog.length > 0
            ? shotLog.slice(-4).reverse().map((line, index) => <span key={`${line}-${index}`}>// {line}</span>)
            : <span>// no shot log</span>}
        </div>
      </div>
    </div>
  );
}
