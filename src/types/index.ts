export type StudyType   = 'BASEBALL' | 'BINGO';
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
    | 'START_GAME'   // 방장: 게임 시작
    | 'RESTART'      // 방장: 재시작 (FINISHED → SETUP)
    | 'SET_SECRET'   // 야구: 비밀 숫자 설정
    | 'GUESS'        // 야구: 추측
    | 'SET_BOARD'    // 빙고: 보드 주제 설정
    | 'CALL_TOPIC'   // 빙고: 주제 호출
    | 'CHAT';        // 채팅
  data: string;
  sessionId: string;
  payload?: unknown; // SET_BOARD 시 string[][] 전달
}

export interface StudyStateResponse {
  roomId: string;
  studyType: StudyType;
  status: StudyStatus;
  message: string;
  currentTurn: number;
  winner: number;
  gameData: BaseballGameData | BingoGameData | null;
  playerNames: string[];
}

// ── Baseball ──────────────────────────────────────
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

// ── Bingo ─────────────────────────────────────────
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

// ── Chat ──────────────────────────────────────────
export interface ChatMessage {
  nickname: string;
  text: string;
  timestamp: number;
}
