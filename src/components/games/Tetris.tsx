import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { StudyMoveRequest, StudyStateResponse, TetrisGameData, TetrisGarbageAttack } from '../../types';

const ROWS = 20;
const COLS = 10;
const SYNC_INTERVAL_MS = 700;
const NEXT_QUEUE_SIZE = 5;
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
  rotation: number;
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
  return { type, shape, row: 0, col: Math.floor((COLS - shape[0].length) / 2), rotation: 0 };
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

const JLSTZ_KICKS: Record<string, Array<{ dc: number; dr: number }>> = {
  '0>1': [{ dc: 0, dr: 0 }, { dc: -1, dr: 0 }, { dc: -1, dr: 1 }, { dc: 0, dr: -2 }, { dc: -1, dr: -2 }],
  '1>2': [{ dc: 0, dr: 0 }, { dc: 1, dr: 0 }, { dc: 1, dr: -1 }, { dc: 0, dr: 2 }, { dc: 1, dr: 2 }],
  '2>3': [{ dc: 0, dr: 0 }, { dc: 1, dr: 0 }, { dc: 1, dr: 1 }, { dc: 0, dr: -2 }, { dc: 1, dr: -2 }],
  '3>0': [{ dc: 0, dr: 0 }, { dc: -1, dr: 0 }, { dc: -1, dr: -1 }, { dc: 0, dr: 2 }, { dc: -1, dr: 2 }],
};

const I_KICKS: Record<string, Array<{ dc: number; dr: number }>> = {
  '0>1': [{ dc: 0, dr: 0 }, { dc: -2, dr: 0 }, { dc: 1, dr: 0 }, { dc: -2, dr: -1 }, { dc: 1, dr: 2 }],
  '1>2': [{ dc: 0, dr: 0 }, { dc: -1, dr: 0 }, { dc: 2, dr: 0 }, { dc: -1, dr: 2 }, { dc: 2, dr: -1 }],
  '2>3': [{ dc: 0, dr: 0 }, { dc: 2, dr: 0 }, { dc: -1, dr: 0 }, { dc: 2, dr: 1 }, { dc: -1, dr: -2 }],
  '3>0': [{ dc: 0, dr: 0 }, { dc: 1, dr: 0 }, { dc: -2, dr: 0 }, { dc: 1, dr: -2 }, { dc: -2, dr: 1 }],
};

