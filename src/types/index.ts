/**
 * 프론트엔드 전역 타입 정의 파일
 *
 * ─── TypeScript 타입의 역할 ────────────────────────────────────────────────
 * 이 파일의 타입들은 백엔드 Java DTO와 1:1 대응됩니다.
 * 서버-클라이언트 간 주고받는 JSON 구조를 명시해서:
 *   - 잘못된 필드 접근을 컴파일 타임에 방지
 *   - IDE 자동완성으로 개발 속도 향상
 *   - 코드 자체가 API 문서 역할
 *
 * ─── type vs interface ─────────────────────────────────────────────────────
 * type: 주로 Union Type, 별칭에 사용 ('A' | 'B' 등)
 * interface: 객체 구조 정의에 사용 (확장 가능)
 */

// ── 열거형 타입 (Union Type으로 표현) ─────────────────────────────────────

/** 게임 종류 — 백엔드 StudyType enum과 대응 */
export type StudyType   = 'BASEBALL' | 'BINGO';

/**
 * 방/게임 상태 — 백엔드 StudyStatus enum과 대응
 * 상태 전환: WAITING → SETUP → PLAYING → FINISHED
 */
export type StudyStatus = 'WAITING' | 'SETUP' | 'PLAYING' | 'FINISHED';

// ── 방 관련 타입 ────────────────────────────────────────────────────────────

/**
 * REST API GET /api/rooms 및 POST /api/rooms 응답 타입
 * 백엔드 RoomResponse DTO와 대응
 */
export interface Room {
  roomId: string;           // 8자리 고유 방 ID
  roomName: string;         // 방 이름
  studyType: StudyType;     // 게임 종류
  status: StudyStatus;      // 현재 방 상태
  playerCount: number;      // 현재 입장 인원
  maxPlayers: number;       // 최대 입장 인원 (2~6)
  playerNames: string[];    // 입장한 플레이어 닉네임 배열 (인덱스 = playerIndex)
  digits: number;           // 숫자야구 자릿수 (3·4·5)
  boardSize: number;        // 빙고 보드 크기 (3·4·5)
}

/**
 * 방 생성 요청 타입 — POST /api/rooms body
 * 백엔드 CreateRoomRequest DTO와 대응
 */
export interface CreateRoomRequest {
  roomName: string;
  studyType: StudyType;
  nickname: string;
  sessionId: string;
  maxPlayers: number;
  digits: number;
  boardSize: number;
}

/** 방 입장 요청 타입 — POST /api/rooms/{roomId}/join body */
export interface JoinRoomRequest {
  nickname: string;
  sessionId: string;
}

// ── WebSocket 메시지 타입 ────────────────────────────────────────────────────

/**
 * 게임 액션 요청 — STOMP publish to /app/study/{roomId}/move
 * 백엔드 StudyMoveRequest DTO와 대응
 *
 * moveType별 사용 방법:
 *   SET_SECRET : 야구 비밀 숫자 설정 (data = "123")
 *   GUESS      : 야구 추측 (data = "456")
 *   SET_BOARD  : 빙고 보드 주제 설정 (payload = string[][])
 *   CALL_TOPIC : 빙고 주제 호출 (data = "주제명")
 *   CHAT       : 채팅 (data = "메시지", /chat 채널로 전송)
 */
export interface StudyMoveRequest {
  moveType: 'SET_SECRET' | 'GUESS' | 'SET_BOARD' | 'CALL_TOPIC' | 'CHAT';
  data: string;        // 단순 문자열 데이터
  sessionId: string;   // 플레이어 식별자
  payload?: unknown;   // 복잡한 데이터 (SET_BOARD 시 string[][] 전달)
}

/**
 * 게임 상태 응답 — STOMP subscribe from /topic/study/{roomId}
 * 백엔드 StudyStateResponse DTO와 대응
 *
 * 서버가 게임 상태가 변경될 때마다 이 타입의 메시지를 브로드캐스트합니다.
 */
export interface StudyStateResponse {
  roomId: string;
  studyType: StudyType;
  status: StudyStatus;
  message: string;          // 현황 메시지. "ERROR:"로 시작하면 에러
  currentTurn: number;      // 현재 턴 플레이어 인덱스 (playerNames의 인덱스)
  winner: number;           // 승자 인덱스. -1이면 아직 없음
  gameData: BaseballGameData | BingoGameData | null; // 게임별 세부 데이터
  playerNames: string[];    // 플레이어 닉네임 배열 (인덱스 = playerIndex)
}

// ── 숫자야구 타입 ─────────────────────────────────────────────────────────────

/** 한 번의 추측 결과 */
export interface GuessResult {
  guess: string;    // 추측한 숫자 문자열 (예: "123")
  strikes: number;  // 자리·숫자 모두 일치한 개수
  balls: number;    // 숫자는 있지만 자리가 다른 개수
  summary: string;  // "1S2B" 형식 요약 문자열
}

/**
 * 숫자야구 게임 데이터 (StudyStateResponse.gameData 필드)
 * 백엔드 BaseballService.buildResponse에서 Map으로 생성
 */
export interface BaseballGameData {
  digits: number;                  // 자릿수 (3·4·5)
  numPlayers: number;              // 총 플레이어 수
  currentTurn: number;             // 현재 턴 플레이어 인덱스
  secretSet: boolean[];            // [i] = 플레이어 i가 비밀 숫자 설정 완료 여부
  guessHistories: GuessResult[][]; // [i] = 플레이어 i의 추측 기록 목록
  winner: number;                  // 승자 인덱스 (-1이면 없음)
  secrets?: string[];              // 게임 종료 후에만 포함되는 비밀 숫자들
}

// ── 빙고 타입 ───────────────────────────────────────────────────────────────

/**
 * 단일 플레이어의 빙고 보드
 * 백엔드 BingoBoard 객체와 대응
 */
export interface BingoBoard {
  size: number;           // 보드 크기 (3·4·5)
  topics: string[][];     // [행][열] = 셀에 입력된 주제 텍스트
  marked: boolean[][];    // [행][열] = 해당 셀 마킹 여부
  bingoCount: number;     // 현재 완성된 빙고 줄 수
  boardSet: boolean;      // 이 플레이어가 보드 설정을 완료했는지
}

/**
 * 빙고 게임 데이터 (StudyStateResponse.gameData 필드)
 * 백엔드 BingoService.buildResponse에서 Map으로 생성
 */
export interface BingoGameData {
  size: number;             // 보드 크기 (3·4·5)
  numPlayers: number;       // 총 플레이어 수
  winBingoCount: number;    // 승리에 필요한 빙고 줄 수 (3×3=2, 4×4·5×5=3)
  boards: BingoBoard[];     // [i] = 플레이어 i의 보드 (topics + marked)
  boardsSet: boolean[];     // [i] = 플레이어 i가 보드 설정 완료 여부
  calledTopics: string[];   // 지금까지 호출된 주제 목록 (중복 방지용)
  currentTurn: number;      // 현재 턴 플레이어 인덱스
  winner: number;           // 승자 인덱스 (-1이면 없음)
  bingoCounts: number[];    // [i] = 플레이어 i의 현재 빙고 줄 수
}

// ── 채팅 타입 ────────────────────────────────────────────────────────────────

/**
 * 채팅 메시지 — STOMP subscribe from /topic/chat/{roomId}
 * 백엔드 ChatMessage DTO와 대응
 */
export interface ChatMessage {
  nickname: string;   // 보낸 사람 닉네임
  text: string;       // 메시지 내용
  timestamp: number;  // 서버 수신 시각 (밀리초 Unix timestamp)
}
