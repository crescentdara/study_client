
export type StudyType = 'BASEBALL' | 'BINGO' | 'OMOK' | 'TETRIS' | 'OLDMAID' | 'INCIDENT_AVOID' | 'BREAKOUT' | 'CATCHMIND' | 'WORD_CHAIN' | 'RUMMIKUB' | 'DAVINCI_CODE' | 'RUSH_HOUR' | 'UBONGO' | 'ALKKAGI' | 'APPLE_BOX';
export type StudyStatus = 'WAITING' | 'SETUP' | 'PLAYING' | 'FINISHED';

export interface Room {
  roomId: string;
  roomName: string;
  studyType: StudyType;
  status: StudyStatus;
  playerCount: number;
  maxPlayers: number;
  playerNames: string[];
  digits: number;
  boardSize: number;
  /** 테트리스 서바이벌 방이면 "SURVIVAL" */
  mode?: string;
}

export type ChatWarningColor = 'yellow' | 'red';
export type ChatWarnings = Record<string, ChatWarningColor[]>;

export interface CreateRoomRequest {
  roomName: string;
  studyType: StudyType;
  nickname: string;
  sessionId: string;
  maxPlayers: number;
  digits: number;
  boardSize: number;
  /** 테트리스에서 "SURVIVAL"을 보내면 혼자 버티는 판이 만들어진다 */
  mode?: string;
}

export interface JoinRoomRequest {
  nickname: string;
  sessionId: string;
}

export interface StudyMoveRequest {
  moveType:
    | 'START_GAME'
    | 'RESTART'
    | 'LEAVE'
    | 'SET_SECRET'
    | 'GUESS'
    | 'SET_BOARD'
    | 'CALL_TOPIC'
    | 'PLACE_STONE'
    | 'OMOK_RPS'
    | 'TETRIS_SYNC'
    | 'TETRIS_PAUSE'
    | 'TETRIS_DISTRACT'
    | 'INCIDENT_SYNC'
    | 'BREAKOUT_SYNC'
    | 'CATCHMIND_SET_WORD'
    | 'CATCHMIND_DRAW'
    | 'CATCHMIND_CLEAR'
    | 'CATCHMIND_GUESS'
    | 'CATCHMIND_NEXT'
    | 'DEAL_CARD'
    | 'DRAW_CARD'
    | 'DISCARD_PAIR'
    | 'SHUFFLE_HAND'
    | 'END_TURN'
    | 'WORD_CHAIN_SUBMIT'
    | 'WORD_CHAIN_TIMEOUT'
    | 'RUMMY_DRAW'
    | 'RUMMY_PLACE'
    | 'DAVINCI_DRAW'
    | 'DAVINCI_PLACE'
    | 'DAVINCI_GUESS'
    | 'DAVINCI_PASS'
    | 'DAVINCI_FINISHER'
    | 'RUSH_MOVE'
    | 'UBONGO_PLACE'
    | 'UBONGO_REMOVE'
    | 'ALKKAGI_AIM'
    | 'ALKKAGI_RESULT'
    | 'ALKKAGI_TIMEOUT'
    | 'ALKKAGI_SHOT'
    | 'APPLE_CLEAR'
    | 'APPLE_FINISH'
    | 'APPLE_PAUSE'
    | 'CHAT';
  data: string;
  sessionId: string;
  payload?: unknown;
  emoji?: string;
  type?: 'TEXT' | 'IMAGE';
  imageUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyToId?: number;
}

export interface StudyStateResponse {
  roomId: string;
  studyType: StudyType;
  status: StudyStatus;
  message: string;
  currentTurn: number;
  winner: number;

  gameData: BaseballGameData | BingoGameData | OmokGameData | OldMaidGameData | TetrisGameData | IncidentAvoidGameData | BreakoutGameData | CatchMindGameData | CatchMindSecretData | WordChainGameData | RummikubGameData | DaVinciGameData | RushHourGameData | UbongoGameData | AlkkagiGameData | AppleBoxGameData | null;

  playerNames: string[];
}

export interface GuessResult {
  guess: string;
  strikes: number;
  balls: number;
  summary: string;
}

export interface BaseballGameData {
  digits: number;
  numPlayers: number;
  currentTurn: number;
  secretSet: boolean[];
  guessHistories: GuessResult[][];
  winner: number;
  secrets?: string[];
}

