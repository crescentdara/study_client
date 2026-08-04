import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { StudyMoveRequest, StudyStateResponse, TetrisGameData, TetrisGarbageAttack, TetrisPlayerRecord } from '../../types';

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
const TETRIS_VIEW_MODE_KEY = 'study.tetrisViewMode';

type TetrisViewMode = 'classic' | 'sheet';

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

type TetrisAttackEvent = {
  lastCleared: number;
  attackKey: string;
  attackLines: number;
  tspin: boolean;
  b2b: boolean;
  perfectClear: boolean;
};

type TetrisBoardView = {
  name: string;
  index: number;
  state: TetrisGameData['playerStates'][string] | undefined;
  board: Board;
  record: TetrisPlayerRecord | undefined;
  isMe: boolean;
};

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
  workspaceMode?: 'vscode' | 'excel';
  onLeave?: () => void;
  onRestart?: () => void;
}

const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill('') as string[]);

const isValidBoard = (value: unknown): value is Board => (
  Array.isArray(value)
  && value.length === ROWS
  && value.every((row) => (
    Array.isArray(row)
    && row.length === COLS
    && row.every((cell) => typeof cell === 'string')
  ))
);

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

const readViewMode = (): TetrisViewMode => {
  const stored = localStorage.getItem(TETRIS_VIEW_MODE_KEY);
  return stored === 'sheet' || stored === 'ide' ? 'sheet' : 'classic';
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
  const pivotOffsets = [
    { row: 1, col: 1 },
    { row: 1, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 1 },
  ];
  const pivot = pivotOffsets[piece.rotation] ?? pivotOffsets[0];
  const pivotRow = piece.row + pivot.row;
  const pivotCol = piece.col + pivot.col;
  const corners = [
    [pivotRow - 1, pivotCol - 1],
    [pivotRow - 1, pivotCol + 1],
    [pivotRow + 1, pivotCol - 1],
    [pivotRow + 1, pivotCol + 1],
  ];
  const blocked = corners.filter(([row, col]) => (
    row < 0 || row >= ROWS || col < 0 || col >= COLS || Boolean(board[row][col])
  )).length;
  return blocked >= 3;
};

