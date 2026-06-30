import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { StudyMoveRequest, StudyStateResponse, TetrisGameData, TetrisGarbageAttack } from '../../types';

const ROWS = 20;
const COLS = 10;
const SYNC_INTERVAL_MS = 700;
const NEXT_QUEUE_SIZE = 1;
const LOCK_DELAY_MS = 420;
const MAX_LOCK_RESETS = 15;
const DAS_DELAY_MS = 130;
const ARR_INTERVAL_MS = 42;
const COUNTDOWN_SECONDS = 3;
const CLEAR_ANIMATION_MS = 170;
const TETRIS_DAS_KEY = 'study.tetrisDasDelay';
const TETRIS_ARR_KEY = 'study.tetrisArrInterval';

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

const createPiece = (type: string): Piece => {
  const shape = SHAPES[type].map((row) => [...row]);
  return { type, shape, row: 0, col: Math.floor((COLS - shape[0].length) / 2) };
};

const createBag = () => {
  const bag = Object.keys(SHAPES);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
};

const createPieceQueue = (size = NEXT_QUEUE_SIZE) => {
  const bag = createBag();
  while (bag.length < size) bag.push(...createBag());
  return bag.slice(0, size).map(createPiece);
};

const refillPieceTypes = (queue: string[], size: number) => {
  const next = [...queue];
  while (next.length < size) next.push(...createBag());
  return next;
};

const refillQueue = (queue: Piece[], size = NEXT_QUEUE_SIZE) => {
  const next = queue.map((item) => ({ ...item, shape: item.shape.map((row) => [...row]) }));
  while (next.length < size) {
    next.push(...createBag().map(createPiece));
  }
  return next.slice(0, size);
};

const readStoredNumber = (key: string, fallback: number, min: number, max: number) => {
  const parsed = Number(localStorage.getItem(key));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const rotateShape = (shape: number[][]) =>
  shape[0].map((_, col) => shape.map((row) => row[col]).reverse());

const kickOffsets = (pieceType: string) =>
  pieceType === 'I' ? [0, -2, 2, -1, 1, -3, 3] : [0, -1, 1, -2, 2];

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
  const clearedRows: number[] = [];
  const kept = board.filter((row, index) => {
    const shouldClear = row.every(Boolean);
    if (shouldClear) clearedRows.push(index);
    return !shouldClear;
  });
  const cleared = clearedRows.length;
  const blank = Array.from({ length: cleared }, () => Array(COLS).fill('') as string[]);
  return { board: [...blank, ...kept], cleared, clearedRows };
};

const addGarbageLines = (board: Board, count: number, previousHole: number | null) => {
  const safeCount = Math.max(0, Math.min(8, count));
  if (safeCount === 0) return { board, hole: previousHole };
  const kept = board.slice(safeCount).map((row) => [...row]);
  let hole = previousHole ?? Math.floor(Math.random() * COLS);
  const garbage = Array.from({ length: safeCount }, (_, index) => {
    if (index > 0 && Math.random() >= 0.7) {
      hole = Math.floor(Math.random() * COLS);
    }
    return Array.from({ length: COLS }, (_, col) => (col === hole ? '' : 'G'));
  });
  return { board: [...kept, ...garbage], hole };
};

const baseAttackLines = (cleared: number) => {
  if (cleared === 2) return 1;
  if (cleared === 3) return 2;
  if (cleared >= 4) return 4;
  return 0;
};

const attackPower = (cleared: number, combo: number) => {
  if (cleared <= 0) return 0;
  const base = baseAttackLines(cleared);
  const comboBonus = combo >= 2 ? Math.min(4, combo - 1) : 0;
  return base + comboBonus;
};

