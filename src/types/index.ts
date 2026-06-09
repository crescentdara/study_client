
export type StudyType = 'BASEBALL' | 'BINGO' | 'OMOK' | 'TETRIS' | 'OLDMAID';
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
    | 'TETRIS_SYNC'
    | 'DEAL_CARD'
    | 'DRAW_CARD'
    | 'DISCARD_PAIR'
    | 'SHUFFLE_HAND'
    | 'END_TURN'
    | 'CHAT';
  data: string;
  sessionId: string;
  payload?: unknown;
  emoji?: string;
}

export interface StudyStateResponse {
  roomId: string;
  studyType: StudyType;
  status: StudyStatus;
  message: string;
  currentTurn: number;
  winner: number;

  gameData: BaseballGameData | BingoGameData | OmokGameData | OldMaidGameData | TetrisGameData | null;

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


export interface JjaptalSlugGameData {
  
}


export interface ChatMessage {
  nickname: string;
  text: string;
  timestamp: number;
  emoji: string;
}