const WALL_FALLBACK_KICKS = [
  { dc: 0, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
  { dc: -2, dr: 0 },
  { dc: 2, dr: 0 },
  { dc: -3, dr: 0 },
  { dc: 3, dr: 0 },
  { dc: -1, dr: -1 },
  { dc: 1, dr: -1 },
  { dc: -2, dr: -1 },
  { dc: 2, dr: -1 },
  { dc: -1, dr: 1 },
  { dc: 1, dr: 1 },
  { dc: -2, dr: 1 },
  { dc: 2, dr: 1 },
];

const kickOffsets = (pieceType: string, from: number, to: number) => {
  if (pieceType === 'O') return [{ dc: 0, dr: 0 }];
  const key = `${from}>${to}`;
  const base = (pieceType === 'I' ? I_KICKS[key] : JLSTZ_KICKS[key]) ?? [];
  const seen = new Set<string>();
  return [...base, ...WALL_FALLBACK_KICKS].filter((kick) => {
    const id = `${kick.dc}:${kick.dr}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

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

const removeGhostCells = (board: Board) => (
  board.map((row) => row.map((cell) => (cell.startsWith('ghost-') ? '' : cell)))
);

const ghostDropRow = (board: Board, piece: Piece) => {
  let row = piece.row;
  while (!collides(board, piece, row + 1, piece.col, piece.shape)) row += 1;
  return row;
};

const mergeGhostPiece = (board: Board, piece: Piece, enabled: boolean) => {
  if (!enabled) return board;
  const ghostRow = ghostDropRow(board, piece);
  if (ghostRow <= piece.row) return board;
  const next = board.map((row) => [...row]);
  piece.shape.forEach((row, r) => {
    row.forEach((cell, c) => {
      const br = ghostRow + r;
      const bc = piece.col + c;
      if (cell && br >= 0 && br < ROWS && bc >= 0 && bc < COLS && !next[br][bc]) {
        next[br][bc] = `ghost-${piece.type}`;
      }
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

const pickGarbageHole = (previousHole: number | null) => {
  if (previousHole === null) return Math.floor(Math.random() * COLS);
  const offset = 1 + Math.floor(Math.random() * (COLS - 1));
  return (previousHole + offset) % COLS;
};

const addGarbageLines = (board: Board, count: number, previousHole: number | null) => {
  const safeCount = Math.max(0, Math.min(8, count));
  if (safeCount === 0) return { board, hole: previousHole };
  const kept = board.slice(safeCount).map((row) => [...row]);
  let hole = previousHole ?? pickGarbageHole(null);
  let streak = 0;
  const garbage = Array.from({ length: safeCount }, (_, index) => {
    const shouldShiftHole = index > 0 && (streak >= 2 || Math.random() < 0.42);
    if (shouldShiftHole) {
      hole = pickGarbageHole(hole);
      streak = 0;
    } else {
      streak += 1;
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

const tSpinAttackLines = (cleared: number) => {
  if (cleared === 1) return 2;
  if (cleared === 2) return 4;
  if (cleared >= 3) return 6;
  return 0;
};

const scoreForClear = (cleared: number, tspin: boolean, b2b: boolean, perfectClear: boolean) => {
  const base = tspin
    ? [400, 800, 1200, 1600][cleared] ?? 400
    : [0, 120, 320, 520, 820][cleared] ?? 0;
  const b2bBonus = b2b && (tspin || cleared >= 4) ? Math.floor(base * 0.5) : 0;
  return base + b2bBonus + (perfectClear ? 1200 : 0);
};

const outgoingAttackPower = (cleared: number, combo: number, tspin: boolean, b2b: boolean, perfectClear: boolean) => {
  if (cleared <= 0) return 0;
  const base = tspin ? tSpinAttackLines(cleared) : baseAttackLines(cleared);
  const b2bBonus = b2b && (tspin || cleared >= 4) ? 1 : 0;
  const comboBonus = combo >= 2 ? Math.min(4, combo - 1) : 0;
  const perfectBonus = perfectClear ? 6 : 0;
  return base + b2bBonus + comboBonus + perfectBonus;
};

const isBoardEmpty = (board: Board) => board.every((row) => row.every((cell) => !cell));

const isTSpin = (board: Board, piece: Piece, lastMoveWasRotate: boolean) => {
  if (!lastMoveWasRotate || piece.type !== 'T') return false;
  const corners = [
    [piece.row, piece.col],
    [piece.row, piece.col + 2],
    [piece.row + 2, piece.col],
    [piece.row + 2, piece.col + 2],
  ];
  const blocked = corners.filter(([row, col]) => (
    row < 0 || row >= ROWS || col < 0 || col >= COLS || Boolean(board[row][col])
  )).length;
  return blocked >= 3;
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
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [pendingGarbage, setPendingGarbage] = useState(0);
  const [clearCombo, setClearCombo] = useState(0);
  const [backToBack, setBackToBack] = useState(false);
  const [attackNotice, setAttackNotice] = useState('');
  const [flashBadge, setFlashBadge] = useState('');
  const [sendPulse, setSendPulse] = useState(0);
  const [incomingPulse, setIncomingPulse] = useState(0);
  const [garbageImpact, setGarbageImpact] = useState(0);
  const [shakeBursts, setShakeBursts] = useState(0);
  const [clearingRows, setClearingRows] = useState<number[]>([]);
  const [resolvingClear, setResolvingClear] = useState(false);
  const [dasDelay, setDasDelay] = useState(() => readStoredNumber(TETRIS_DAS_KEY, DAS_DELAY_MS, 70, 220));
  const [arrInterval, setArrInterval] = useState(() => readStoredNumber(TETRIS_ARR_KEY, ARR_INTERVAL_MS, 16, 90));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const horizontalHoldRef = useRef<number | null>(null);
  const horizontalDelayRef = useRef<number | null>(null);
  const horizontalDirectionRef = useRef<-1 | 1 | null>(null);
  const lockDelayRef = useRef<number | null>(null);
  const lockResetCountRef = useRef(0);
  const clearAnimationRef = useRef<number | null>(null);
  const moveRef = useRef<(dr: number, dc: number) => boolean>(() => false);
  const syncPayloadRef = useRef<object>({});
  const attackSeqRef = useRef(0);
  const lastAttackRef = useRef<{ lastCleared: number; attackKey: string; attackLines: number }>({ lastCleared: 0, attackKey: '', attackLines: 0 });
  const lastClearMetaRef = useRef({ tspin: false, b2b: false, perfectClear: false });
  const lastMoveWasRotateRef = useRef(false);
  const appliedAttacksRef = useRef<Set<string>>(new Set());
  const seenDistractEventsRef = useRef<Set<string>>(new Set());
  const ackAttackIdsRef = useRef<string[]>([]);
  const pendingGarbageRef = useRef(0);
  const garbageHoleRef = useRef<number | null>(null);
  const pieceRef = useRef<Piece>(piece);
  const boardRef = useRef<Board>(board);
  const gameInstanceRef = useRef('');

  const globalPaused = Boolean(data?.paused);
  const gameInstanceId = data?.instanceId ?? '';
  const isHost = myPlayerIndex === 0;
  const playerNames = studyState?.playerNames ?? [];
  const active = running && !gameOver && !globalPaused && countdown <= 0 && !resolvingClear;

  const speed = Math.max(140, 720 - (cycle - 1) * 48);

  const publicBoard = useMemo(
    () => mergePiece(board, piece),
    [board, piece],
  );
  const projectedBoard = useMemo(
    () => mergePiece(mergeGhostPiece(board, piece, ghostEnabled), piece),
    [board, ghostEnabled, piece],
  );
  const boardViews = playerNames.map((name, index) => {
    const state = data?.playerStates?.[String(index)];
    return {
      name,
      index,
      state,
      board: index === myPlayerIndex ? projectedBoard : state?.board ? removeGhostCells(state.board) : emptyBoard(),
      isMe: index === myPlayerIndex,
    };
  });
  const centeredBoardViews = [
    ...boardViews.filter((view) => !view.isMe).slice(0, 1),
    ...boardViews.filter((view) => view.isMe),
    ...boardViews.filter((view) => !view.isMe).slice(1),
  ];

  useEffect(() => {
    const events = data?.distractEvents ?? [];
    events.forEach((event) => {
      if (event.type !== 'shake' || event.target !== myPlayerIndex || seenDistractEventsRef.current.has(event.eventId)) return;
      seenDistractEventsRef.current.add(event.eventId);
      setShakeBursts((value) => value + 1);
    });
  }, [data?.distractEvents, myPlayerIndex]);

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
    if (!flashBadge) return undefined;
    const timer = window.setTimeout(() => setFlashBadge(''), 850);
    return () => window.clearTimeout(timer);
  }, [flashBadge]);

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
    setBackToBack(false);
    setAttackNotice('');
    setFlashBadge('');
    setSendPulse(0);
    setIncomingPulse(0);
    setGarbageImpact(0);
    setShakeBursts(0);
    lockResetCountRef.current = 0;
    lastAttackRef.current = { lastCleared: 0, attackKey: '', attackLines: 0 };
    lastClearMetaRef.current = { tspin: false, b2b: false, perfectClear: false };
    lastMoveWasRotateRef.current = false;
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
    const tspin = isTSpin(merged, targetPiece, lastMoveWasRotateRef.current);
    const difficultClear = result.cleared > 0 && (tspin || result.cleared >= 4);
    const nextBackToBack = result.cleared > 0 ? (difficultClear ? true : false) : backToBack;
    const b2bAwarded = difficultClear && backToBack;
    const perfectClear = result.cleared > 0 && isBoardEmpty(result.board);
    const rawOutgoingPower = outgoingAttackPower(result.cleared, nextCombo, tspin, b2bAwarded, perfectClear);
    const cancelPower = result.cleared > 0 ? Math.max(1, rawOutgoingPower) : 0;
    const queuedGarbage = pendingGarbageRef.current;
    let nextPendingGarbage = queuedGarbage;
    let nextBoard = result.board;
    let outgoingAttackLines = rawOutgoingPower;
    let overflow = false;
    let notice = '';
    let badge = '';
    let sentAttack = false;
    let appliedGarbage = false;

    if (cancelPower > 0 && queuedGarbage > 0) {
      const canceled = Math.min(queuedGarbage, cancelPower);
      nextPendingGarbage = queuedGarbage - canceled;
      outgoingAttackLines = Math.max(0, rawOutgoingPower - canceled);
      sentAttack = outgoingAttackLines > 0;
      notice = outgoingAttackLines > 0 ? `cancel -${canceled} / send +${outgoingAttackLines}` : `cancel -${canceled}`;
    } else if (result.cleared === 0 && queuedGarbage > 0) {
      const applyCount = Math.min(8, queuedGarbage);
      overflow = result.board.slice(0, applyCount).some((row) => row.some(Boolean));
      const garbageResult = addGarbageLines(result.board, applyCount, garbageHoleRef.current);
      nextBoard = garbageResult.board;
      garbageHoleRef.current = garbageResult.hole;
      nextPendingGarbage = queuedGarbage - applyCount;
      appliedGarbage = true;
      notice = `garbage +${applyCount}`;
    } else if (rawOutgoingPower > 0) {
      const tags = [tspin ? 'T-spin' : '', b2bAwarded ? 'B2B' : '', perfectClear ? 'PC' : ''].filter(Boolean).join(' ');
      sentAttack = true;
      notice = `${tags ? `${tags} ` : ''}send +${rawOutgoingPower}`;
    } else if (result.cleared > 0) {
      notice = `${tspin ? 'T-spin ' : ''}clear x${result.cleared}${perfectClear ? ' PC' : ''}`;
    }
    if (perfectClear) badge = 'PERFECT CLEAR';
    else if (tspin) badge = b2bAwarded ? 'B2B T-SPIN' : 'T-SPIN';
    else if (b2bAwarded) badge = 'BACK TO BACK';
    else if (nextCombo >= 2) badge = `COMBO x${nextCombo}`;

    const commitLock = () => {
      clearAnimationRef.current = null;
      setClearingRows([]);
      setResolvingClear(false);

      const gained = scoreForClear(result.cleared, tspin, b2bAwarded, perfectClear);
      const spawned = takeNextPiece();
      attackSeqRef.current += 1;
      lastAttackRef.current = {
        lastCleared: result.cleared,
        attackKey: `${sessionId}:${Date.now()}:${attackSeqRef.current}`,
        attackLines: outgoingAttackLines,
      };
      lastClearMetaRef.current = { tspin, b2b: b2bAwarded, perfectClear };
      lastMoveWasRotateRef.current = false;

      pendingGarbageRef.current = nextPendingGarbage;
      setPendingGarbage(nextPendingGarbage);
      setClearCombo(nextCombo);
      setBackToBack(nextBackToBack);
      setAttackNotice(notice);
      if (badge) setFlashBadge(badge);
      if (sentAttack) setSendPulse((value) => value + 1);
      if (appliedGarbage) setGarbageImpact((value) => value + 1);
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
  }, [backToBack, clearCombo, clearLockDelay, piece, resolvingClear, sessionId, takeNextPiece]);

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
    setIncomingPulse((value) => value + 1);
    setFlashBadge(`INCOMING +${totalLines}`);
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
    lastMoveWasRotateRef.current = false;
    if (onGround) scheduleLock();
    return true;
  }, [active, board, clearLockDelay, piece, resetLockDelayForMove, scheduleLock]);

  useEffect(() => {
    moveRef.current = move;
  }, [move]);

  const rotate = useCallback(() => {
    if (!active || piece.type === 'O') return;
    const shape = rotateShape(piece.shape);
    const nextRotation = (piece.rotation + 1) % 4;
    const offsets = kickOffsets(piece.type, piece.rotation, nextRotation);
    const offset = offsets.find((candidate) => !collides(board, piece, piece.row + candidate.dr, piece.col + candidate.dc, shape));
    if (offset !== undefined) {
      const nextPiece = { ...piece, shape, row: piece.row + offset.dr, col: piece.col + offset.dc, rotation: nextRotation };
      const onGround = collides(board, nextPiece, nextPiece.row + 1, nextPiece.col);
      if (!onGround) {
        clearLockDelay(true);
      } else if (!resetLockDelayForMove()) {
        return;
      }
      setPiece(nextPiece);
      lastMoveWasRotateRef.current = true;
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
    lastMoveWasRotateRef.current = false;
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
    lastMoveWasRotateRef.current = false;
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
      board: publicBoard,
      score,
      lines,
      cycle,
      running,
      gameOver,
      lastCleared: lastAttackRef.current.lastCleared,
      attackKey: lastAttackRef.current.attackKey,
      attackLines: lastAttackRef.current.attackLines,
      tspin: lastClearMetaRef.current.tspin,
      b2b: lastClearMetaRef.current.b2b,
      perfectClear: lastClearMetaRef.current.perfectClear,
      ackAttackIds,
    };
    syncPayloadRef.current = payload;
  }, [cycle, gameOver, lines, publicBoard, running, score]);

  useEffect(() => {
    if (studyState?.status !== 'PLAYING' || myPlayerIndex < 0) return undefined;
    const sync = () => {
      const payload = {
        ...(syncPayloadRef.current as object),
        lastCleared: lastAttackRef.current.lastCleared,
        attackKey: lastAttackRef.current.attackKey,
        attackLines: lastAttackRef.current.attackLines,
        tspin: lastClearMetaRef.current.tspin,
        b2b: lastClearMetaRef.current.b2b,
        perfectClear: lastClearMetaRef.current.perfectClear,
        ackAttackIds: ackAttackIdsRef.current,
      };
      sendMove({
        moveType: 'TETRIS_SYNC',
        data: gameOver ? 'queue_overflow' : 'sync',
        sessionId,
        payload,
      });
      lastAttackRef.current = { lastCleared: 0, attackKey: '', attackLines: 0 };
      lastClearMetaRef.current = { tspin: false, b2b: false, perfectClear: false };
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
    horizontalDirectionRef.current = null;
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
    if (horizontalDirectionRef.current === direction && (horizontalHoldRef.current !== null || horizontalDelayRef.current !== null)) return;
    if (horizontalDirectionRef.current !== null && horizontalDirectionRef.current !== direction) stopHorizontalHold();
    horizontalDirectionRef.current = direction;
    moveRef.current(0, direction);
    horizontalDelayRef.current = window.setTimeout(() => {
      horizontalDelayRef.current = null;
      horizontalHoldRef.current = window.setInterval(() => moveRef.current(0, direction), arrInterval);
    }, dasDelay);
  }, [active, arrInterval, dasDelay, stopHorizontalHold]);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const isTyping = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || Boolean(target?.isContentEditable);
    if (isTyping) return;
    if (!isTyping && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      setGhostEnabled((value) => !value);
      return;
    }
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'c', 'C', 'p', 'P', 'r', 'R'];
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

  const sendDistract = useCallback((target: number) => {
    if (target === myPlayerIndex || studyState?.status !== 'PLAYING') return;
    sendMove({
      moveType: 'TETRIS_DISTRACT',
      data: 'shake',
      sessionId,
      payload: { target },
    });
  }, [myPlayerIndex, sendMove, sessionId, studyState?.status]);

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
        <MetricsPanel
          paused={globalPaused}
          open={settingsOpen}
          dasDelay={dasDelay}
          arrInterval={arrInterval}
          cellAlpha={cellAlpha}
          onToggle={() => setSettingsOpen((open) => !open)}
          onCellAlpha={setCellAlpha}
          onDasDelay={updateDasDelay}
          onArrInterval={updateArrInterval}
          onPause={toggleGlobalPause}
          onRestart={requestGlobalRestart}
          canRestart={isHost}
        />
        <div className="tetris-board-row">
          {centeredBoardViews.map(({ name, index, state, board: viewBoard, isMe }) => (
            <div key={index} className={`tetris-player-stack ${isMe ? 'mine' : ''}`}>
              {isMe && <HoldRail holdPiece={holdPiece} />}
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
              shakeKey={isMe ? shakeBursts : 0}
              sendPulseKey={isMe ? sendPulse : 0}
              incomingPulseKey={isMe ? incomingPulse : 0}
              impactKey={isMe ? garbageImpact : 0}
              badge={isMe ? flashBadge : ''}
              onDistract={!isMe ? () => sendDistract(index) : undefined}
              clearingRows={isMe ? clearingRows : []}
              style={isMe ? boardStyle : undefined}
            />
              {isMe && <NextRail nextQueue={nextQueue} />}
            </div>
          ))}
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

function NextRail({ nextQueue }: { nextQueue: Piece[] }) {
  return (
    <div className="tetris-next-rail" aria-label="next blocks">
      <div className="dim">next</div>
      {nextQueue.map((next, index) => (
        <Preview key={`${next.type}-${index}`} title={`${index + 1}`} piece={next} compact />
      ))}
    </div>
  );
}

function HoldRail({ holdPiece }: { holdPiece: Piece | null }) {
  return (
    <div className="tetris-hold-rail" aria-label="hold block">
      <div className="dim">hold</div>
      <Preview title="hold" piece={holdPiece} compact />
    </div>
  );
}

function MetricsPanel({
  paused, open, dasDelay, arrInterval,
  cellAlpha, onToggle, onCellAlpha, onDasDelay, onArrInterval, onPause, onRestart, canRestart,
}: {
  paused: boolean;
  open: boolean;
  dasDelay: number;
  arrInterval: number;
  cellAlpha: number;
  onToggle: () => void;
  onCellAlpha: (value: number) => void;
  onDasDelay: (value: number) => void;
  onArrInterval: (value: number) => void;
  onPause: () => void;
  onRestart: () => void;
  canRestart: boolean;
}) {
  return (
    <div className="tetris-controls-dock">
      <div className="tetris-actions">
        <button className="btn-secondary" onClick={onPause}>
          {paused ? 'resume' : 'pause'}
        </button>
        <button className="btn-primary" onClick={onRestart} disabled={!canRestart}>restart</button>
        <button className="btn-secondary" onClick={onToggle} aria-expanded={open}>tune</button>
      </div>
      {open && (
        <div className="tetris-settings-popover">
          <div className="tetris-control-list">
            <label>
              <span><span className="var">visibility</span><span className="num">{cellAlpha}%</span></span>
              <input className="tetris-range" type="range" min={22} max={82} value={cellAlpha} onChange={(event) => onCellAlpha(Number(event.target.value))} />
            </label>
            <label>
              <span><span className="var">DAS</span><span className="num">{dasDelay}ms</span></span>
              <input className="tetris-range" type="range" min={70} max={220} value={dasDelay} onChange={(event) => onDasDelay(Number(event.target.value))} />
            </label>
            <label>
              <span><span className="var">ARR</span><span className="num">{arrInterval}ms</span></span>
              <input className="tetris-range" type="range" min={16} max={90} value={arrInterval} onChange={(event) => onArrInterval(Number(event.target.value))} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function BoardShell({
  name, board, score, lines, cycle, status, pending, winner, isMe, shakeKey, sendPulseKey, incomingPulseKey, impactKey, badge, onDistract, clearingRows, style,
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
  shakeKey: number;
  sendPulseKey: number;
  incomingPulseKey: number;
  impactKey: number;
  badge: string;
  onDistract?: () => void;
  clearingRows: number[];
  style?: CSSProperties;
}) {
  const gaugeCount = Math.min(12, pending);
  const clearingRowSet = useMemo(() => new Set(clearingRows), [clearingRows]);
  const cellClass = (cell: string, row: number) => {
    if (cell.startsWith('ghost-')) {
      return `tetris-cell ghost t-${cell.slice(6)} ${clearingRowSet.has(row) ? 'clearing' : ''}`;
    }
    return `tetris-cell ${cell ? `filled t-${cell}` : ''} ${clearingRowSet.has(row) ? 'clearing' : ''}`;
  };
  return (
    <div className={`tetris-shell ${isMe ? 'mine' : 'peer'} ${onDistract ? 'distractable' : ''}`} onClick={onDistract}>
      <div className="tetris-head">
        <span><span className={isMe ? 'var' : 'str'}>{isMe ? 'me' : `"${name}"`}</span></span>
        <span><span className="var">status</span><span className="pct">: </span><span className={winner ? 'typ' : status === 'overflow' ? 'str' : status === 'running' ? 'typ' : 'dim'}>{winner ? 'winner' : status}</span></span>
        <span><span className="var">cycle</span><span className="pct">: </span><span className="num">{cycle}</span></span>
      </div>
      <div
        key={`${shakeKey}-${impactKey}`}
        className={`${shakeKey > 0 ? 'tetris-shake-burst' : ''} ${impactKey > 0 ? 'tetris-garbage-impact' : ''}`}
      >
        <div className="tetris-board" style={style}>
          {sendPulseKey > 0 && <div key={sendPulseKey} className="tetris-send-pulse" />}
          {incomingPulseKey > 0 && <div key={incomingPulseKey} className="tetris-incoming-pulse" />}
          {badge && <div key={badge} className="tetris-flash-badge">{badge}</div>}
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
              className={cellClass(cell, r)}
              title={`${name} slot ${r + 1}.${c + 1}`}
            />
          )))}
        </div>
      </div>
      <div className="tetris-board-metrics">
        <span><span className="var">score</span><span className="pct">: </span><span className="num">{score}</span></span>
        <span><span className="var">lines</span><span className="pct">: </span><span className="num">{lines}</span></span>
        <span><span className="var">incoming</span><span className="pct">: </span><span className={pending > 0 ? 'str' : 'num'}>{pending}</span></span>
      </div>
    </div>
  );
}

function Preview({ title, piece, compact = false }: { title: string; piece: Piece | null; compact?: boolean }) {
  return (
    <div className={`tetris-preview ${compact ? 'compact' : ''}`}>
      <div className="dim">{title}</div>
      <div className={`tetris-mini ${compact ? 'small' : ''} ${piece ? '' : 'empty'}`}>
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

function CL({ ln, children }: { ln: number; children: ReactNode }) {
  return (
    <div className="c-line">
      <span className="ln">{ln}</span>
      <span className="c-line-body">{children}</span>
    </div>
  );
}