export default function Tetris({ studyState, sessionId, myPlayerIndex, sendMove }: Props) {
  const data = studyState?.gameData as TetrisGameData | null;
  const initialQueue = useMemo(() => createPieceQueue(NEXT_QUEUE_SIZE + 1), []);
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [piece, setPiece] = useState<Piece>(() => initialQueue[0]);
  const [nextQueue, setNextQueue] = useState<Piece[]>(() => refillQueue(initialQueue.slice(1)));
  const pieceTypeQueueRef = useRef<string[]>(refillPieceTypes(initialQueue.slice(1).map((item) => item.type), 7));
  const [holdPiece, setHoldPiece] = useState<Piece | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [running, setRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [cellAlpha, setCellAlpha] = useState(58);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [pendingGarbage, setPendingGarbage] = useState(0);
  const [clearCombo, setClearCombo] = useState(0);
  const [attackNotice, setAttackNotice] = useState('');
  const [localAttackLog, setLocalAttackLog] = useState<string[]>([]);
  const [clearingRows, setClearingRows] = useState<number[]>([]);
  const [resolvingClear, setResolvingClear] = useState(false);
  const [dasDelay, setDasDelay] = useState(() => readStoredNumber(TETRIS_DAS_KEY, DAS_DELAY_MS, 70, 220));
  const [arrInterval, setArrInterval] = useState(() => readStoredNumber(TETRIS_ARR_KEY, ARR_INTERVAL_MS, 16, 90));
  const horizontalHoldRef = useRef<number | null>(null);
  const horizontalDelayRef = useRef<number | null>(null);
  const lockDelayRef = useRef<number | null>(null);
  const lockResetCountRef = useRef(0);
  const clearAnimationRef = useRef<number | null>(null);
  const moveRef = useRef<(dr: number, dc: number) => boolean>(() => false);
  const syncPayloadRef = useRef<object>({});
  const attackSeqRef = useRef(0);
  const lastAttackRef = useRef<{ lastCleared: number; attackKey: string; attackLines: number }>({ lastCleared: 0, attackKey: '', attackLines: 0 });
  const appliedAttacksRef = useRef<Set<string>>(new Set());
  const ackAttackIdsRef = useRef<string[]>([]);
  const pendingGarbageRef = useRef(0);
  const garbageHoleRef = useRef<number | null>(null);
  const pieceRef = useRef<Piece>(piece);
  const boardRef = useRef<Board>(board);
  const gameInstanceRef = useRef('');

  const globalPaused = Boolean(data?.paused);
  const gameInstanceId = data?.instanceId ?? '';
  const isHost = myPlayerIndex === 0;
  const active = running && !gameOver && !globalPaused && countdown <= 0 && !resolvingClear;

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

  const pushLocalAttackLog = useCallback((message: string) => {
    if (!message) return;
    setLocalAttackLog((prev) => [message, ...prev].slice(0, 6));
  }, []);

  const attackLogLines = useMemo(() => {
    const serverLines = (data?.attackLog ?? [])
      .slice(-6)
      .reverse()
      .map((entry) => {
        const from = playerNames[entry.from] ?? `P${entry.from + 1}`;
        const to = playerNames[entry.to] ?? `P${entry.to + 1}`;
        const combo = entry.combo > 1 ? ` c${entry.combo}` : '';
        return `${from} -> ${to} +${entry.lines}${combo}`;
      });
    return [...localAttackLog, ...serverLines].slice(0, 6);
  }, [data?.attackLog, localAttackLog, playerNames]);

  useEffect(() => {
    pieceRef.current = piece;
  }, [piece]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    pendingGarbageRef.current = pendingGarbage;
  }, [pendingGarbage]);

  useEffect(() => {
    if (!attackNotice) return undefined;
    const timer = window.setTimeout(() => setAttackNotice(''), 900);
    return () => window.clearTimeout(timer);
  }, [attackNotice]);

  useEffect(() => {
    if (studyState?.status !== 'PLAYING' || countdown <= 0 || gameOver || globalPaused) return undefined;
    const timer = window.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, gameOver, globalPaused, studyState?.status]);

  const setQueue = useCallback((queue: Piece[]) => {
    pieceTypeQueueRef.current = refillPieceTypes(queue.map((item) => item.type), 7);
    setNextQueue(pieceTypeQueueRef.current.slice(0, NEXT_QUEUE_SIZE).map(createPiece));
  }, []);

  const takeNextPiece = useCallback(() => {
    const filled = refillPieceTypes(pieceTypeQueueRef.current, 7);
    const next = createPiece(filled[0]);
    const spawned = { ...next, row: 0, col: Math.floor((COLS - next.shape[0].length) / 2) };
    pieceTypeQueueRef.current = refillPieceTypes(filled.slice(1), 7);
    setNextQueue(pieceTypeQueueRef.current.slice(0, NEXT_QUEUE_SIZE).map(createPiece));
    return spawned;
  }, []);

  const clearLockDelay = useCallback((resetCount = false) => {
    if (lockDelayRef.current !== null) {
      window.clearTimeout(lockDelayRef.current);
      lockDelayRef.current = null;
    }
    if (resetCount) lockResetCountRef.current = 0;
  }, []);

  const resetLockDelayForMove = useCallback(() => {
    if (lockResetCountRef.current >= MAX_LOCK_RESETS) return false;
    clearLockDelay();
    lockResetCountRef.current += 1;
    return true;
  }, [clearLockDelay]);

  const clearLineAnimation = useCallback(() => {
    if (clearAnimationRef.current !== null) {
      window.clearTimeout(clearAnimationRef.current);
      clearAnimationRef.current = null;
    }
    setClearingRows([]);
    setResolvingClear(false);
  }, []);

  useEffect(() => {
    if (globalPaused) {
      clearLockDelay();
    }
  }, [clearLockDelay, globalPaused]);

  const reset = useCallback(() => {
    clearLockDelay();
    clearLineAnimation();
    const queue = createPieceQueue(NEXT_QUEUE_SIZE + 1);
    setBoard(emptyBoard());
    setPiece(queue[0]);
    setQueue(queue.slice(1));
    setHoldPiece(null);
    setCanHold(true);
    setScore(0);
    setLines(0);
    setCycle(1);
    setRunning(true);
    setGameOver(false);
    setCountdown(COUNTDOWN_SECONDS);
    pendingGarbageRef.current = 0;
    garbageHoleRef.current = null;
    setPendingGarbage(0);
    setClearCombo(0);
    setAttackNotice('');
    setLocalAttackLog([]);
    lockResetCountRef.current = 0;
    lastAttackRef.current = { lastCleared: 0, attackKey: '', attackLines: 0 };
    appliedAttacksRef.current.clear();
    ackAttackIdsRef.current = [];
  }, [clearLineAnimation, clearLockDelay, setQueue]);

  const toggleGlobalPause = useCallback(() => {
    clearLockDelay();
    sendMove({
      moveType: 'TETRIS_PAUSE',
      data: globalPaused ? 'resume' : 'pause',
      sessionId,
      payload: { paused: !globalPaused },
    });
  }, [clearLockDelay, globalPaused, sendMove, sessionId]);

  const requestGlobalRestart = useCallback(() => {
    clearLockDelay();
    sendMove({
      moveType: 'RESTART',
      data: '',
      sessionId,
    });
  }, [clearLockDelay, sendMove, sessionId]);

  useEffect(() => {
    if (!gameInstanceId) return;
    if (gameInstanceRef.current && gameInstanceRef.current !== gameInstanceId) {
      reset();
    }
    gameInstanceRef.current = gameInstanceId;
  }, [gameInstanceId, reset]);

  const lockPiece = useCallback((targetPiece = piece) => {
    if (resolvingClear) return;
    clearLockDelay();
    const merged = mergePiece(boardRef.current, targetPiece);
    const result = clearLines(merged);
    const nextCombo = result.cleared > 0 ? clearCombo + 1 : 0;
    const rawOutgoingPower = attackPower(result.cleared, nextCombo);
    const cancelPower = result.cleared > 0 ? Math.max(1, rawOutgoingPower) : 0;
    const queuedGarbage = pendingGarbageRef.current;
    let nextPendingGarbage = queuedGarbage;
    let nextBoard = result.board;
    let outgoingAttackLines = rawOutgoingPower;
    let overflow = false;
    let notice = '';

    if (cancelPower > 0 && queuedGarbage > 0) {
      const canceled = Math.min(queuedGarbage, cancelPower);
      nextPendingGarbage = queuedGarbage - canceled;
      outgoingAttackLines = Math.max(0, rawOutgoingPower - canceled);
      notice = outgoingAttackLines > 0 ? `cancel -${canceled} / send +${outgoingAttackLines}` : `cancel -${canceled}`;
    } else if (result.cleared === 0 && queuedGarbage > 0) {
      const applyCount = Math.min(8, queuedGarbage);
      overflow = result.board.slice(0, applyCount).some((row) => row.some(Boolean));
      const garbageResult = addGarbageLines(result.board, applyCount, garbageHoleRef.current);
      nextBoard = garbageResult.board;
      garbageHoleRef.current = garbageResult.hole;
      nextPendingGarbage = queuedGarbage - applyCount;
      notice = `garbage +${applyCount}`;
    } else if (rawOutgoingPower > 0) {
      notice = `send +${rawOutgoingPower}`;
    } else if (result.cleared > 0) {
      notice = `clear x${result.cleared}`;
    }

    const commitLock = () => {
      clearAnimationRef.current = null;
      setClearingRows([]);
      setResolvingClear(false);

      const gained = [0, 120, 320, 520, 820][result.cleared] ?? 0;
      const spawned = takeNextPiece();
      attackSeqRef.current += 1;
      lastAttackRef.current = {
        lastCleared: result.cleared,
        attackKey: `${sessionId}:${Date.now()}:${attackSeqRef.current}`,
        attackLines: outgoingAttackLines,
      };

      pendingGarbageRef.current = nextPendingGarbage;
      setPendingGarbage(nextPendingGarbage);
      setClearCombo(nextCombo);
      setAttackNotice(notice);
      pushLocalAttackLog(notice);
      setBoard(nextBoard);
      setScore((prev) => prev + gained + 8);
      setLines((prev) => {
        const total = prev + result.cleared;
        setCycle(Math.floor(total / 8) + 1);
        return total;
      });
      setPiece(spawned);
      setCanHold(true);

      if (overflow || collides(nextBoard, spawned)) {
        setRunning(false);
        setGameOver(true);
      }
    };

    if (result.cleared > 0) {
      setResolvingClear(true);
      setClearingRows(result.clearedRows);
      setBoard(merged);
      clearAnimationRef.current = window.setTimeout(commitLock, CLEAR_ANIMATION_MS);
      return;
    }

    commitLock();
  }, [clearCombo, clearLockDelay, piece, pushLocalAttackLog, resolvingClear, sessionId, takeNextPiece]);

  const scheduleLock = useCallback(() => {
    if (lockDelayRef.current !== null) return;
    lockDelayRef.current = window.setTimeout(() => {
      lockDelayRef.current = null;
      const currentPiece = pieceRef.current;
      if (collides(boardRef.current, currentPiece, currentPiece.row + 1, currentPiece.col)) {
        lockPiece(currentPiece);
      }
    }, LOCK_DELAY_MS);
  }, [lockPiece]);

  useEffect(() => {
    const attacks = data?.garbageQueues?.[String(myPlayerIndex)] ?? [];
    if (!attacks.length || gameOver) return;
    const pending = attacks.filter((attack: TetrisGarbageAttack) => !appliedAttacksRef.current.has(attack.attackId));
    if (!pending.length) return;
    pending.forEach((attack) => appliedAttacksRef.current.add(attack.attackId));
    const totalLines = pending.reduce((sum, attack) => sum + Math.max(0, attack.lines), 0);
    if (totalLines <= 0) return;
    ackAttackIdsRef.current = [...ackAttackIdsRef.current, ...pending.map((attack) => attack.attackId)];
    pendingGarbageRef.current += totalLines;
    setPendingGarbage(pendingGarbageRef.current);
  }, [data?.garbageQueues, gameOver, myPlayerIndex]);

  const move = useCallback((dr: number, dc: number) => {
    if (!active) return false;
    if (collides(board, piece, piece.row + dr, piece.col + dc)) {
      if (dr > 0) scheduleLock();
      return false;
    }
    const nextPiece = { ...piece, row: piece.row + dr, col: piece.col + dc };
    const onGround = collides(board, nextPiece, nextPiece.row + 1, nextPiece.col);
    if (dr > 0 || !onGround) {
      clearLockDelay(true);
    } else if (!resetLockDelayForMove()) {
      return false;
    }
    setPiece(nextPiece);
    if (onGround) scheduleLock();
    return true;
  }, [active, board, clearLockDelay, piece, resetLockDelayForMove, scheduleLock]);

  useEffect(() => {
    moveRef.current = move;
  }, [move]);

  const rotate = useCallback(() => {
    if (!active || piece.type === 'O') return;
    const shape = rotateShape(piece.shape);
    const offsets = kickOffsets(piece.type);
    const offset = offsets.find((candidate) => !collides(board, piece, piece.row, piece.col + candidate, shape));
    if (offset !== undefined) {
      const nextPiece = { ...piece, shape, col: piece.col + offset };
      const onGround = collides(board, nextPiece, nextPiece.row + 1, nextPiece.col);
      if (!onGround) {
        clearLockDelay(true);
      } else if (!resetLockDelayForMove()) {
        return;
      }
      setPiece(nextPiece);
      if (onGround) scheduleLock();
    }
  }, [active, board, clearLockDelay, piece, resetLockDelayForMove, scheduleLock]);

  const hardDrop = useCallback(() => {
    if (!active) return;
    clearLockDelay();
    let row = piece.row;
    while (!collides(board, piece, row + 1, piece.col)) row += 1;
    const dropped = { ...piece, row };
    setPiece(dropped);
    lockPiece(dropped);
  }, [active, board, clearLockDelay, lockPiece, piece]);

  const hold = useCallback(() => {
    if (!active || !canHold) return;
    clearLockDelay();
    const held = createPiece(piece.type);
    const nextPiece = holdPiece ? createPiece(holdPiece.type) : takeNextPiece();
    if (holdPiece) {
      setHoldPiece(held);
    } else {
      setHoldPiece(held);
    }
    setPiece(nextPiece);
    setCanHold(false);
    if (collides(boardRef.current, nextPiece)) {
      setRunning(false);
      setGameOver(true);
    }
  }, [active, canHold, clearLockDelay, holdPiece, piece, takeNextPiece]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => move(1, 0), speed);
    return () => window.clearTimeout(timer);
  }, [active, move, speed]);

  useEffect(() => {
    const ackAttackIds = ackAttackIdsRef.current;
    const payload = {
      board: projectedBoard,
      score,
      lines,
      cycle,
      running,
      gameOver,
      lastCleared: lastAttackRef.current.lastCleared,
      attackKey: lastAttackRef.current.attackKey,
      attackLines: lastAttackRef.current.attackLines,
      ackAttackIds,
    };
    syncPayloadRef.current = payload;
  }, [cycle, gameOver, lines, projectedBoard, running, score]);

  useEffect(() => {
    if (studyState?.status !== 'PLAYING' || myPlayerIndex < 0) return undefined;
    const sync = () => {
      const payload = {
        ...(syncPayloadRef.current as object),
        lastCleared: lastAttackRef.current.lastCleared,
        attackKey: lastAttackRef.current.attackKey,
        attackLines: lastAttackRef.current.attackLines,
        ackAttackIds: ackAttackIdsRef.current,
      };
      sendMove({
        moveType: 'TETRIS_SYNC',
        data: gameOver ? 'queue_overflow' : 'sync',
        sessionId,
        payload,
      });
      lastAttackRef.current = { lastCleared: 0, attackKey: '', attackLines: 0 };
      ackAttackIdsRef.current = [];
    };
    sync();
    const timer = window.setInterval(sync, SYNC_INTERVAL_MS);
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
  useEffect(() => clearLockDelay, [clearLockDelay]);
  useEffect(() => () => {
    if (clearAnimationRef.current !== null) {
      window.clearTimeout(clearAnimationRef.current);
      clearAnimationRef.current = null;
    }
  }, []);

  const startHorizontalHold = useCallback((direction: -1 | 1) => {
    if (!active) return;
    if (horizontalHoldRef.current !== null || horizontalDelayRef.current !== null) return;
    moveRef.current(0, direction);
    horizontalDelayRef.current = window.setTimeout(() => {
      horizontalDelayRef.current = null;
      horizontalHoldRef.current = window.setInterval(() => moveRef.current(0, direction), arrInterval);
    }, dasDelay);
  }, [active, arrInterval, dasDelay]);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const isTyping = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || Boolean(target?.isContentEditable);
    const keys = isTyping
      ? ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp']
      : ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'c', 'C', 'p', 'P', 'r', 'R'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') startHorizontalHold(-1);
    if (event.key === 'ArrowRight') startHorizontalHold(1);
    if (event.key === 'ArrowDown') move(1, 0);
    if (event.key === 'ArrowUp') rotate();
    if (event.key === ' ') hardDrop();
    if (event.key.toLowerCase() === 'c') hold();
    if (event.key.toLowerCase() === 'p') {
      clearLockDelay();
      toggleGlobalPause();
    }
    if (event.key.toLowerCase() === 'r' && isHost) requestGlobalRestart();
  }, [hardDrop, hold, isHost, move, requestGlobalRestart, rotate, startHorizontalHold, toggleGlobalPause]);

  const onKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') stopHorizontalHold();
  }, [stopHorizontalHold]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', stopHorizontalHold);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', stopHorizontalHold);
    };
  }, [onKeyDown, onKeyUp, stopHorizontalHold]);

  const boardStyle = {
    '--tetris-cell-alpha': `${cellAlpha / 100}`,
  } as CSSProperties;

  const updateDasDelay = useCallback((value: number) => {
    setDasDelay(value);
    localStorage.setItem(TETRIS_DAS_KEY, String(value));
  }, []);

  const updateArrInterval = useCallback((value: number) => {
    setArrInterval(value);
    localStorage.setItem(TETRIS_ARR_KEY, String(value));
  }, []);

  return (
    <div className="tetris-workspace" tabIndex={0}>
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
              status={isMe ? (gameOver ? 'overflow' : countdown > 0 ? `${countdown}` : globalPaused ? 'paused' : running ? 'running' : 'stopped') : state?.gameOver ? 'overflow' : globalPaused ? 'paused' : state ? 'running' : 'waiting'}
              pending={isMe ? pendingGarbage : data?.garbageQueues?.[String(index)]?.reduce((sum, attack) => sum + Math.max(0, attack.lines), 0) ?? 0}
              winner={studyState?.winner === index}
              isMe={isMe}
              clearingRows={isMe ? clearingRows : []}
              style={isMe ? boardStyle : undefined}
            />
              {isMe && (
                <MetricsPanel
                  nextQueue={nextQueue}
                  holdPiece={holdPiece}
                  paused={globalPaused}
                  clearCombo={clearCombo}
                  attackLogLines={attackLogLines}
                  dasDelay={dasDelay}
                  arrInterval={arrInterval}
                  cellAlpha={cellAlpha}
                  onCellAlpha={setCellAlpha}
                  onDasDelay={updateDasDelay}
                  onArrInterval={updateArrInterval}
                  onPause={toggleGlobalPause}
                  onRestart={requestGlobalRestart}
                  canRestart={isHost}
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
        <Metric ln={5} name="nextBatch" value={nextQueue[0]?.type ?? 'null'} string />
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
          {nextQueue.map((next, index) => <Preview key={`${next.type}-${index}`} title={`next${index + 1}`} piece={next} />)}
          <Preview title="hold" piece={holdPiece} />
        </div>
        <div className="tetris-actions">
          <button className="btn-secondary" onClick={toggleGlobalPause}>
            {globalPaused ? 'resumeAll()' : 'pauseAll()'}
          </button>
          <button className="btn-primary" onClick={requestGlobalRestart} disabled={!isHost}>restartAll()</button>
        </div>
        <div className="tetris-note">
          <span className="cmt">{'// arrows: move/drop - space: rotate - c: pin - p: pause all'}</span>
        </div>
      </div>
      {globalPaused && <TetrisWorkCover />}
    </div>
  );
}

function TetrisWorkCover() {
  return (
    <div className="tetris-work-cover" aria-hidden="true">
      <div className="tetris-work-cover-tabs">
        <span className="active">queue.worker.ts</span>
        <span>sessionStore.ts</span>
        <span>indexer.log</span>
      </div>
      <div className="tetris-work-cover-body">
        <aside>
          <b>EXPLORER</b>
          <span>src</span>
          <span>services</span>
          <span className="active">queue.worker.ts</span>
          <span>sessionStore.ts</span>
          <span>tasks</span>
          <span>syncPipeline.ts</span>
        </aside>
        <main>
          <CL ln={1}><span className="kw">import </span><span className="pct">{'{ '}</span><span className="var">createBatch</span><span className="pct">{' }'}</span><span className="kw"> from </span><span className="str">'./syncPipeline'</span><span className="pct">;</span></CL>
          <CL ln={2}><span className="kw">import </span><span className="pct">{'{ '}</span><span className="var">commitSnapshot</span><span className="pct">{' }'}</span><span className="kw"> from </span><span className="str">'./sessionStore'</span><span className="pct">;</span></CL>
          <CL ln={3}>{' '}</CL>
          <CL ln={4}><span className="kw">export async function </span><span className="fn">reconcileWorkspace</span><span className="pct">{'() {'}</span></CL>
          <CL ln={5}>  <span className="kw">const </span><span className="var">batch</span><span className="pct"> = await </span><span className="fn">createBatch</span><span className="pct">();</span></CL>
          <CL ln={6}>  <span className="kw">const </span><span className="var">snapshot</span><span className="pct"> = await </span><span className="fn">commitSnapshot</span><span className="pct">(</span><span className="var">batch</span><span className="pct">);</span></CL>
          <CL ln={7}>  <span className="kw">return </span><span className="pct">{'{ '}</span><span className="var">status</span><span className="pct">: </span><span className="str">'watching'</span><span className="pct">, </span><span className="var">snapshot</span><span className="pct">{' };'}</span></CL>
          <CL ln={8}><span className="pct">{'}'}</span></CL>
          <CL ln={9}>{' '}</CL>
          <CL ln={10}><span className="cmt">{'// watching for file changes...'}</span></CL>
          <CL ln={11}><span className="cmt">{'// TypeScript: 0 errors'}</span></CL>
        </main>
      </div>
      <div className="tetris-work-cover-status">
        <span>main</span>
        <span>UTF-8</span>
        <span>TypeScript</span>
        <span>Prettier</span>
      </div>
    </div>
  );
}

function MetricsPanel({
  nextQueue, holdPiece, paused, clearCombo, dasDelay, arrInterval,
  attackLogLines, cellAlpha, onCellAlpha, onDasDelay, onArrInterval, onPause, onRestart, canRestart,
}: {
  nextQueue: Piece[];
  holdPiece: Piece | null;
  paused: boolean;
  clearCombo: number;
  attackLogLines: string[];
  dasDelay: number;
  arrInterval: number;
  cellAlpha: number;
  onCellAlpha: (value: number) => void;
  onDasDelay: (value: number) => void;
  onArrInterval: (value: number) => void;
  onPause: () => void;
  onRestart: () => void;
  canRestart: boolean;
}) {
  return (
    <div className="code-block tetris-side">
      <CL ln={1}><span className="cmt">{'// queue metrics'}</span></CL>
      <CL ln={2}>
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
      <CL ln={3}>
        <span className="var">DAS</span><span className="pct">: </span>
        <input
          className="tetris-range"
          type="range"
          min={70}
          max={220}
          value={dasDelay}
          onChange={(event) => onDasDelay(Number(event.target.value))}
        />
        <span className="num"> {dasDelay}ms</span>
      </CL>
      <CL ln={4}>
        <span className="var">ARR</span><span className="pct">: </span>
        <input
          className="tetris-range"
          type="range"
          min={16}
          max={90}
          value={arrInterval}
          onChange={(event) => onArrInterval(Number(event.target.value))}
        />
        <span className="num"> {arrInterval}ms</span>
      </CL>
      <div className="tetris-preview-row">
        {nextQueue.map((next, index) => <Preview key={`${next.type}-${index}`} title={`next${index + 1}`} piece={next} />)}
        <Preview title="hold" piece={holdPiece} />
      </div>
      <div className={`tetris-combo-banner ${clearCombo >= 2 ? 'active' : ''} ${clearCombo >= 7 ? 'hot' : clearCombo >= 4 ? 'warm' : ''}`}>
        <span>{clearCombo >= 2 ? `COMBO x${clearCombo}` : 'COMBO idle'}</span>
      </div>
      <div className="tetris-attack-log">
        {attackLogLines.length > 0 ? attackLogLines.map((line, index) => (
          <span key={`${line}-${index}`}>{line}</span>
        )) : <span className="dim">no attacks</span>}
      </div>
      <div className="tetris-actions">
        <button className="btn-secondary" onClick={onPause}>
          {paused ? 'resumeAll()' : 'pauseAll()'}
        </button>
        <button className="btn-primary" onClick={onRestart} disabled={!canRestart}>restartAll()</button>
      </div>
    </div>
  );
}

function BoardShell({
  name, board, score, lines, cycle, status, pending, winner, isMe, clearingRows, style,
}: {
  name: string;
  board: Board;
  score: number;
  lines: number;
  cycle: number;
  status: string;
  pending: number;
  winner: boolean;
  isMe: boolean;
  clearingRows: number[];
  style?: CSSProperties;
}) {
  const gaugeCount = Math.min(12, pending);
  const clearingRowSet = useMemo(() => new Set(clearingRows), [clearingRows]);
  return (
    <div className={`tetris-shell ${isMe ? 'mine' : 'peer'}`}>
      <div className="tetris-head">
        <span><span className={isMe ? 'var' : 'str'}>{isMe ? 'me' : `"${name}"`}</span></span>
        <span><span className="var">status</span><span className="pct">: </span><span className={winner ? 'typ' : status === 'overflow' ? 'str' : status === 'running' ? 'typ' : 'dim'}>{winner ? 'winner' : status}</span></span>
        <span><span className="var">cycle</span><span className="pct">: </span><span className="num">{cycle}</span></span>
      </div>
      <div className="tetris-board" style={style}>
        {status === 'paused' && (
          <div className="tetris-countdown tetris-paused-title">PAUSED</div>
        )}
        {isMe && /^\d+$/.test(status) && (
          <div className="tetris-countdown">{status}</div>
        )}
        {pending > 0 && (
          <div className="tetris-garbage-gauge" title={`incoming ${pending}`}>
            <span className="tetris-garbage-label">{pending}</span>
            {Array.from({ length: gaugeCount }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        )}
        {board.map((row, r) => row.map((cell, c) => (
          <div
            key={`${r}-${c}`}
            className={`tetris-cell ${cell ? `filled t-${cell}` : ''} ${clearingRowSet.has(r) ? 'clearing' : ''}`}
            title={`${name} slot ${r + 1}.${c + 1}`}
          />
        )))}
      </div>
      <div className="tetris-board-metrics">
        <span><span className="var">score</span><span className="pct">: </span><span className="num">{score}</span></span>
        <span><span className="var">lines</span><span className="pct">: </span><span className="num">{lines}</span></span>
        <span><span className="var">incoming</span><span className="pct">: </span><span className={pending > 0 ? 'str' : 'num'}>{pending}</span></span>
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
