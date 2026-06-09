import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { IncidentAvoidGameData, StudyMoveRequest, StudyStateResponse } from '../../types';

const WIDTH = 360;
const HEIGHT = 520;
const PLAYER_W = 34;
const PLAYER_H = 12;
const PLAYER_Y = HEIGHT - 34;
const INCIDENT_W = 42;
const INCIDENT_H = 28;

type Incident = {
  id: number;
  x: number;
  y: number;
  speed: number;
  lane: number;
};

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const formatMs = (ms: number) => `${Math.floor(ms / 1000)}s`;
const createIncident = (id: number, y = -INCIDENT_H): Incident => {
  const lane = Math.floor(Math.random() * 8);
  return {
    id,
    x: 24 + lane * 44 + Math.random() * 14,
    y,
    speed: 0.16 + Math.random() * 0.1,
    lane,
  };
};

export default function IncidentAvoid({ studyState, sessionId, myPlayerIndex, sendMove }: Props) {
  const data = studyState?.gameData as IncidentAvoidGameData | null;
  const [x, setX] = useState(WIDTH / 2);
  const [incidents, setIncidents] = useState<Incident[]>(() => [createIncident(1, 30)]);
  const [score, setScore] = useState(0);
  const [survivedMs, setSurvivedMs] = useState(0);
  const [running, setRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [visibility, setVisibility] = useState(58);
  const [localRestartToken, setLocalRestartToken] = useState(0);
  const keysRef = useRef({ left: false, right: false });
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const spawnRef = useRef(0);
  const nextIdRef = useRef(2);
  const survivedMsRef = useRef(0);
  const xRef = useRef(WIDTH / 2);
  const incidentsRef = useRef<Incident[]>([createIncident(1, 30)]);
  const syncPayloadRef = useRef<object>({});

  const playerNames = studyState?.playerNames ?? [];
  const localIncidents = useMemo(
    () => incidents.map((item) => [item.x, item.y]),
    [incidents],
  );
  const boardViews = playerNames.map((name, index) => {
    const state = data?.playerStates?.[String(index)];
    return {
      name,
      index,
      state,
      x: index === myPlayerIndex ? x : state?.x ?? WIDTH / 2,
      score: index === myPlayerIndex ? score : state?.score ?? 0,
      survivedMs: index === myPlayerIndex ? survivedMs : state?.survivedMs ?? 0,
      running: index === myPlayerIndex ? running : state?.running ?? false,
      gameOver: index === myPlayerIndex ? gameOver : state?.gameOver ?? false,
      incidents: index === myPlayerIndex ? localIncidents : state?.incidents ?? [],
      isMe: index === myPlayerIndex,
    };
  });
  const centeredBoardViews = [
    ...boardViews.filter((view) => !view.isMe).slice(0, 1),
    ...boardViews.filter((view) => view.isMe),
    ...boardViews.filter((view) => !view.isMe).slice(1),
  ];

  const reset = useCallback(() => {
    setX(WIDTH / 2);
    setIncidents([createIncident(1, 30)]);
    setScore(0);
    setSurvivedMs(0);
    setRunning(true);
    setGameOver(false);
    spawnRef.current = 0;
    nextIdRef.current = 2;
    survivedMsRef.current = 0;
    xRef.current = WIDTH / 2;
    incidentsRef.current = [createIncident(1, 30)];
    lastFrameRef.current = null;
    setLocalRestartToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!running || gameOver || (studyState?.status !== 'PLAYING' && studyState?.status !== 'FINISHED')) return undefined;
    const tick = (now: number) => {
      const last = lastFrameRef.current ?? now;
      const dt = Math.min(34, now - last);
      lastFrameRef.current = now;
      survivedMsRef.current += dt;
      const elapsed = survivedMsRef.current;
      const level = 1 + elapsed / 18000;
      const moveSpeed = 0.34 * dt;
      const delta = (keysRef.current.right ? moveSpeed : 0) - (keysRef.current.left ? moveSpeed : 0);
      xRef.current = clamp(xRef.current + delta, PLAYER_W / 2, WIDTH - PLAYER_W / 2);
      setX(xRef.current);
      setSurvivedMs(elapsed);
      setScore((prev) => prev + Math.max(1, Math.floor(dt / 12)));

      spawnRef.current -= dt;
      let next = incidentsRef.current
        .map((item) => ({ ...item, y: item.y + item.speed * dt * level }))
        .filter((item) => item.y < HEIGHT + INCIDENT_H);
      if (spawnRef.current <= 0) {
        next = [...next, createIncident(nextIdRef.current)];
        nextIdRef.current += 1;
        spawnRef.current = Math.max(180, 520 - elapsed / 40);
      }
      const hit = next.some((item) => {
        const xHit = Math.abs(item.x - xRef.current) < (PLAYER_W + INCIDENT_W) / 2;
        const yHit = item.y + INCIDENT_H > PLAYER_Y && item.y < PLAYER_Y + PLAYER_H;
        return xHit && yHit;
      });
      incidentsRef.current = next;
      setIncidents(next);
      if (hit) {
        setRunning(false);
        setGameOver(true);
        return;
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [gameOver, localRestartToken, running, studyState?.status]);

  useEffect(() => {
    syncPayloadRef.current = {
      x,
      score,
      survivedMs,
      running,
      gameOver,
      incidents: localIncidents,
    };
  }, [gameOver, localIncidents, running, score, survivedMs, x]);

  useEffect(() => {
    if (studyState?.status !== 'PLAYING' || myPlayerIndex < 0) return undefined;
    const sync = () => {
      sendMove({
        moveType: 'INCIDENT_SYNC',
        data: gameOver ? 'incident_hit' : 'sync',
        sessionId,
        payload: syncPayloadRef.current,
      });
    };
    sync();
    const timer = window.setInterval(sync, 260);
    return () => window.clearInterval(timer);
  }, [gameOver, myPlayerIndex, sendMove, sessionId, studyState?.status]);

  useEffect(() => {
    if (studyState?.status === 'FINISHED' && gameOver) setRunning(false);
  }, [gameOver, studyState?.status]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') keysRef.current.left = true;
      if (event.key === 'ArrowRight') keysRef.current.right = true;
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
  }, []);

  const workspaceStyle = {
    '--incident-alpha': `${visibility / 100}`,
  } as CSSProperties;

  return (
    <div className="incident-workspace" style={workspaceStyle}>
      <div className="code-block incident-main">
        <CL ln={1}><span className="cmt">{'// INCIDENT_AVOID risk monitor'}</span></CL>
        <CL ln={2}>
          <span className="kw">const </span><span className="var">monitor</span>
          <span className="pct"> = </span><span className="typ">INCIDENT_AVOID</span>
          <span className="pct">.</span><span className="fn">observe</span>
          <span className="pct">(</span><span className="num">{data?.width ?? WIDTH}x{data?.height ?? HEIGHT}</span><span className="pct">)</span>
        </CL>
        <div className="incident-board-row">
          {centeredBoardViews.map((view) => (
            <div key={view.index} className={`incident-player-stack ${view.isMe ? 'mine' : ''}`}>
              <IncidentBoard
                view={view}
                winner={studyState?.winner === view.index}
              />
              {view.isMe && (
                <IncidentMetrics
                  score={score}
                  survivedMs={survivedMs}
                  running={running}
                  gameOver={gameOver}
                  visibility={visibility}
                  onVisibility={setVisibility}
                  onRunning={() => setRunning((prev) => !prev)}
                  onReset={reset}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IncidentBoard({
  view, winner,
}: {
  view: {
    name: string;
    x: number;
    score: number;
    survivedMs: number;
    running: boolean;
    gameOver: boolean;
    incidents: number[][];
    isMe: boolean;
  };
  winner: boolean;
}) {
  return (
    <div className={`incident-shell ${view.isMe ? 'mine' : 'peer'}`}>
      <div className="incident-head">
        <span><span className={view.isMe ? 'var' : 'str'}>{view.isMe ? 'me' : `"${view.name}"`}</span></span>
        <span><span className="var">status</span><span className="pct">: </span>
          <span className={winner ? 'typ' : view.gameOver ? 'str' : view.running ? 'typ' : 'dim'}>
            {winner ? 'winner' : view.gameOver ? 'hit' : view.running ? 'watching' : 'paused'}
          </span>
        </span>
      </div>
      <div className="incident-board">
        {view.incidents.map(([x, y], index) => (
          <span
            key={`${index}-${x}-${y}`}
            className="incident-item"
            style={{ left: x - INCIDENT_W / 2, top: y }}
          >
            💩
          </span>
        ))}
        <span className="incident-player" style={{ left: view.x - PLAYER_W / 2, top: PLAYER_Y }}>
          PROC
        </span>
      </div>
      <div className="incident-board-metrics">
        <span><span className="var">score</span><span className="pct">: </span><span className="num">{view.score}</span></span>
        <span><span className="var">uptime</span><span className="pct">: </span><span className="num">{formatMs(view.survivedMs)}</span></span>
      </div>
    </div>
  );
}

function IncidentMetrics({
  score, survivedMs, running, gameOver, visibility, onVisibility, onRunning, onReset,
}: {
  score: number;
  survivedMs: number;
  running: boolean;
  gameOver: boolean;
  visibility: number;
  onVisibility: (value: number) => void;
  onRunning: () => void;
  onReset: () => void;
}) {
  return (
    <div className="code-block incident-side">
      <CL ln={1}><span className="cmt">{'// risk metrics'}</span></CL>
      <Metric ln={2} name="riskScore" value={score} />
      <Metric ln={3} name="uptime" value={formatMs(survivedMs)} string />
      <Metric ln={4} name="status" value={gameOver ? 'hit' : running ? 'watching' : 'paused'} string />
      <CL ln={5}>
        <span className="var">visibility</span><span className="pct">: </span>
        <input
          className="incident-range"
          type="range"
          min={25}
          max={85}
          value={visibility}
          onChange={(event) => onVisibility(Number(event.target.value))}
        />
        <span className="num"> {visibility}%</span>
      </CL>
      <div className="incident-actions">
        <button className="btn-secondary" onClick={onRunning} disabled={gameOver}>
          {running ? 'pause()' : 'resume()'}
        </button>
        <button className="btn-primary" onClick={onReset}>restart()</button>
      </div>
      <div className="incident-note">
        <span className="cmt">{'// arrows: move left/right'}</span>
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