export interface BingoBoard {
  size: number;
  topics: string[][];
  marked: boolean[][];
  bingoCount: number;
  boardSet: boolean;
}

export interface BingoGameData {
  size: number;
  numPlayers: number;
  winBingoCount: number;
  boards: BingoBoard[];
  boardsSet: boolean[];
  calledTopics: string[];
  currentTurn: number;
  winner: number;
  bingoCounts: number[];
}

export interface OmokGameData {
  size: number;
  numPlayers: number;
  board: number[][];
  currentTurn: number;
  winner: number;
  moveCount: number;
  lastRow: number;
  lastCol: number;
  winPath: number[][];
  firstDecided: boolean;
  firstPlayerIndex: number;
  openingChoices: Array<'ROCK' | 'PAPER' | 'SCISSORS' | null>;
}

/** 도둑잡기 카드: [rank, suit]  rank=0 → 조커  suit=-1 → 조커 */
export type OldMaidCard = [number, number];

export interface OldMaidGameData {
  numPlayers: number;
  /** true: 배분 단계 (덱에서 뽑는 중) / false: 플레이 단계 */
  dealing: boolean;
  /** 중앙 덱 남은 카드 수 */
  deckSize: number;
  /** 각 플레이어 손패 (카드 배열) */
  hands: OldMaidCard[][];
  /** 손패 카드 수 */
  handSizes: number[];
  /** safe[i]=true → 카드 다 냈음 (안전) */
  safe: boolean[];
  currentTurn: number;
  /** -1: 게임 중 / >=0: 패자 인덱스 */
  loser: number;
  /** 다음에 뽑힐 플레이어 인덱스 */
  nextActivePlayer: number;
  /** 마지막으로 셔플한 플레이어 인덱스 (-1: 없음) */
  lastShuffle: number;
}

export interface TetrisGameData {
  mode: string;
  rows: number;
  cols: number;
  numPlayers: number;
  rankedMatch?: boolean;
  instanceId?: string;
  playerStates: Record<string, TetrisPlayerState>;
  garbageQueues?: Record<string, TetrisGarbageAttack[]>;
  comboCounts?: Record<string, number>;
  lastAttackers?: Record<string, number>;
  attackLog?: TetrisAttackLogEntry[];
  distractEvents?: TetrisDistractEvent[];
  paused?: boolean;
  aborted?: boolean;
  abortReason?: string;
  previousAbortReason?: string;
  finalRanking?: number[];
  records?: Record<string, TetrisPlayerRecord>;
  /* ── 서바이벌 (mode === 'survival') ─────────────────────────────────────
   * 여러 명이 같은 조건에서 겨루도록 시계와 구멍 순서를 서버가 정해 내려준다. */
  survivalElapsedMs?: number;
  /** n번째로 올라오는 쓰레기 줄이 쓸 구멍 열 */
  garbageHoles?: number[];
  survivalResults?: Record<string, TetrisSurvivalResult>;
}

/** 서바이벌 한 사람의 결과 — 탈락 시점에 서버가 찍는다 */
export interface TetrisSurvivalResult {
  survivedMs: number;
  survivedSeconds: number;
  score: number;
  lines: number;
  /** 합산 점수 = 생존 초 × 100 + 지운 줄 × 20 + 게임 점수 ÷ 10 */
  total: number;
}

export interface TetrisOpponentRecord {
  wins: number;
  losses: number;
}

export interface TetrisPlayerRecord {
  matches: number;
  wins: number;
  losses: number;
  placementGames: number;
  placementRequired: number;
  ranked: boolean;
  tier: 'UNRANKED' | 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'EMERALD' | 'DIAMOND' | 'MASTER' | 'GRANDMASTER' | 'CHALLENGER';
  division: '' | 'IV' | 'III' | 'II' | 'I';
  rp: number;
  rating: number;
  lastRankDelta: number;
  lastRankChanged: boolean;
  lastRankBefore: string;
  lastRankAfter: string;
  lastRankMatchId: string;
  opponents: Record<string, TetrisOpponentRecord>;
}

/** 테트리스 티어 순위 한 줄 — 로비 목록용 (상대전적은 빠져 있다) */
export interface TetrisRankRow {
  nickname: string;
  rank: number;
  rating: number;
  winRate: number;
  matches: number;
  wins: number;
  losses: number;
  placementGames: number;
  placementRequired: number;
  ranked: boolean;
  tier: TetrisPlayerRecord['tier'];
  division: TetrisPlayerRecord['division'];
  rp: number;
}

