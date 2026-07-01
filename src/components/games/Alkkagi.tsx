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

const BOARD_W = 1500;
const BOARD_H = 820;
const STONE_R = 13;
const MAX_PULL = 190;
const POWER = 0.13;
const FRICTION = 0.988;
const STOP_SPEED = 0.08;

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
  const [stones, setStones] = useState<SimStone[]>([]);
  const [drag, setDrag] = useState<{ id: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [size, setSize] = useState({ width: BOARD_W, height: BOARD_H });

  const isMyTurn = game?.currentTurn === myPlayerIndex && studyState?.status === 'PLAYING' && !moving && !game?.activeShot;
  const playerNames = studyState?.playerNames ?? [];
  const currentName = game ? playerNames[game.currentTurn] ?? `P${game.currentTurn + 1}` : '';
  const myColor = myPlayerIndex === 0 ? '#4ec9b0' : '#ce9178';

  useEffect(() => {
    if (!game || moving) return;
    const next = toSim(game.stones ?? []);
    stonesRef.current = next;
    setStones(next);
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
    runSimulation(game.activeShot.id, game.activeShot.playerIndex);
  }, [game?.activeShot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const updateSize = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(520, rect.width - 16);
      const height = Math.max(320, rect.height - 16);
      const scale = Math.min(width / BOARD_W, height / BOARD_H);
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

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isMyTurn) return;
    const point = boardPoint(event);
    const stone = findStone(point.x, point.y);
    if (!stone) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDrag = { id: stone.id, startX: point.x, startY: point.y, x: point.x, y: point.y };
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

  function runSimulation(shotId: number, shooterIndex: number) {
    let quietFrames = 0;
    const step = () => {
      const list = stonesRef.current;
      for (const stone of list) {
        if (!stone.active) continue;
        stone.x += stone.vx / BOARD_W;
        stone.y += stone.vy / BOARD_H;
        stone.vx *= FRICTION;
        stone.vy *= FRICTION;
        if (Math.abs(stone.vx) < 0.01) stone.vx = 0;
        if (Math.abs(stone.vy) < 0.01) stone.vy = 0;
        const px = stone.x * BOARD_W;
        const py = stone.y * BOARD_H;
        if (px < -STONE_R || px > BOARD_W + STONE_R || py < -STONE_R || py > BOARD_H + STONE_R) {
          stone.active = false;
          stone.vx = 0;
          stone.vy = 0;
        }
      }

      resolveCollisions(list);
      const anyMoving = list.some(stone => stone.active && speed(stone) > STOP_SPEED);
      setStones([...list]);
      draw();

      if (anyMoving) {
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
        if (shooterIndex === myPlayerIndex) {
          sendMove({
            moveType: 'ALKKAGI_RESULT',
            data: '',
            sessionId,
            payload: {
              shotId,
              stones: list.map(({ id, owner, x, y, active }) => ({ id, owner, x, y, active })),
            },
          });
        }
      }
    };
    animRef.current = requestAnimationFrame(step);
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
        if (dist <= 0 || dist >= minDist) continue;

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
        a.vx = (vbN * nx + vaT * tx) * bounce;
        a.vy = (vbN * ny + vaT * ty) * bounce;
        b.vx = (vaN * nx + vbT * tx) * bounce;
        b.vy = (vaN * ny + vbT * ty) * bounce;
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
    ctx.setTransform(scale * window.devicePixelRatio, 0, 0, scale * window.devicePixelRatio, 0, 0);

    ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(18, 18, BOARD_W - 36, BOARD_H - 36);
    ctx.strokeStyle = '#3e3e42';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, BOARD_W - 36, BOARD_H - 36);

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
      drawStone(ctx, stone);
    }

    if (drag) {
      const stone = stonesRef.current.find(s => s.id === drag.id);
      if (stone?.active) {
        const sx = stone.x * BOARD_W;
        const sy = stone.y * BOARD_H;
        const pull = clampPull(drag.x - sx, drag.y - sy);
        const endX = sx + pull.dx;
        const endY = sy + pull.dy;
        ctx.strokeStyle = myColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.setLineDash([9, 8]);
        ctx.strokeStyle = '#dcdcaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - pull.dx * 1.6, sy - pull.dy * 1.6);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#dcdcaa';
        ctx.fillRect(sx - 48, sy - 44, 96 * (pull.dist / MAX_PULL), 5);
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

  function drawStone(ctx: CanvasRenderingContext2D, stone: SimStone) {
    const x = stone.x * BOARD_W;
    const y = stone.y * BOARD_H;
    const fill = stone.owner === 0 ? '#d4d4d4' : '#111111';
    const edge = stone.owner === 0 ? '#4ec9b0' : '#ce9178';
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

  const myAlive = stones.filter(s => s.owner === myPlayerIndex && s.active).length;
  const opponentAlive = stones.filter(s => s.owner !== myPlayerIndex && s.active).length;

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
        padding: '8px 12px',
        borderBottom: '1px solid #3e3e42',
        background: '#252526',
        fontSize: 12,
      }}>
        <span style={{ color: myColor, fontWeight: 700 }}>{isMyTurn ? 'Your turn' : moving ? 'Moving' : `${currentName}'s turn`}</span>
        <span style={{ color: '#858585' }}>Mine {myAlive}</span>
        <span style={{ color: '#858585' }}>Opponent {opponentAlive}</span>
        <span style={{ marginLeft: 'auto', color: '#858585' }}>drag backward and release</span>
      </div>

      <div ref={wrapRef} style={{ minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
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
        minHeight: 34,
        padding: '7px 12px',
        borderTop: '1px solid #3e3e42',
        background: '#202024',
        color: studyState?.message?.startsWith('ERROR:') ? '#f14c4c' : '#858585',
        fontSize: 12,
      }}>
        {studyState?.message?.startsWith('ERROR:')
          ? studyState.message
          : isMyTurn
            ? 'Click your stone, pull backward, then release.'
            : 'Wait until every stone stops.'}
      </div>
    </div>
  );
}
