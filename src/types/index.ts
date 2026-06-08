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
    | 'START_GAME'
    | 'RESTART'
    | 'LEAVE'        // 방 나가기 (서버에 알림)
    | 'SET_SECRET'
    | 'GUESS'
    | 'SET_BOARD'
    | 'CALL_TOPIC'
    | 'CHAT';
  data: string;
  sessionId: string;
  payload?: unknown;
  emoji?: string;    // 채팅 시 발신자 이모지
}

export interface StudyStateResponse {
  roomId: string;
  studyType: StudyType;
  status: StudyStatus;
  message: string;   // 'ROOM_CLOSED:' 로 시작하면 방 폐쇄 신호
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
  emoji: string;     // 발신자가 선택한 이모지 (서버에서 포함해서 브로드캐스트)
}
