import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BreakoutGameData, StudyMoveRequest, StudyStateResponse } from '../../types';

const WIDTH = 420;
const HEIGHT = 520;
const PADDLE_W = 76;
const PADDLE_H = 12;
const PADDLE_Y = HEIGHT - 34;
const BALL = 10;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_W = 42;
const BRICK_H = 16;
const BRICK_GAP = 6;
const BRICK_TOP = 54;
const BRICK_LEFT = 24;
const BRICK_COUNT = BRICK_ROWS * BRICK_COLS;

type Brick = { id: number; x: number; y: number };

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const initialBricks = () => Array.from({ length: BRICK_COUNT }, (_, id) => id);
const brickPos = (id: number): Brick => ({
  id,
  x: BRICK_LEFT + (id % BRICK_COLS) * (BRICK_W + BRICK_GAP),
  y: BRICK_TOP + Math.floor(id / BRICK_COLS) * (BRICK_H + BRICK_GAP),
});

export default function Breakout({ studyState, sessionId, myPlayerIndex, sendMove }: Props) {
  const data = studyState?.gameData as BreakoutGameData | null;
  const [paddleX, setPaddleX] = useState(WIDTH / 2);
  const [ball, setBall] = useState({ x: WIDTH / 2, y: PADDLE_Y - 28, vx: 0.18, vy: -0.26 });
  const [bricks, setBricks] = useState<number[]>(() => initialBricks());
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [visibility, setVisibility] = useState(58);
  const [restartToken, setRestartToken] = useState(0);
  const previousStatusRef = useRef(studyState?.status);
  const keysRef = useRef({ left: false, right: false });
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const paddleRef = useRef(WIDTH / 2);
  const ballRef = useRef({ x: WIDTH / 2, y: PADDLE_Y - 28, vx: 0.18, vy: -0.26 });
  const bricksRef = useRef<number[]>(initialBricks());
  const syncPayloadRef = useRef<object>({});

  const resetLocalState = useCallback(() => {
    const startBall = { x: WIDTH / 2, y: PADDLE_Y - 28, vx: 0.18, vy: -0.26 };
    setPaddleX(WIDTH / 2);
    setBall(startBall);
    setBricks(initialBricks());
    setScore(0);
    setRunning(true);
    setGameOver(false);
    setCleared(false);
    paddleRef.current = WIDTH / 2;
    ballRef.current = startBall;
    bricksRef.current = initialBricks();
    lastFrameRef.current = null;
    setRestartToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const nextStatus = studyState?.status;
    if (nextStatus === 'PLAYING' && previousStatus === 'FINISHED') resetLocalState();
    previousStatusRef.current = nextStatus;
  }, [resetLocalState, studyState?.status]);

  const localBrickSet = useMemo(() => new Set(bricks), [bricks]);
  const playerNames = studyState?.playerNames ?? [];
  const boardViews = playerNames.map((name, index) => {
    const state = data?.playerStates?.[String(index)];
    return {
      name,
      index,
      isMe: index === myPlayerIndex,
      paddleX: index === myPlayerIndex ? paddleX : state?.paddleX ?? WIDTH / 2,
      ballX: index === myPlayerIndex ? ball.x : state?.ballX ?? WIDTH / 2,
      ballY: index === myPlayerIndex ? ball.y : state?.ballY ?? PADDLE_Y - 28,
      score: index === myPlayerIndex ? score : state?.score ?? 0,
      bricksLeft: index === myPlayerIndex ? bricks.length : state?.bricksLeft ?? BRICK_COUNT,
      running: index === myPlayerIndex ? running : state?.running ?? false,
      gameOver: index === myPlayerIndex ? gameOver : state?.gameOver ?? false,
      cleared: index === myPlayerIndex ? cleared : state?.cleared ?? false,
      brickSet: index === myPlayerIndex ? localBrickSet : new Set(state?.bricks ?? initialBricks()),
    };
  });
  const centeredBoardViews = [
    ...boardViews.filter((view) => !view.isMe).slice(0, 1),
    ...boardViews.filter((view) => view.isMe),
    ...boardViews.filter((view) => !view.isMe).slice(1),
  ];

  useEffect(() => {
    if (!running || gameOver || cleared || studyState?.status !== 'PLAYING') return undefined;
    const tick = (now: number) => {
      const last = lastFrameRef.current ?? now;
      const dt = Math.min(28, now - last);
      lastFrameRef.current = now;

      const paddleDelta = ((keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0)) * 0.42 * dt;
      paddleRef.current = clamp(paddleRef.current + paddleDelta, PADDLE_W / 2, WIDTH - PADDLE_W / 2);

      let nextBall = { ...ballRef.current };
      nextBall.x += nextBall.vx * dt;
      nextBall.y += nextBall.vy * dt;

      if (nextBall.x <= BALL / 2 || nextBall.x >= WIDTH - BALL / 2) {
        nextBall.x = clamp(nextBall.x, BALL / 2, WIDTH - BALL / 2);
        nextBall.vx *= -1;
      }
      if (nextBall.y <= BALL / 2) {
        nextBall.y = BALL / 2;
        nextBall.vy = Math.abs(nextBall.vy);
      }

      const onPaddle =
        nextBall.vy > 0 &&
        nextBall.y + BALL / 2 >= PADDLE_Y &&
        nextBall.y - BALL / 2 <= PADDLE_Y + PADDLE_H &&
        Math.abs(nextBall.x - paddleRef.current) <= PADDLE_W / 2 + BALL / 2;
      if (onPaddle) {
        const offset = (nextBall.x - paddleRef.current) / (PADDLE_W / 2);
        nextBall.y = PADDLE_Y - BALL / 2;
        nextBall.vx = clamp(offset * 0.28, -0.32, 0.32);
        nextBall.vy = -Math.min(0.36, Math.abs(nextBall.vy) + 0.006);
      }

      let nextBricks = bricksRef.current;
      const hitBrick = nextBricks.find((id) => {
        const b = brickPos(id);
        return nextBall.x + BALL / 2 >= b.x &&
          nextBall.x - BALL / 2 <= b.x + BRICK_W &&
          nextBall.y + BALL / 2 >= b.y &&
          nextBall.y - BALL / 2 <= b.y + BRICK_H;
      });
      if (hitBrick !== undefined) {
        nextBricks = nextBricks.filter((id) => id !== hitBrick);
        bricksRef.current = nextBricks;
        nextBall.vy *= -1;
        setScore((prev) => prev + 120);
        if (nextBricks.length === 0) {
          setCleared(true);
          setRunning(false);
        }
      }

      if (nextBall.y > HEIGHT + BALL) {
        setGameOver(true);
        setRunning(false);
      }

      ballRef.current = nextBall;
      setPaddleX(paddleRef.current);
      setBall(nextBall);
      setBricks(nextBricks);
      frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [cleared, gameOver, restartToken, running, studyState?.status]);

  useEffect(() => {
    syncPayloadRef.current = {
      paddleX,
      ballX: ball.x,
      ballY: ball.y,
      score,
      bricksLeft: bricks.length,
      running,
      gameOver,
      cleared,
      bricks,
    };
  }, [ball.x, ball.y, bricks, cleared, gameOver, paddleX, running, score]);

  useEffect(() => {
    if (studyState?.status !== 'PLAYING' || myPlayerIndex < 0) return undefined;
    const sync = () => {
      sendMove({
        moveType: 'BREAKOUT_SYNC',
        data: cleared ? 'cleared' : gameOver ? 'miss' : 'sync',
        sessionId,
        payload: syncPayloadRef.current,
      });
    };
    sync();
    const timer = window.setInterval(sync, 220);
    return () => window.clearInterval(timer);
  }, [cleared, gameOver, myPlayerIndex, sendMove, sessionId, studyState?.status]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') keysRef.current.left = true;
      if (event.key === 'ArrowRight') keysRef.current.right = true;
      if (event.key === ' ' && !gameOver && !cleared) setRunning(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') keysRef.current.left = false;
      if (event.key === 'ArrowRight') keysRef.current.right = false;
    };
    const clear = () => {
      keysRef.current.left = false;
      keysRef.current.right = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, [cleared, gameOver]);

  const workspaceStyle = {
    '--breakout-alpha': `${visibility / 100}`,
  } as CSSProperties;

  return (
    <div className="breakout-workspace" style={workspaceStyle}>
      <div className="code-block breakout-main">
        <CL ln={1}><span className="cmt">{'// BREAKOUT delivery monitor'}</span></CL>
        <CL ln={2}>
          <span className="kw">const </span><span className="var">pipeline</span>
          <span className="pct"> = </span><span className="typ">BREAKOUT</span>
          <span className="pct">.</span><span className="fn">observe</span>
          <span className="pct">(</span><span className="num">{data?.width ?? WIDTH}x{data?.height ?? HEIGHT}</span><span className="pct">)</span>
        </CL>
        <div className="breakout-board-row">
          {centeredBoardViews.map((view) => (
            <div key={view.index} className={`breakout-player-stack ${view.isMe ? 'mine' : ''}`}>
              <BreakoutBoard view={view} winner={studyState?.winner === view.index} />
              {view.isMe && (
                <BreakoutMetrics
                  score={score}
                  bricksLeft={bricks.length}
                  running={running}
                  gameOver={gameOver}
                  cleared={cleared}
                  visibility={visibility}
                  onVisibility={setVisibility}
                  onRunning={() => {
                    if (!gameOver && !cleared) setRunning((prev) => !prev);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BreakoutBoard({
  view, winner,
}: {
  view: {
    name: string;
    paddleX: number;
    ballX: number;
    ballY: number;
    score: number;
    bricksLeft: number;
    running: boolean;
    gameOver: boolean;
    cleared: boolean;
    brickSet: Set<number>;
    isMe: boolean;
  };
  winner: boolean;
}) {
  return (
    <div className={`breakout-shell ${view.isMe ? 'mine' : 'peer'}`}>
      <div className="breakout-head">
        <span className="str">"{view.name}"</span>
        <span className="num">{view.score}</span>
      </div>
      <div className="breakout-board">
        {Array.from({ length: BRICK_COUNT }, (_, id) => {
          if (!view.brickSet.has(id)) return null;
          const b = brickPos(id);
          return <div key={id} className="breakout-brick" style={{ left: b.x, top: b.y }} />;
        })}
        <div className="breakout-ball" style={{ left: view.ballX - BALL / 2, top: view.ballY - BALL / 2 }} />
        <div className="breakout-paddle" style={{ left: view.paddleX - PADDLE_W / 2, top: PADDLE_Y }} />
        <div className="breakout-status">
          {winner ? 'winner' : view.cleared ? 'cleared' : view.gameOver ? 'missed' : view.running ? 'watching' : 'paused'}
        </div>
      </div>
      <div className="breakout-foot">
        <span className="var">remaining</span><span className="pct">: </span><span className="num">{view.bricksLeft}</span>
      </div>
    </div>
  );
}

function BreakoutMetrics({
  score, bricksLeft, running, gameOver, cleared, visibility, onVisibility, onRunning,
}: {
  score: number;
  bricksLeft: number;
  running: boolean;
  gameOver: boolean;
  cleared: boolean;
  visibility: number;
  onVisibility: (value: number) => void;
  onRunning: () => void;
}) {
  return (
    <div className="code-block breakout-side">
      <CL ln={1}><span className="cmt">{'// delivery metrics'}</span></CL>
      <Metric ln={2} name="score" value={score} />
      <Metric ln={3} name="backlog" value={bricksLeft} />
      <Metric ln={4} name="status" value={cleared ? 'cleared' : gameOver ? 'missed' : running ? 'watching' : 'paused'} string />
      <CL ln={5}>
        <span className="var">visibility</span><span className="pct">: </span>
        <input
          className="breakout-range"
          type="range"
          min={24}
          max={82}
          value={visibility}
          onChange={(event) => onVisibility(Number(event.target.value))}
        />
        <span className="num"> {visibility}%</span>
      </CL>
      <div className="breakout-actions">
        <button className="btn-secondary" onClick={onRunning} disabled={gameOver || cleared}>
          {running ? 'pause()' : 'resume()'}
        </button>
      </div>
      <div className="breakout-note">
        <span className="cmt">{'// arrows: move paddle - space: resume'}</span>
      </div>
    </div>
  );
}

function Metric({ ln, name, value, string = false }: { ln: number; name: string; value: string | number; string?: boolean }) {
  return (
    <CL ln={ln}>
      <span className="var">{name}</span><span className="pct">: </span>
      <span className={string ? 'str' : 'num'}>{string ? `"${value}"` : value}</span>
    </CL>
  );
}

function CL({ ln, children }: { ln: number; children: ReactNode }) {
  return (
    <div className="c-line">
      <span className="ln">{ln}</span>
      <span className="c-line-body">{children}</span>
    </div>
  );
}