export default function Tetris({ studyState, sessionId, myPlayerIndex, sendMove, workspaceMode = 'vscode', onLeave, onRestart }: Props) {
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
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<TetrisViewMode>(readViewMode);
  const renderedViewMode: TetrisViewMode = workspaceMode === 'excel' ? 'sheet' : viewMode;
  const [resultDismissed, setResultDismissed] = useState(false);
  const [localGameInstanceId, setLocalGameInstanceId] = useState('');
  const horizontalHoldRef = useRef<number | null>(null);
  const horizontalDelayRef = useRef<number | null>(null);
  const horizontalDirectionRef = useRef<-1 | 1 | null>(null);
  const lockDelayRef = useRef<number | null>(null);
  const lockResetCountRef = useRef(0);
  const clearAnimationRef = useRef<number | null>(null);
  const moveRef = useRef<(dr: number, dc: number) => boolean>(() => false);
  const syncPayloadRef = useRef<object>({});
  const attackSeqRef = useRef(0);
  const pendingAttackEventsRef = useRef<TetrisAttackEvent[]>([]);
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
  const rankedMatch = data?.rankedMatch ?? ((data?.numPlayers ?? playerNames.length) >= 2);
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
  const boardViews: TetrisBoardView[] = playerNames.map((name, index) => {
    const state = data?.playerStates?.[String(index)];
    return {
      name,
      index,
      state,
      board: index === myPlayerIndex
        ? projectedBoard
        : isValidBoard(state?.board)
          ? removeGhostCells(state.board)
          : emptyBoard(),
      record: data?.records?.[name],
      isMe: index === myPlayerIndex,
    };
  });
  const centeredBoardViews = [
    ...boardViews.filter((view) => !view.isMe).slice(0, 1),
    ...boardViews.filter((view) => view.isMe),
    ...boardViews.filter((view) => !view.isMe).slice(1),
  ];
  const myNickname = playerNames[myPlayerIndex] ?? '';
  const myRecord = data?.records?.[myNickname];
  const finalRankingNames = (data?.finalRanking ?? [])
    .map((index) => playerNames[index])
    .filter((name): name is string => Boolean(name));

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
    setResultDismissed(false);
    lockResetCountRef.current = 0;
    pendingAttackEventsRef.current = [];
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

  useEffect(() => {
    if (!gameInstanceId) return;
    if (gameInstanceRef.current && gameInstanceRef.current !== gameInstanceId) {
      reset();
    }
    gameInstanceRef.current = gameInstanceId;
    setLocalGameInstanceId(gameInstanceId);
  }, [gameInstanceId, reset]);

  const lockPiece = useCallback((targetPiece = piece) => {
    if (resolvingClear) return;
    clearLockDelay();
    const merged = mergePiece(boardRef.current, targetPiece);
    const result = clearLines(merged);
    const nextCombo = result.cleared > 0 ? clearCombo + 1 : 0;
    const tspin = isTSpin(boardRef.current, targetPiece, lastMoveWasRotateRef.current);
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
      pendingAttackEventsRef.current.push({
        lastCleared: result.cleared,
        attackKey: `${sessionId}:${Date.now()}:${attackSeqRef.current}`,
        attackLines: outgoingAttackLines,
        tspin,
        b2b: b2bAwarded,
        perfectClear,
      });
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
    if (!gameInstanceId || localGameInstanceId !== gameInstanceId) return;
    const ackAttackIds = ackAttackIdsRef.current;
    const payload = {
      instanceId: gameInstanceId,
      board: publicBoard,
      score,
      lines,
      cycle,
      running,
      gameOver,
      ackAttackIds,
    };
    syncPayloadRef.current = payload;
  }, [cycle, gameInstanceId, gameOver, lines, localGameInstanceId, publicBoard, running, score]);

  useEffect(() => {
    if (
      studyState?.status !== 'PLAYING'
      || myPlayerIndex < 0
      || !gameInstanceId
      || localGameInstanceId !== gameInstanceId
    ) return undefined;
    const sync = () => {
      const attackEvents = pendingAttackEventsRef.current;
      pendingAttackEventsRef.current = [];
      const payload = {
        ...(syncPayloadRef.current as object),
        attackEvents,
        ackAttackIds: ackAttackIdsRef.current,
      };
      sendMove({
        moveType: 'TETRIS_SYNC',
        data: gameOver ? 'queue_overflow' : 'sync',
        sessionId,
        payload,
      });
      ackAttackIdsRef.current = [];
    };
    sync();
    const timer = window.setInterval(sync, SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [gameInstanceId, gameOver, localGameInstanceId, myPlayerIndex, sendMove, sessionId, studyState?.status]);

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
    if (event.key === 'F8') {
      event.preventDefault();
      setViewMode((current) => {
        const next = current === 'classic' ? 'sheet' : 'classic';
        localStorage.setItem(TETRIS_VIEW_MODE_KEY, next);
        return next;
      });
      return;
    }
    if (!isTyping && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      setGhostEnabled((value) => !value);
      return;
    }
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'c', 'C', 'p', 'P'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') startHorizontalHold(-1);
    if (event.key === 'ArrowRight') startHorizontalHold(1);
    if (event.key === 'ArrowDown') move(1, 0);
    if (event.key === 'ArrowUp') rotate();
    if (event.key === ' ') hardDrop();
    if (event.key.toLowerCase() === 'c') hold();
    if (event.key.toLowerCase() === 'p' && isHost) {
      clearLockDelay();
      toggleGlobalPause();
    }
  }, [hardDrop, hold, isHost, move, rotate, startHorizontalHold, toggleGlobalPause]);

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

  const updateViewMode = useCallback((mode: TetrisViewMode) => {
    setViewMode(mode);
    localStorage.setItem(TETRIS_VIEW_MODE_KEY, mode);
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

  const myStatus = gameOver
    ? 'overflow'
    : countdown > 0
      ? `${countdown}`
      : globalPaused
        ? 'paused'
        : running
          ? 'running'
          : 'stopped';

  const controls = (
    <>
      <MetricsPanel
        paused={globalPaused}
        open={settingsOpen}
        recordsOpen={recordsOpen}
        viewMode={renderedViewMode}
        dasDelay={dasDelay}
        arrInterval={arrInterval}
        cellAlpha={cellAlpha}
        nickname={myNickname}
        record={myRecord}
        onToggle={() => {
          setRecordsOpen(false);
          setSettingsOpen((open) => !open);
        }}
        onRecordsToggle={() => {
          setSettingsOpen(false);
          setRecordsOpen((open) => !open);
        }}
        onViewMode={updateViewMode}
        onCellAlpha={setCellAlpha}
        onDasDelay={updateDasDelay}
        onArrInterval={updateArrInterval}
        onPause={toggleGlobalPause}
        canPause={isHost}
      />
      {workspaceMode === 'excel' && (
        <div className="tetris-sheet-session-actions">
          {isHost && studyState?.status === 'FINISHED' && onRestart && (
            <button type="button" className="tetris-sheet-restart" onClick={onRestart}>↺ 재시작</button>
          )}
          {onLeave && <button type="button" className="tetris-sheet-exit" onClick={onLeave}>종료 · 로비로 이동</button>}
        </div>
      )}
    </>
  );

  return (
    <div className={`tetris-workspace mode-${renderedViewMode}`} tabIndex={0}>
      {renderedViewMode === 'classic' ? (
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
        {controls}
        {!rankedMatch && <div className="tetris-practice-notice">PRACTICE · 배치 및 전적 미반영</div>}
        <div className="tetris-board-row">
          {centeredBoardViews.map(({ name, index, state, board: viewBoard, record, isMe }) => (
            <div key={index} className={`tetris-player-stack ${isMe ? 'mine' : ''}`}>
              {isMe && <HoldRail holdPiece={holdPiece} />}
              <BoardShell
              name={name}
              board={viewBoard}
              score={isMe ? score : state?.score ?? 0}
              lines={isMe ? lines : state?.lines ?? 0}
              cycle={isMe ? cycle : state?.cycle ?? 1}
              status={isMe ? myStatus : state?.gameOver ? 'overflow' : globalPaused ? 'paused' : state ? 'running' : 'waiting'}
              pending={isMe ? pendingGarbage : data?.garbageQueues?.[String(index)]?.reduce((sum, attack) => sum + Math.max(0, attack.lines), 0) ?? 0}
              winner={studyState?.winner === index}
              record={record}
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
      ) : (
        <TetrisSpreadsheetView
          controls={controls}
          views={centeredBoardViews}
          myPlayerIndex={myPlayerIndex}
          score={score}
          lines={lines}
          cycle={cycle}
          status={myStatus}
          pending={pendingGarbage}
          holdPiece={holdPiece}
          nextQueue={nextQueue}
          winner={studyState?.winner ?? -1}
          badge={flashBadge}
          clearingRows={clearingRows}
          boardStyle={boardStyle}
          globalPaused={globalPaused}
          rankedMatch={rankedMatch}
          onDistract={sendDistract}
        />
      )}

      {!resultDismissed && (
        (studyState?.status === 'FINISHED' && (data?.aborted || finalRankingNames.length > 0))
        || Boolean(data?.previousAbortReason)
      ) && (
        <TetrisResultDialog
          aborted={Boolean(data?.aborted || data?.previousAbortReason)}
          abortReason={data?.abortReason || data?.previousAbortReason || ''}
          ranking={finalRankingNames}
          records={data?.records ?? {}}
          nickname={myNickname}
          matchId={gameInstanceId}
          onClose={() => setResultDismissed(true)}
        />
      )}
      {globalPaused && <TetrisWorkCover />}
    </div>
  );
}

const TETRIS_SHEET_DUMMY_VALUES = [
  'API-427', 'PR #1842', '배포 대기', '테스트 완료', 'v2.14.7', '92.4%', 'Redis', 'FE-318',
  '리뷰 요청', 'main', 'CI 통과', 'Node 22', 'BUG-091', '담당:BE', '2026-08-03', '3f92ac1',
  '스키마 검토', '로그 확인', 'Sprint 18', 'QA 진행', 'Docker', '응답 142ms', '완료', '개발 중',
];

const TETRIS_SHEET_DUMMY_CELLS = Array.from({ length: 30 * 28 }, (_, index) => (
  TETRIS_SHEET_DUMMY_VALUES[(index * 7 + Math.floor(index / 30) * 3) % TETRIS_SHEET_DUMMY_VALUES.length]
));

const SheetDummyGrid = memo(function SheetDummyGrid() {
  return (
    <div className="tetris-sheet-dummy-grid" aria-hidden="true">
      {TETRIS_SHEET_DUMMY_CELLS.map((value, index) => <i key={index}>{value}</i>)}
    </div>
  );
});

function TetrisSpreadsheetView({
  controls, views, myPlayerIndex, score, lines, cycle, status, pending,
  holdPiece, nextQueue, winner, badge, clearingRows, boardStyle, globalPaused, rankedMatch, onDistract,
}: {
  controls: ReactNode;
  views: TetrisBoardView[];
  myPlayerIndex: number;
  score: number;
  lines: number;
  cycle: number;
  status: string;
  pending: number;
  holdPiece: Piece | null;
  nextQueue: Piece[];
  winner: number;
  badge: string;
  clearingRows: number[];
  boardStyle: CSSProperties;
  globalPaused: boolean;
  rankedMatch: boolean;
  onDistract: (target: number) => void;
}) {
  return (
    <section className="tetris-sheet" style={boardStyle} aria-label="스프레드시트 플레이 화면">
      <header className="tetris-sheet-titlebar">
        <span className="tetris-sheet-appmark">▦</span>
        <span>2026년 하반기 운영실적_최종.xlsx</span>
        {controls}
      </header>
      <div className="tetris-sheet-ribbon">
        <div className="tetris-sheet-tabs"><b>파일</b><span>홈</span><span>삽입</span><span>페이지 레이아웃</span><span>수식</span><span>데이터</span><span>검토</span><span>보기</span></div>
        <div className="tetris-sheet-tools" aria-hidden="true"><span>붙여넣기</span><span>글꼴　맑은 고딕　10</span><span>맞춤</span><span>표시 형식　일반</span><span>조건부 서식</span><span>정렬 및 필터</span></div>
      </div>
      <div className="tetris-sheet-formula"><b>F8</b><span>fx</span><span>=SUMIFS(운영실적[처리건수], 운영실적[상태], "정상")</span></div>
      <div className="tetris-sheet-body">
        <main className="tetris-sheet-arena">
          <SheetDummyGrid />
          <div className="tetris-sheet-arena-meta">
            <span>참여 인원 <b>{views.length} / 3</b></span>
            <span>처리 건수 <b>{score.toLocaleString('ko-KR')}</b></span>
            <span>정리 완료 <b>{lines}행</b></span>
            <span>버전 <b>v{cycle}.0</b></span>
            {pending > 0 && <span className="warning">확인 필요 <b>{pending}건</b></span>}
            {!rankedMatch && <span className="practice">연습 모드 · 전적 미반영</span>}
          </div>
          <div className="tetris-sheet-player-list">
            {views.slice(0, 3).map((view) => {
              const isMe = view.index === myPlayerIndex;
              const viewStatus = isMe
                ? status
                : view.state?.gameOver
                  ? 'overflow'
                  : globalPaused
                    ? 'paused'
                    : view.state
                      ? 'running'
                      : 'waiting';
              return (
                <section className={`tetris-sheet-player ${isMe ? 'mine' : 'peer'}`} key={view.index}>
                  <header className="tetris-sheet-player-head">
                    <strong>{view.name}{isMe ? ' · 내 작업' : ''}</strong>
                    <span>{winner === view.index ? '완료' : viewStatus}</span>
                    <small>{(isMe ? score : view.state?.score ?? 0).toLocaleString('ko-KR')}건 · {isMe ? lines : view.state?.lines ?? 0}행</small>
                    {!isMe && <button type="button" onClick={() => onDistract(view.index)}>새로 고침</button>}
                  </header>
                  <div className="tetris-sheet-player-game">
                    {isMe && (
                      <div className="tetris-sheet-piece-rail tetris-sheet-piece-rail--inline tetris-sheet-piece-rail--hold">
                        <SheetPieceToken label="HOLD" piece={holdPiece} />
                      </div>
                    )}
                    <SheetBoard board={view.board} status={viewStatus} pending={isMe ? pending : 0} badge={isMe ? badge : ''} clearingRows={isMe ? clearingRows : []} />
                    {isMe && (
                      <div className="tetris-sheet-piece-rail tetris-sheet-piece-rail--inline tetris-sheet-piece-rail--next">
                        {nextQueue.map((next, index) => (
                          <SheetPieceToken key={`${next.type}-${index}`} label={index === 0 ? 'NEXT' : `NEXT ${index + 1}`} piece={next} />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </main>
      </div>
      <footer className="tetris-sheet-statusbar">
        <span className="active">운영실적</span><span>Raw Data</span><span>요약</span><span>Archive</span><i />
        <small>{globalPaused ? '계산 일시 중지' : '준비'}　　보기: 100%　　F8 화면 전환</small>
      </footer>
    </section>
  );
}

function SheetBoard({ board, status, pending, badge, clearingRows }: {
  board: Board;
  status: string;
  pending: number;
  badge: string;
  clearingRows: number[];
}) {
  const clearingRowSet = useMemo(() => new Set(clearingRows), [clearingRows]);
  return (
    <div className="tetris-sheet-board">
      <div className="tetris-sheet-corner" />
      <div className="tetris-sheet-column-head">
        {Array.from({ length: COLS }, (_, col) => <b className="tetris-sheet-col" key={col}>{String.fromCharCode(70 + col)}</b>)}
      </div>
      <div className="tetris-sheet-row-head">
        {Array.from({ length: ROWS }, (_, rowIndex) => <b className="tetris-sheet-rownum" key={rowIndex}>{8 + rowIndex}</b>)}
      </div>
      <div className="tetris-sheet-playfield tetris-sheet-rowcells">
        {/^\d+$/.test(status) && <div className="tetris-sheet-countdown">데이터 새로 고침 중… {status}</div>}
        {badge && <div className="tetris-sheet-notice">✓ {badge.split('_').join(' ')}</div>}
        {pending > 0 && <div className="tetris-sheet-warning">검토 필요 {pending}건</div>}
        {board.flatMap((row, rowIndex) => row.map((cell, colIndex) => {
          const ghost = cell.startsWith('ghost-');
          const type = ghost ? cell.slice(6) : cell;
          return <i key={`${rowIndex}-${colIndex}`} className={`${type ? `filled t-${type}` : ''} ${ghost ? 'ghost' : ''} ${clearingRowSet.has(rowIndex) ? 'clearing' : ''}`} title={`${8 + rowIndex}행 ${String.fromCharCode(70 + colIndex)}열`} />;
        }))}
      </div>
    </div>
  );
}

function SheetPieceToken({ label, piece }: { label: string; piece: Piece | null }) {
  const height = piece?.shape.length ?? 0;
  const width = piece?.shape.reduce((max, row) => Math.max(max, row.length), 0) ?? 0;
  const rowOffset = Math.floor((4 - height) / 2);
  const colOffset = Math.floor((4 - width) / 2);

  return (
    <div className="tetris-sheet-task">
      <small>{label}</small>
      <span
        className={`tetris-sheet-piece-preview ${piece ? '' : 'empty'}`}
        role="img"
        aria-label={piece ? `${piece.type} 블록` : '미배정'}
      >
        {Array.from({ length: 16 }, (_, index) => {
          const row = Math.floor(index / 4) - rowOffset;
          const col = (index % 4) - colOffset;
          const filled = row >= 0 && col >= 0 && Boolean(piece?.shape[row]?.[col]);
          return <i key={index} className={filled ? `filled t-${piece?.type}` : ''} />;
        })}
        {!piece && <b>미배정</b>}
      </span>
    </div>
  );
}

function TetrisIdeView({
  controls, views, myPlayerIndex, score, lines, cycle, status, pending,
  holdPiece, nextQueue, winner, badge, clearingRows, boardStyle, globalPaused, onDistract,
}: {
  controls: ReactNode;
  views: TetrisBoardView[];
  myPlayerIndex: number;
  score: number;
  lines: number;
  cycle: number;
  status: string;
  pending: number;
  holdPiece: Piece | null;
  nextQueue: Piece[];
  winner: number;
  badge: string;
  clearingRows: number[];
  boardStyle: CSSProperties;
  globalPaused: boolean;
  onDistract: (target: number) => void;
}) {
  const mine = views.find((view) => view.index === myPlayerIndex);
  const peers = views.filter((view) => view.index !== myPlayerIndex);

  return (
    <section className="tetris-ide" style={boardStyle} aria-label="VS Code 플레이 화면">
      <header className="tetris-ide-titlebar">
        <span className="tetris-ide-appmark">◇</span>
        <span>queue.worker.ts — study-platform — Visual Studio Code</span>
        {controls}
      </header>
      <div className="tetris-ide-body">
        <nav className="tetris-ide-activity" aria-hidden="true">
          <span className="active">▱</span><span>⌕</span><span>⑂</span><span>▷</span><span>▦</span>
        </nav>
        <aside className="tetris-ide-explorer">
          <b>EXPLORER</b>
          <div className="tetris-ide-project">⌄ STUDY-PLATFORM</div>
          <span>⌄ src</span>
          <span>　⌄ services</span>
          <span className="active">　　TS queue.worker.ts</span>
          <span>　　TS sessionStore.ts</span>
          <span>　⌄ workers</span>
          <span>　　TS syncPipeline.ts</span>
          <div className="tetris-ide-outline-title">OUTLINE</div>
          <div className="tetris-ide-symbol"><span>◇ reconcileWorkspace</span><small>Ln {120 + lines}</small></div>
          <div className="tetris-ide-symbol"><span>◇ commitSnapshot</span><small>{score} refs</small></div>
          <div className="tetris-ide-piece-list">
            <IdePieceToken label="STAGED" piece={holdPiece} />
            {nextQueue.slice(0, 3).map((next, index) => (
              <IdePieceToken key={`${next.type}-${index}`} label={index === 0 ? 'NEXT TASK' : `QUEUE ${index + 1}`} piece={next} />
            ))}
          </div>
        </aside>
        <main className="tetris-ide-main">
          <div className="tetris-ide-tabs">
            <span className="active">TS　queue.worker.ts　×</span>
            <span>TS　sessionStore.ts　×</span>
            <span>◫　indexer.log　×</span>
          </div>
          <div className="tetris-ide-breadcrumb">src　›　services　›　queue.worker.ts　›　<span>reconcileWorkspace</span></div>
          <div className="tetris-ide-workarea">
            <div className="tetris-ide-editor">
              <CL ln={116}><span className="kw">export async function </span><span className="fn">reconcileWorkspace</span><span className="pct">{'() {'}</span></CL>
              <CL ln={117}>　<span className="kw">const </span><span className="var">snapshot</span><span className="pct"> = await </span><span className="fn">createSnapshot</span><span className="pct">({'{'}</span></CL>
              <IdeBoard
                board={mine?.board ?? emptyBoard()}
                status={status}
                pending={pending}
                badge={badge}
                clearingRows={clearingRows}
              />
              <CL ln={138}>　<span className="pct">{'});'}</span></CL>
              <CL ln={139}>　<span className="kw">return </span><span className="var">snapshot</span><span className="pct">;</span></CL>
              <CL ln={140}><span className="pct">{'}'}</span></CL>
            </div>
            <aside className="tetris-ide-minimap">
              <b>REMOTE WORKSPACES</b>
              {peers.map((view) => (
                <IdePeerPanel
                  key={view.index}
                  view={view}
                  winner={winner === view.index}
                  paused={globalPaused}
                  onClick={() => onDistract(view.index)}
                />
              ))}
              {peers.length === 0 && <span className="tetris-ide-no-peers">No remote sessions</span>}
            </aside>
          </div>
        </main>
      </div>
      <footer className="tetris-ide-statusbar">
        <span>⑂ main*</span>
        <span>↻ sync</span>
        <span className={pending > 0 ? 'warning' : ''}>ⓧ 0　△ {pending}</span>
        <span className="spacer" />
        <span>Ln {120 + lines}, Col {cycle}</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span>TypeScript</span>
        <span>F8: view</span>
      </footer>
    </section>
  );
}

function IdeBoard({
  board, status, pending, badge, clearingRows,
}: {
  board: Board;
  status: string;
  pending: number;
  badge: string;
  clearingRows: number[];
}) {
  const clearingRowSet = useMemo(() => new Set(clearingRows), [clearingRows]);
  return (
    <div className="tetris-ide-board-frame">
      {/^\d+$/.test(status) && <div className="tetris-ide-countdown">Indexing… {status}</div>}
      {badge && <div className="tetris-ide-diagnostic">✓ {badge.toLowerCase().split('_').join(' ')}</div>}
      {pending > 0 && <div className="tetris-ide-problems">△ {pending} pending changes</div>}
      {board.map((row, rowIndex) => (
        <div className="tetris-ide-code-row" key={rowIndex}>
          <span className="ln">{118 + rowIndex}</span>
          <span className="tetris-ide-indent">│</span>
          <span className={`tetris-ide-code-grid ${clearingRowSet.has(rowIndex) ? 'clearing' : ''}`}>
            {row.map((cell, colIndex) => {
              const ghost = cell.startsWith('ghost-');
              const type = ghost ? cell.slice(6) : cell;
              return (
                <i
                  key={colIndex}
                  className={`${type ? `filled t-${type}` : ''} ${ghost ? 'ghost' : ''}`}
                  title={`slot ${rowIndex + 1}.${colIndex + 1}`}
                >{type ? '■' : '·'}</i>
              );
            })}
          </span>
          <span className="tetris-ide-comment">{rowIndex === 0 ? '// snapshot buffer' : ''}</span>
        </div>
      ))}
    </div>
  );
}

function IdePieceToken({ label, piece }: { label: string; piece: Piece | null }) {
  return (
    <div className="tetris-ide-piece-token">
      <small>{label}</small>
      <span>{piece ? piece.shape.flatMap((row) => row).map((cell) => (cell ? '■' : '·')).join('') : 'unassigned'}</span>
    </div>
  );
}

function IdePeerPanel({
  view, winner, paused, onClick,
}: {
  view: TetrisBoardView;
  winner: boolean;
  paused: boolean;
  onClick: () => void;
}) {
  const pendingStatus = view.state?.gameOver ? 'offline' : paused ? 'paused' : view.state ? 'watching' : 'connecting';
  return (
    <button type="button" className="tetris-ide-peer" onClick={onClick} title="원격 세션에 흔들기 이벤트 보내기">
      <span className="tetris-ide-peer-head">
        <strong>{view.name}</strong>
        <small className={winner ? 'winner' : ''}>{winner ? 'merged' : pendingStatus}</small>
      </span>
      <span className="tetris-ide-peer-board">
        {view.board.flatMap((row, rowIndex) => row.map((cell, colIndex) => (
          <i key={`${rowIndex}-${colIndex}`} className={cell ? `filled t-${cell.replace('ghost-', '')}` : ''} />
        )))}
      </span>
      <span className="tetris-ide-peer-meta">{view.state?.score ?? 0} changes · {view.state?.lines ?? 0} commits</span>
    </button>
  );
}

// Keep the previous renderer type-checked while the spreadsheet theme fully replaces it in the UI.
void TetrisIdeView;

function TetrisWorkCover() {
  return (
    <div className="tetris-work-cover" aria-hidden="true">
      <div className="tetris-work-cover-tabs">
        <span className="active">운영실적</span>
        <span>Raw Data</span>
        <span>월간 요약</span>
      </div>
      <div className="tetris-work-cover-body">
        <aside>
          <b>보고서 필터</b>
          <span>기간　2026 하반기</span>
          <span>구분　전체</span>
          <span className="active">상태　정상</span>
          <span>담당　운영팀</span>
          <span>지역　전체</span>
        </aside>
        <main>
          <div className="tetris-cover-row header"><b>관리번호</b><b>기준일</b><b>부서</b><b>처리건수</b><b>달성률</b><b>상태</b></div>
          {Array.from({ length: 12 }, (_, index) => <div className="tetris-cover-row" key={index}><span>P-{310 + index}</span><span>2026-07-{String(index + 1).padStart(2, '0')}</span><span>{index % 3 === 0 ? '운영1팀' : index % 3 === 1 ? '운영2팀' : '지원팀'}</span><span>{(1280 + index * 137).toLocaleString('ko-KR')}</span><span>{82 + (index % 14)}%</span><span>정상</span></div>)}
        </main>
      </div>
      <div className="tetris-work-cover-status">
        <span>준비</span>
        <span>접근성: 양호</span>
        <span>보기 100%</span>
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
  paused, open, recordsOpen, viewMode, dasDelay, arrInterval,
  cellAlpha, nickname, record, onToggle, onRecordsToggle, onViewMode, onCellAlpha, onDasDelay, onArrInterval, onPause, canPause,
}: {
  paused: boolean;
  open: boolean;
  recordsOpen: boolean;
  viewMode: TetrisViewMode;
  dasDelay: number;
  arrInterval: number;
  cellAlpha: number;
  nickname: string;
  record?: TetrisPlayerRecord;
  onToggle: () => void;
  onRecordsToggle: () => void;
  onViewMode: (mode: TetrisViewMode) => void;
  onCellAlpha: (value: number) => void;
  onDasDelay: (value: number) => void;
  onArrInterval: (value: number) => void;
  onPause: () => void;
  canPause: boolean;
}) {
  return (
    <div className="tetris-controls-dock">
      <div className="tetris-actions">
        <button className="btn-secondary" onClick={onPause} disabled={!canPause}>
          {viewMode === 'sheet' ? (paused ? '계산 재개' : '계산 중지') : (paused ? 'resume' : 'pause')}
        </button>
        <button className="btn-secondary" onClick={onToggle} aria-expanded={open}>{viewMode === 'sheet' ? '서식' : 'tune'}</button>
        <button
          className={`btn-secondary tetris-record-button ${recordsOpen ? 'active' : ''}`}
          onClick={onRecordsToggle}
          aria-expanded={recordsOpen}
          aria-controls="tetris-record-panel"
          title="내 종합 전적과 상대별 전적 보기"
        >
          <TetrisRankEmblem tier={record?.ranked ? record.tier : 'UNRANKED'} compact />
          <span>{viewMode === 'sheet' ? (recordsOpen ? '기록 닫기' : '변경 기록') : (recordsOpen ? '전적 닫기' : '전적 보기')}</span>
          <b>{rankLabel(record)}</b>
        </button>
      </div>
      {open && (
        <div className="tetris-settings-popover">
          <div className="tetris-control-list">
            <div className="tetris-mode-setting">
              <span><span className="var">view</span><span className="dim">F8</span></span>
              <div className="tetris-mode-switch" role="group" aria-label="테트리스 화면 모드">
                <button type="button" className={viewMode === 'classic' ? 'active' : ''} onClick={() => onViewMode('classic')}>classic</button>
                <button type="button" className={viewMode === 'sheet' ? 'active' : ''} onClick={() => onViewMode('sheet')}>Spreadsheet</button>
              </div>
            </div>
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
      {recordsOpen && <TetrisRecordPanel nickname={nickname} record={record} onClose={onRecordsToggle} />}
    </div>
  );
}

const recordRate = (wins: number, losses: number) => {
  const total = wins + losses;
  return total > 0 ? `${((wins / total) * 100).toFixed(1)}%` : '—';
};

const TIER_LABELS: Record<TetrisPlayerRecord['tier'], string> = {
  UNRANKED: '배치 중',
  IRON: '아이언',
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플래티넘',
  EMERALD: '에메랄드',
  DIAMOND: '다이아몬드',
  MASTER: '마스터',
  GRANDMASTER: '그랜드마스터',
  CHALLENGER: '챌린저',
};

const TIER_LEVELS: Record<TetrisPlayerRecord['tier'], number> = {
  UNRANKED: 0, IRON: 1, BRONZE: 2, SILVER: 3, GOLD: 4, PLATINUM: 5,
  EMERALD: 6, DIAMOND: 7, MASTER: 8, GRANDMASTER: 9, CHALLENGER: 10,
};

function TetrisRankEmblem({ tier, compact = false }: { tier: TetrisPlayerRecord['tier']; compact?: boolean }) {
  const level = TIER_LEVELS[tier];
  return (
    <span className={`tetris-rank-emblem tier-${tier.toLowerCase()} ${compact ? 'compact' : ''}`} aria-label={TIER_LABELS[tier]}>
      <svg viewBox="0 0 60 64" role="img" aria-hidden="true">
        {level >= 4 && <><path className="wing" d="M21 22 8 12l5 16-9 7 17 1" /><path className="wing" d="m39 22 13-10-5 16 9 7-17 1" /></>}
        {level >= 8 && <path className="crown" d="m18 14 4-10 8 8 8-8 4 10-12 7z" />}
        <path className="shield" d="M30 8 47 18l-3 27-14 14-14-14-3-27z" />
        <path className="facet" d="m30 15 10 8-4 22-6 8-6-8-4-22z" />
        <path className="gem" d="m30 22 7 9-7 12-7-12z" />
        {level >= 2 && <path className="chevron" d="m18 48 12 11 12-11" />}
        {level >= 6 && <><circle cx="11" cy="41" r="2" /><circle cx="49" cy="41" r="2" /></>}
        {level === 0 && <text x="30" y="38" textAnchor="middle">?</text>}
      </svg>
    </span>
  );
}

const rankLabel = (record?: TetrisPlayerRecord) => {
  if (!record?.ranked) return `배치 ${record?.placementGames ?? 0}/${record?.placementRequired ?? 5}`;
  return `${TIER_LABELS[record.tier]}${record.division ? ` ${record.division}` : ''}`;
};

const displayStoredRank = (value: string) => {
  const [tier, ...division] = value.split(' ');
  const translated = TIER_LABELS[tier as TetrisPlayerRecord['tier']] ?? tier;
  return `${translated}${division.length ? ` ${division.join(' ')}` : ''}`;
};

const TIER_SHORT_LABELS: Record<TetrisPlayerRecord['tier'], string> = {
  UNRANKED: 'P', IRON: 'I', BRONZE: 'B', SILVER: 'S', GOLD: 'G', PLATINUM: 'P',
  EMERALD: 'E', DIAMOND: 'D', MASTER: 'M', GRANDMASTER: 'GM', CHALLENGER: 'C',
};

const compactRankLabel = (record?: TetrisPlayerRecord) => {
  if (!record?.ranked) return `P ${record?.placementGames ?? 0}/${record?.placementRequired ?? 5}`;
  return `${TIER_SHORT_LABELS[record.tier]}${record.division ? ` ${record.division}` : ''}`;
};

function TetrisRecordPanel({
  nickname, record, onClose,
}: {
  nickname: string;
  record?: TetrisPlayerRecord;
  onClose: () => void;
}) {
  return (
    <div id="tetris-record-panel" className="tetris-record-popover" role="region" aria-label="테트리스 전적">
      <div className="tetris-record-title">
        <div>
          <strong>내 테트리스 전적</strong>
          <span>{nickname || 'player'}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="전적 패널 닫기">×</button>
      </div>
      <TetrisRecordDetails record={record} showGuide />
    </div>
  );
}

function TetrisRecordDetails({
  record, showGuide = false,
}: {
  record?: TetrisPlayerRecord;
  showGuide?: boolean;
}) {
  const opponents = Object.entries(record?.opponents ?? {});
  const placementRequired = record?.placementRequired ?? 5;
  const placementGames = record?.placementGames ?? 0;
  const rankProgress = !record?.ranked
    ? Math.round((placementGames / placementRequired) * 100)
    : record.tier === 'CHALLENGER'
      ? 100
      : record.tier === 'GRANDMASTER'
        ? Math.round((Math.max(0, record.rp - 400) / 400) * 100)
        : record.tier === 'MASTER'
          ? Math.round((record.rp / 400) * 100)
          : record.rp;
  return (
    <>
      {showGuide && <p className="tetris-record-guide">정상 종료된 2인 이상 경기만 승패에 반영됩니다.</p>}
      <div className={`tetris-rank-card tier-${(record?.tier ?? 'UNRANKED').toLowerCase()}`}>
        <TetrisRankEmblem tier={record?.ranked ? record.tier : 'UNRANKED'} />
        <div className="tetris-rank-info">
          <small>{record?.ranked ? '현재 티어' : '배치고사'}</small>
          <strong>{rankLabel(record)}</strong>
          <div className="tetris-rank-progress"><i style={{ width: `${Math.min(100, rankProgress)}%` }} /></div>
          <span>{record?.ranked ? (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(record.tier) ? `${record.rp} RP` : `${record.rp} RP / 100 RP`) : `${placementRequired - placementGames}경기 남음`}</span>
        </div>
        {record && record.lastRankDelta !== 0 && (
          <div className={`tetris-rank-delta ${record.lastRankDelta > 0 ? 'gain' : 'loss'}`}>
            {record.lastRankDelta > 0 ? '+' : ''}{record.lastRankDelta} RP
            {record.lastRankChanged && <small>{record.lastRankBefore} → {record.lastRankAfter}</small>}
          </div>
        )}
      </div>
      <div className="tetris-record-summary">
        <span><small>전체 경기</small><b>{record?.matches ?? 0}</b></span>
        <span><small>승리</small><b className="win">{record?.wins ?? 0}</b></span>
        <span><small>패배</small><b className="loss">{record?.losses ?? 0}</b></span>
        <span><small>승률</small><b>{recordRate(record?.wins ?? 0, record?.losses ?? 0)}</b></span>
      </div>
      <h4 className="tetris-opponent-title">상대별 전적</h4>
      <div className="tetris-opponent-list">
        <div className="tetris-opponent-row header">
          <span>상대</span><span>승</span><span>패</span><span>승률</span>
        </div>
        {opponents.map(([opponent, result]) => (
          <div className="tetris-opponent-row" key={opponent}>
            <span>{opponent}</span>
            <span className="typ">{result.wins}</span>
            <span className="str">{result.losses}</span>
            <span>{recordRate(result.wins, result.losses)}</span>
          </div>
        ))}
        {opponents.length === 0 && (
          <div className="tetris-record-empty">
            <strong>아직 상대 전적이 없습니다.</strong>
            <span>2인 이상 경기를 정상 완료하면 여기에 표시됩니다.</span>
          </div>
        )}
      </div>
    </>
  );
}

function TetrisResultDialog({
  aborted, abortReason, ranking, records, nickname, matchId, onClose,
}: {
  aborted: boolean;
  abortReason: string;
  ranking: string[];
  records: Record<string, TetrisPlayerRecord>;
  nickname: string;
  matchId: string;
  onClose: () => void;
}) {
  const myRecord = records[nickname];
  const showPromotion = Boolean(
    !aborted
    && myRecord?.lastRankChanged
    && myRecord.lastRankMatchId === matchId
    && (myRecord.lastRankDelta > 0 || myRecord.lastRankBefore === 'UNRANKED'),
  );
  return (
    <div className="tetris-result-backdrop">
      <section className={`tetris-result-dialog ${aborted ? 'aborted' : ''}`} role="dialog" aria-modal="true">
        <div className="tetris-result-heading">
          <span className={aborted ? 'str' : 'typ'}>{aborted ? 'MATCH ABORTED' : 'MATCH FINISHED'}</span>
          <button type="button" onClick={onClose} aria-label="결과 닫기">×</button>
        </div>
        {showPromotion && myRecord && <TetrisPromotionCelebration record={myRecord} />}
        {aborted ? (
          <div className="tetris-abort-message">
            <strong>전적에 반영되지 않았습니다.</strong>
            <span>{abortReason || '경기가 정상적으로 완료되지 않았습니다.'}</span>
          </div>
        ) : (
          <div className="tetris-result-content">
            <div className="tetris-ranking-section">
              <h3>최종 순위</h3>
              <div className="tetris-ranking-list">
                {ranking.map((rankedNickname, index) => {
                  const record = records[rankedNickname];
                  return (
                    <div className={`tetris-ranking-row rank-${index + 1}`} key={rankedNickname}>
                      <b>#{index + 1}</b>
                      <strong className="tetris-ranked-name"><TetrisRankEmblem tier={record?.ranked ? record.tier : 'UNRANKED'} compact /><span>{rankedNickname}</span></strong>
                      <span className={index === 0 ? 'typ' : 'str'}>{index === 0 ? 'WIN' : 'LOSS'}</span>
                      <small>{rankLabel(record)} · {record?.wins ?? 0}W {record?.losses ?? 0}L</small>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="tetris-result-record-detail">
              <h3>경기 후 내 전적 <small>{nickname}</small></h3>
              <TetrisRecordDetails record={myRecord} />
            </div>
          </div>
        )}
        <div className="tetris-result-actions">
          <button className="btn-primary" type="button" onClick={onClose}>확인</button>
        </div>
      </section>
    </div>
  );
}

function TetrisPromotionCelebration({ record }: { record: TetrisPlayerRecord }) {
  const placementComplete = record.lastRankBefore === 'UNRANKED';
  return (
    <div className={`tetris-promotion tier-${record.tier.toLowerCase()}`}>
      <div className="tetris-promotion-rays" aria-hidden="true" />
      <div className="tetris-promotion-particles" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--particle': index } as CSSProperties} />)}
      </div>
      <div className="tetris-promotion-emblem">
        <span className="tetris-promotion-ring" />
        <TetrisRankEmblem tier={record.tier} />
      </div>
      <div className="tetris-promotion-copy">
        <small>{placementComplete ? 'PLACEMENT COMPLETE' : 'RANK PROMOTION'}</small>
        <strong>{placementComplete ? '첫 티어 배정' : '승급'}</strong>
        <h2>{rankLabel(record)}</h2>
        <span>{displayStoredRank(record.lastRankBefore)} <b>→</b> {displayStoredRank(record.lastRankAfter)}</span>
        <em>{record.lastRankDelta > 0 ? '+' : ''}{record.lastRankDelta} RP</em>
      </div>
    </div>
  );
}

function BoardShell({
  name, board, score, lines, cycle, status, pending, winner, record, isMe, shakeKey, sendPulseKey, incomingPulseKey, impactKey, badge, onDistract, clearingRows, style,
}: {
  name: string;
  board: Board;
  score: number;
  lines: number;
  cycle: number;
  status: string;
  pending: number;
  winner: boolean;
  record?: TetrisPlayerRecord;
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
        <span className="tetris-head-name"><span className={isMe ? 'var' : 'str'}>{isMe ? 'me' : `"${name}"`}</span></span>
        <span className="tetris-compact-record" title={`${rankLabel(record)} · ${record?.wins ?? 0}W ${record?.losses ?? 0}L`}><TetrisRankEmblem tier={record?.ranked ? record.tier : 'UNRANKED'} compact /><b>{compactRankLabel(record)}</b></span>
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