export interface TetrisDistractEvent {
  eventId: string;
  type: 'shake';
  from: number;
  target: number;
  timestamp: number;
}

export interface TetrisGarbageAttack {
  attackId: string;
  from: number;
  lines: number;
  combo: number;
  cleared: number;
}

export interface TetrisAttackLogEntry extends TetrisGarbageAttack {
  to: number;
  timestamp: number;
  tspin?: boolean;
  b2b?: boolean;
  perfectClear?: boolean;
}

export interface TetrisPlayerState {
  board: string[][];
  score: number;
  lines: number;
  cycle: number;
  running: boolean;
  gameOver: boolean;
  updatedAt: number;
}

export interface IncidentAvoidGameData {
  mode: string;
  width: number;
  height: number;
  numPlayers: number;
  playerStates: Record<string, IncidentAvoidPlayerState>;
}

export interface IncidentAvoidPlayerState {
  x: number;
  score: number;
  survivedMs: number;
  running: boolean;
  gameOver: boolean;
  incidents: number[][];
  updatedAt: number;
}

export interface BreakoutGameData {
  mode: string;
  width: number;
  height: number;
  numPlayers: number;
  playerStates: Record<string, BreakoutPlayerState>;
}

export interface BreakoutPlayerState {
  paddleX: number;
  ballX: number;
  ballY: number;
  score: number;
  bricksLeft: number;
  running: boolean;
  gameOver: boolean;
  cleared: boolean;
  bricks: number[];
  updatedAt: number;
}

export interface CatchMindStroke {
  color: string;
  width: number;
  points: Array<[number, number]>;
}

export interface CatchMindGameData {
  numPlayers: number;
  round: number;
  maxRounds: number;
  currentTurn: number;
  maskedWord: string;
  wordLength: number;
  scores: number[];
  strokes: CatchMindStroke[];
  recentGuesses: string[];
  roundSolved: boolean;
  solvedBy: number;
  revealedWord: string;
  wordReady: boolean;
}

export interface CatchMindSecretData {
  secretWord: string;
  round: number;
  currentTurn: number;
}


export interface JjaptalSlugGameData {
  
}


export interface ChatMessage {
  nickname: string;
  text: string;
  timestamp: number;
  emoji: string;
  type?: 'TEXT' | 'IMAGE';
  imageUrl?: string;
  fileName?: string;
  fileSize?: number;
  mentionedNickname?: string;
  voiceRequested?: boolean;
  voiceText?: string;
  id?: number;
  replyToId?: number;
  replyToNickname?: string;
  replyToText?: string;
}

export interface ChatAttachment {
  type: 'IMAGE';
  imageUrl: string;
  fileName: string;
  fileSize: number;
}

export interface DaVinciGameData {
  gameId: string;
  messageEventId: number;
  eliminationEventId: number;
  executionEventId: number;
  lastEliminatedPlayer: number;
  lastEliminatorPlayer: number;
  finisherPending: boolean;
  executionStyle: 'TERMINATE' | 'TRASH' | 'SHRED' | 'ACCESS_DENIED' | '';
  executionTaunt: string;
  numPlayers: number;
  currentTurn: number;
  winner: number;
  poolSize: number;
  playerTiles: number[][];
  revealed: boolean[][];
  pendingTileId: number;     // drawn but not yet placed (-1 if none)
  drawnTileId: number;       // placed this turn (-1 if none)
  drawnRevealed: boolean;
  correctGuessesThisTurn: number;
}

export interface RushHourVehicle {
  id: number;
  row: number;
  col: number;
  length: number;
  horizontal: boolean;
  color: string;
}

export interface RushHourPlayerState {
  vehicles: RushHourVehicle[];
  moves: number;
  solved: boolean;
  solveTimeMs: number;
}

export interface RushHourGameData {
  numPlayers: number;
  puzzleIndex: number;
  winner: number;
  startTime: number;
  playerStates: RushHourPlayerState[];
}

export interface RummikubGameData {
  hands: number[][];
  handCounts?: number[];
  table: number[][];
  poolSize: number;
  initialMeld: boolean[];
  numPlayers: number;
  currentTurn: number;
  winner: number;
  hasDrawnThisTurn: boolean;
}

