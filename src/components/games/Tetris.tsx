import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { StudyMoveRequest, StudyStateResponse, TetrisGameData } from '../../types';

const ROWS = 20;
const COLS = 10;

const SHAPES: Record<string, number[][]> = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

type Board = string[][];
type Piece = {
  type: string;
  shape: number[][];
  row: number;
  col: number;
};

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
}

const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill('') as string[]);

const randomPiece = (): Piece => {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const shape = SHAPES[type].map((row) => [...row]);
  return { type, shape, row: 0, col: Math.floor((COLS - shape[0].length) / 2) };
};

const rotateShape = (shape: number[][]) =>
  shape[0].map((_, col) => shape.map((row) => row[col]).reverse());

const collides = (board: Board, piece: Piece, nextRow = piece.row, nextCol = piece.col, nextShape = piece.shape) => {
  for (let r = 0; r < nextShape.length; r += 1) {
    for (let c = 0; c < nextShape[r].length; c += 1) {
      if (!nextShape[r][c]) continue;
      const br = nextRow + r;
      const bc = nextCol + c;
      if (bc < 0 || bc >= COLS || br >= ROWS) return true;
      if (br >= 0 && board[br][bc]) return true;
    }
  }
  return false;
};

const mergePiece = (board: Board, piece: Piece) => {
  const next = board.map((row) => [...row]);
  piece.shape.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell && piece.row + r >= 0) next[piece.row + r][piece.col + c] = piece.type;
    });
  });
  return next;
};

const clearLines = (board: Board) => {
  const kept = board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - kept.length;
  const blank = Array.from({ length: cleared }, () => Array(COLS).fill('') as string[]);
  return { board: [...blank, ...kept], cleared };
};

