export type StudyType = 'BASEBALL' | 'BINGO' | 'OMOK' | 'TETRIS';
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
  gameData: BaseballGameData | BingoGameData | OmokGameData | TetrisGameData | null;
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

export interface ChatMessage {
  nickname: string;
  text: string;
  timestamp: number;
  emoji: string;
}