export interface AlkkagiStone {
  id: number;
  owner: number;
  x: number;
  y: number;
  active: boolean;
  type?: 'NORMAL' | 'HEAVY' | 'SLIPPERY' | 'BOMB' | 'LIGHT'
    | 'BLACK_HOLE' | 'WARP' | 'SPLIT' | 'GHOST'
    | 'LIGHTNING' | 'CURSE' | 'ROULETTE' | 'MINE'
    | 'BOUNCY' | 'SPRING';
}

export interface AlkkagiGameData {
  numPlayers: number;
  currentTurn: number;
  winner: number;
  shotCount: number;
  turnStartedAt?: number;
  turnTimeLimitMs?: number;
  shotLog?: string[];
  mapType?: 'CLASSIC' | 'CENTER_HOLE' | 'CORNER_HOLES' | 'SIDE_POCKETS' | 'PILLARS' | 'BUMPER_FIELD' | 'PINBALL' | 'NARROW_BRIDGE' | 'RIVER' | 'ICE_SAND' | 'ELASTIC_WALLS' | 'MAGNET_FIELD' | 'DONUT_RING' | 'OFFICE_DESK' | 'HEX_ARENA' | 'HEX_TYPHOON' | 'HEX_RUINS' | 'ROULETTE_ARENA' | 'TYPHOON_ISLAND' | 'PORTAL_MAZE' | 'COLLAPSE_ICE';
  mapSeed?: number;
  mapPhase?: number;
  stones: AlkkagiStone[];
  activeShot?: {
    id: number;
    playerIndex: number;
    stoneId: number;
    vx: number;
    vy: number;
  } | null;
  activeShotStartedAt?: number;
  shotResultTimeoutMs?: number;
}

export interface WordChainGameData {
  lastWord: string;
  usedWords: string[];
  eliminated: boolean[];
  timeLimit: number;
  numPlayers: number;
  currentTurn: number;
  winner: number;
}

// ── Ubongo ──────────────────────────────────────────────────────────────────

export interface UbongoPieceInfo {
  id: string;
  color: string;
  size: number;
  /** Each orientation: array of [row, col] cell offsets from (0,0). */
  orientations: number[][][];
}

export interface UbongoPuzzle {
  blocked: boolean[][];   // 5x5
  pieces: UbongoPieceInfo[];
}

export interface UbongoPlacement {
  row: number;
  col: number;
  orientationIndex: number;
}

export interface UbongoPlayerState {
  placements: Record<string, UbongoPlacement>; // pieceId → placement
  solved: boolean;
  solveTimeMs: number;
}

export interface UbongoGameData {
  puzzle: UbongoPuzzle;
  playerStates: UbongoPlayerState[];
  winner: number;
  startTime: number;
}

/** 사과게임 — 참가자별 진행 상황 (없앤 칸 인덱스와 점수) */
export interface AppleBoxPlayerState {
  score: number;
  finished: boolean;
  cleared: number[];
}

/** 사과게임 랭킹 한 줄 — 서버 AppleBoxRecordService가 만든 공개 기록 */
export interface AppleBoxRecord {
  nickname: string;
  rank: number;
  best: number;
  games: number;
  lastScore: number;
  average: number;
  lastPlayedAt: number;
}

export interface AppleBoxGameData {
  rows: number;
  cols: number;
  target: number;
  /** 모든 참가자가 공유하는 초기 보드 (길이 rows*cols, 값 1~9) */
  board: number[];
  numPlayers: number;
  instanceId: string;
  durationSeconds: number;
  remainingSeconds: number;
  playerStates: Record<string, AppleBoxPlayerState>;
  finalRanking?: number[];
  records?: Record<string, AppleBoxRecord>;
  /** 계속 쌓이는 누적 최고 점수 순위 */
  leaderboard?: AppleBoxRecord[];
  /** 월요일마다 초기화되는 이번 주 최고 점수 순위 (누적과 따로 관리) */
  weeklyLeaderboard?: AppleBoxRecord[];
  /** 이번 주가 시작된 날(월요일) — "2026-08-03" */
  weekStart?: string;
  /** P키 퍼즈 — true면 서버 시계도 실제로 멈춰 있다 */
  paused?: boolean;
}
