
export type StudyType = 'BASEBALL' | 'BINGO' | 'OMOK' | 'TETRIS' | 'OLDMAID' | 'INCIDENT_AVOID' | 'BREAKOUT' | 'CATCHMIND' | 'WORD_CHAIN' | 'RUMMIKUB' | 'DAVINCI_CODE';
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

  gameData: BaseballGameData | BingoGameData | OmokGameData | OldMaidGameData | TetrisGameData | IncidentAvoidGameData | BreakoutGameData | CatchMindGameData | CatchMindSecretData | WordChainGameData | RummikubGameData | DaVinciGameData | null;

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
  playerStates: Record<string, TetrisPlayerState>;
  garbageQueues?: Record<string, TetrisGarbageAttack[]>;
  comboCounts?: Record<string, number>;
}

export interface TetrisGarbageAttack {
  attackId: string;
  from: number;
  lines: number;
  combo: number;
  cleared: number;
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

export interface RummikubGameData {
  hands: number[][];
  table: number[][];
  poolSize: number;
  initialMeld: boolean[];
  numPlayers: number;
  currentTurn: number;
  winner: number;
  hasDrawnThisTurn: boolean;
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