export default function Tetris({ studyState, sessionId, myPlayerIndex, sendMove }: Props) {
  const data = studyState?.gameData as TetrisGameData | null;
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [piece, setPiece] = useState<Piece>(() => randomPiece());
  const [nextPiece, setNextPiece] = useState<Piece>(() => randomPiece());
  const [holdPiece, setHoldPiece] = useState<Piece | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [running, setRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [cellAlpha, setCellAlpha] = useState(58);
  const horizontalHoldRef = useRef<number | null>(null);
  const horizontalDelayRef = useRef<number | null>(null);
  const moveRef = useRef<(dr: number, dc: number) => boolean>(() => false);
  const syncPayloadRef = useRef<object>({});

  const speed = Math.max(140, 720 - (cycle - 1) * 48);

  const projectedBoard = useMemo(() => mergePiece(board, piece), [board, piece]);
  const playerNames = studyState?.playerNames ?? [];
  const boardViews = playerNames.map((name, index) => {
    const state = data?.playerStates?.[String(index)];
    return {
      name,
      index,
      state,
      board: index === myPlayerIndex ? projectedBoard : state?.board ?? emptyBoard(),
      isMe: index === myPlayerIndex,
    };
  });
  const centeredBoardViews = [
    ...boardViews.filter((view) => !view.isMe).slice(0, 1),
    ...boardViews.filter((view) => view.isMe),
    ...boardViews.filter((view) => !view.isMe).slice(1),
  ];

  const reset = useCallback(() => {
    setBoard(emptyBoard());
    setPiece(randomPiece());
    setNextPiece(randomPiece());
    setHoldPiece(null);
    setCanHold(true);
    setScore(0);
    setLines(0);
    setCycle(1);
    setRunning(true);
    setGameOver(false);
  }, []);

  const lockPiece = useCallback((targetPiece = piece) => {
    const merged = mergePiece(board, targetPiece);
    const result = clearLines(merged);
    const gained = [0, 120, 320, 520, 820][result.cleared] ?? 0;
    const spawned = { ...nextPiece, row: 0, col: Math.floor((COLS - nextPiece.shape[0].length) / 2) };

    setBoard(result.board);
    setScore((prev) => prev + gained + 8);
    setLines((prev) => {
      const total = prev + result.cleared;
      setCycle(Math.floor(total / 8) + 1);
      return total;
    });
    setPiece(spawned);
    setNextPiece(randomPiece());
    setCanHold(true);

    if (collides(result.board, spawned)) {
      setRunning(false);
      setGameOver(true);
    }
  }, [board, nextPiece, piece, sendMove, sessionId]);

  const move = useCallback((dr: number, dc: number) => {
    if (!running || gameOver) return false;
    if (collides(board, piece, piece.row + dr, piece.col + dc)) {
      if (dr > 0) lockPiece();
      return false;
    }
    setPiece((prev) => ({ ...prev, row: prev.row + dr, col: prev.col + dc }));
    return true;
  }, [board, gameOver, lockPiece, piece, running]);

  useEffect(() => {
    moveRef.current = move;
  }, [move]);

  const rotate = useCallback(() => {
    if (!running || gameOver || piece.type === 'O') return;
    const shape = rotateShape(piece.shape);
    const offsets = [0, -1, 1, -2, 2];
    const offset = offsets.find((candidate) => !collides(board, piece, piece.row, piece.col + candidate, shape));
    if (offset !== undefined) {
      setPiece((prev) => ({ ...prev, shape, col: prev.col + offset }));
    }
  }, [board, gameOver, piece, running]);

  const hardDrop = useCallback(() => {
    if (!running || gameOver) return;
    let row = piece.row;
    while (!collides(board, piece, row + 1, piece.col)) row += 1;
    const dropped = { ...piece, row };
    setPiece(dropped);
    lockPiece(dropped);
  }, [board, gameOver, lockPiece, piece, running]);

  const hold = useCallback(() => {
    if (!running || gameOver || !canHold) return;
    const held = { ...piece, row: 0, col: Math.floor((COLS - piece.shape[0].length) / 2) };
    if (holdPiece) {
      setPiece({ ...holdPiece, row: 0, col: Math.floor((COLS - holdPiece.shape[0].length) / 2) });
      setHoldPiece(held);
    } else {
      setPiece(nextPiece);
      setNextPiece(randomPiece());
      setHoldPiece(held);
    }
    setCanHold(false);
  }, [canHold, gameOver, holdPiece, nextPiece, piece, running]);

  useEffect(() => {
    if (!running || gameOver) return undefined;
    const timer = window.setTimeout(() => move(1, 0), speed);
    return () => window.clearTimeout(timer);
  }, [gameOver, move, running, speed]);

  useEffect(() => {
    syncPayloadRef.current = {
      board: projectedBoard,
      score,
      lines,
      cycle,
      running,
      gameOver,
    };
  }, [cycle, gameOver, lines, projectedBoard, running, score]);

  useEffect(() => {
    if (studyState?.status !== 'PLAYING' || myPlayerIndex < 0) return undefined;
    const sync = () => {
      sendMove({
        moveType: 'TETRIS_SYNC',
        data: gameOver ? 'queue_overflow' : 'sync',
        sessionId,
        payload: syncPayloadRef.current,
      });
    };
    sync();
    const timer = window.setInterval(sync, 300);
    return () => window.clearInterval(timer);
  }, [gameOver, myPlayerIndex, sendMove, sessionId, studyState?.status]);

  useEffect(() => {
    if (studyState?.status === 'FINISHED') {
      setRunning(false);
    }
  }, [studyState?.status]);

  const stopHorizontalHold = useCallback(() => {
    if (horizontalHoldRef.current !== null) window.clearInterval(horizontalHoldRef.current);
    if (horizontalDelayRef.current !== null) window.clearTimeout(horizontalDelayRef.current);
    horizontalHoldRef.current = null;
    horizontalDelayRef.current = null;
  }, []);

  useEffect(() => stopHorizontalHold, [stopHorizontalHold]);

  const startHorizontalHold = (direction: -1 | 1) => {
    if (horizontalHoldRef.current !== null || horizontalDelayRef.current !== null) return;
    moveRef.current(0, direction);
    horizontalDelayRef.current = window.setTimeout(() => {
      horizontalDelayRef.current = null;
      horizontalHoldRef.current = window.setInterval(() => moveRef.current(0, direction), 46);
    }, 120);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'c', 'C', 'p', 'P', 'r', 'R'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') startHorizontalHold(-1);
    if (event.key === 'ArrowRight') startHorizontalHold(1);
    if (event.key === 'ArrowDown') move(1, 0);
    if (event.key === 'ArrowUp') rotate();
    if (event.key === ' ') hardDrop();
    if (event.key.toLowerCase() === 'c') hold();
    if (event.key.toLowerCase() === 'p') setRunning((prev) => !prev);
    if (event.key.toLowerCase() === 'r') reset();
  };

  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') stopHorizontalHold();
  };

  const boardStyle = {
    '--tetris-cell-alpha': `${cellAlpha / 100}`,
  } as CSSProperties;

  return (
    <div className="tetris-workspace" tabIndex={0} onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
      <div className="code-block tetris-main">
        <CL ln={1}>
          <span className="cmt">{'// TETRIS queue monitor'}</span>
        </CL>
        <CL ln={2}>
          <span className="kw">const </span><span className="var">pipeline</span>
          <span className="pct"> = </span><span className="typ">TETRIS</span>
          <span className="pct">.</span><span className="fn">observe</span>
          <span className="pct">(</span><span className="num">{data?.rows ?? ROWS}x{data?.cols ?? COLS}</span><span className="pct">)</span>
        </CL>

        <div className="tetris-board-row">
          {centeredBoardViews.map(({ name, index, state, board: viewBoard, isMe }) => (
            <div key={index} className={`tetris-player-stack ${isMe ? 'mine' : ''}`}>
              <BoardShell
              name={name}
              board={viewBoard}
              score={isMe ? score : state?.score ?? 0}
              lines={isMe ? lines : state?.lines ?? 0}
              cycle={isMe ? cycle : state?.cycle ?? 1}
              status={isMe ? (gameOver ? 'overflow' : running ? 'running' : 'paused') : state?.gameOver ? 'overflow' : state ? 'running' : 'waiting'}
              winner={studyState?.winner === index}
              isMe={isMe}
              style={isMe ? boardStyle : undefined}
            />
              {isMe && (
                <MetricsPanel
                  name={studyState?.playerNames?.[myPlayerIndex] ?? 'me'}
                  score={score}
                  piece={piece}
                  nextPiece={nextPiece}
                  holdPiece={holdPiece}
                  running={running}
                  cellAlpha={cellAlpha}
                  onCellAlpha={setCellAlpha}
                  onRunning={() => setRunning((prev) => !prev)}
                  onReset={reset}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="code-block tetris-side tetris-side-legacy">
        <CL ln={1}><span className="cmt">{'// queue metrics'}</span></CL>
        <Metric ln={2} name="operator" value={studyState?.playerNames?.[myPlayerIndex] ?? 'me'} string />
        <Metric ln={3} name="score" value={score} />
        <Metric ln={4} name="batch" value={piece.type} string />
        <Metric ln={5} name="nextBatch" value={nextPiece.type} string />
        <Metric ln={6} name="pinnedTask" value={holdPiece?.type ?? 'null'} string />
        <CL ln={7}>
          <span className="var">visibility</span><span className="pct">: </span>
          <input
            className="tetris-range"
            type="range"
            min={22}
            max={82}
            value={cellAlpha}
            onChange={(event) => setCellAlpha(Number(event.target.value))}
          />
          <span className="num"> {cellAlpha}%</span>
        </CL>
        <div className="tetris-preview-row">
          <Preview title="next" piece={nextPiece} />
          <Preview title="hold" piece={holdPiece} />
        </div>
        <div className="tetris-actions">
          <button className="btn-secondary" onClick={() => setRunning((prev) => !prev)}>
            {running ? 'pause()' : 'resume()'}
          </button>
          <button className="btn-primary" onClick={reset}>restart()</button>
        </div>
        <div className="tetris-note">
          <span className="cmt">{'// arrows: move/rotate · space: commit · c: pin · p: pause'}</span>
        </div>
      </div>
    </div>
  );
}

function MetricsPanel({
  name, score, piece, nextPiece, holdPiece, running, cellAlpha, onCellAlpha, onRunning, onReset,
}: {
  name: string;
  score: number;
  piece: Piece;
  nextPiece: Piece;
  holdPiece: Piece | null;
  running: boolean;
  cellAlpha: number;
  onCellAlpha: (value: number) => void;
  onRunning: () => void;
  onReset: () => void;
}) {
  return (
    <div className="code-block tetris-side">
      <CL ln={1}><span className="cmt">{'// queue metrics'}</span></CL>
      <Metric ln={2} name="operator" value={name} string />
      <Metric ln={3} name="score" value={score} />
      <Metric ln={4} name="batch" value={piece.type} string />
      <Metric ln={5} name="nextBatch" value={nextPiece.type} string />
      <Metric ln={6} name="pinnedTask" value={holdPiece?.type ?? 'null'} string />
      <CL ln={7}>
        <span className="var">visibility</span><span className="pct">: </span>
        <input
          className="tetris-range"
          type="range"
          min={22}
          max={82}
          value={cellAlpha}
          onChange={(event) => onCellAlpha(Number(event.target.value))}
        />
        <span className="num"> {cellAlpha}%</span>
      </CL>
      <div className="tetris-preview-row">
        <Preview title="next" piece={nextPiece} />
        <Preview title="hold" piece={holdPiece} />
      </div>
      <div className="tetris-actions">
        <button className="btn-secondary" onClick={onRunning}>
          {running ? 'pause()' : 'resume()'}
        </button>
        <button className="btn-primary" onClick={onReset}>restart()</button>
      </div>
      <div className="tetris-note">
        <span className="cmt">{'// arrows: move/rotate · space: commit · c: pin · p: pause'}</span>
      </div>
    </div>
  );
}

function BoardShell({
  name, board, score, lines, cycle, status, winner, isMe, style,
}: {
  name: string;
  board: Board;
  score: number;
  lines: number;
  cycle: number;
  status: string;
  winner: boolean;
  isMe: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className={`tetris-shell ${isMe ? 'mine' : 'peer'}`}>
      <div className="tetris-head">
        <span><span className={isMe ? 'var' : 'str'}>{isMe ? 'me' : `"${name}"`}</span></span>
        <span><span className="var">status</span><span className="pct">: </span><span className={winner ? 'typ' : status === 'overflow' ? 'str' : status === 'running' ? 'typ' : 'dim'}>{winner ? 'winner' : status}</span></span>
        <span><span className="var">cycle</span><span className="pct">: </span><span className="num">{cycle}</span></span>
      </div>
      <div className="tetris-board" style={style}>
        {board.map((row, r) => row.map((cell, c) => (
          <div
            key={`${r}-${c}`}
            className={`tetris-cell ${cell ? `filled t-${cell}` : ''}`}
            title={`${name} slot ${r + 1}.${c + 1}`}
          />
        )))}
      </div>
      <div className="tetris-board-metrics">
        <span><span className="var">score</span><span className="pct">: </span><span className="num">{score}</span></span>
        <span><span className="var">lines</span><span className="pct">: </span><span className="num">{lines}</span></span>
      </div>
    </div>
  );
}

function Preview({ title, piece }: { title: string; piece: Piece | null }) {
  return (
    <div className="tetris-preview">
      <div className="dim">{title}</div>
      <div className={`tetris-mini ${piece ? '' : 'empty'}`}>
        {Array.from({ length: 16 }, (_, i) => {
          const r = Math.floor(i / 4);
          const c = i % 4;
          const filled = piece?.shape[r]?.[c] ?? 0;
          return <span key={i} className={filled ? `filled t-${piece?.type}` : ''} />;
        })}
        {!piece && <b>empty</b>}
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
