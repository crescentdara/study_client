
export type StudyType = 'BASEBALL' | 'BINGO' | 'OMOK' | 'TETRIS' | 'OLDMAID' | 'INCIDENT_AVOID' | 'BREAKOUT' | 'CATCHMIND' | 'WORD_CHAIN' | 'RUMMIKUB' | 'DAVINCI_CODE' | 'RUSH_HOUR' | 'UBONGO' | 'ALKKAGI';
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
}

export interface CreateRoomRequest {
  roomName: string;
  studyType: StudyType;
  nickname: string;
  sessionId: string;
  maxPlayers: number;
  digits: number;
  boardSize: number;
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
    | 'RUSH_MOVE'
    | 'UBONGO_PLACE'
    | 'UBONGO_REMOVE'
    | 'ALKKAGI_AIM'
    | 'ALKKAGI_RESULT'
    | 'ALKKAGI_TIMEOUT'
    | 'ALKKAGI_SHOT'
    | 'CHAT';
  data: string;
  sessionId: string;
  payload?: unknown;
  emoji?: string;
  type?: 'TEXT' | 'IMAGE';
  imageUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface StudyStateResponse {
  roomId: string;
  studyType: StudyType;
  status: StudyStatus;
  message: string;
  currentTurn: number;
  winner: number;

  gameData: BaseballGameData | BingoGameData | OmokGameData | OldMaidGameData | TetrisGameData | IncidentAvoidGameData | BreakoutGameData | CatchMindGameData | CatchMindSecretData | WordChainGameData | RummikubGameData | DaVinciGameData | RushHourGameData | UbongoGameData | AlkkagiGameData | null;

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
  instanceId?: string;
  playerStates: Record<string, TetrisPlayerState>;
  garbageQueues?: Record<string, TetrisGarbageAttack[]>;
  comboCounts?: Record<string, number>;
  lastAttackers?: Record<string, number>;
  attackLog?: TetrisAttackLogEntry[];
  distractEvents?: TetrisDistractEvent[];
  paused?: boolean;
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
}

export interface ChatAttachment {
  type: 'IMAGE';
  imageUrl: string;
  fileName: string;
  fileSize: number;
}

export interface DaVinciGameData {
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
}

export interface AlkkagiGameData {
  numPlayers: number;
  currentTurn: number;
  winner: number;
  shotCount: number;
  turnStartedAt?: number;
  turnTimeLimitMs?: number;
  shotLog?: string[];
  mapType?: 'CLASSIC' | 'CENTER_HOLE' | 'CORNER_HOLES' | 'SIDE_POCKETS' | 'PILLARS' | 'BUMPER_FIELD' | 'PINBALL' | 'NARROW_BRIDGE' | 'RIVER';
  stones: AlkkagiStone[];
  activeShot?: {
    id: number;
    playerIndex: number;
    stoneId: number;
    vx: number;
    vy: number;
  } | null;
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
