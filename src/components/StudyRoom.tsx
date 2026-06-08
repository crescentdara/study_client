import { useState, useCallback } from 'react';
import { Room, StudyStateResponse, ChatMessage } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import Baseball from './games/Baseball';
import Bingo from './games/Bingo';
import Chat from './Chat';

/**
 * StudyRoom Props 타입 정의
 *
 * TypeScript interface: 객체의 구조(속성과 타입)를 명시합니다.
 * Props 타입을 별도로 정의하면:
 *   - 잘못된 타입의 값을 넘기면 컴파일 에러로 즉시 발견
 *   - IDE 자동완성으로 어떤 props가 있는지 바로 확인 가능
 */
interface StudyRoomProps {
  room: Room;                                         // 현재 방 정보 (타입, 설정 등)
  nickname: string;                                   // 나의 닉네임
  sessionId: string;                                  // 나의 세션 ID (서버 식별용)
  studyState: StudyStateResponse | null;              // 서버에서 받은 최신 게임 상태
  onStudyState: (state: StudyStateResponse) => void;  // 게임 상태 업데이트 콜백 (App에 전달)
  onLeave: () => void;                                // 방 나가기 콜백
}

/**
 * 게임방 컨테이너 컴포넌트
 *
 * 역할:
 *   1. WebSocket 연결 관리 (useWebSocket 훅)
 *   2. 채팅 메시지 상태 관리
 *   3. 게임 종류(야구/빙고)에 따라 적절한 게임 컴포넌트 렌더링
 *   4. 채팅 패널 렌더링
 *
 * ─── 레이아웃 구조 ──────────────────────────────────────────────────────────
 *  ┌─────────────────────────────────────┬───────────┐
 *  │ 게임 영역 (flex: 1, 가변 너비)        │ 채팅 패널 │
 *  │  - 상단 정보바                        │ (220px)  │
 *  │  - 상태 메시지                        │          │
 *  │  - Baseball 또는 Bingo 컴포넌트      │          │
 *  └─────────────────────────────────────┴───────────┘
 */
export default function StudyRoom({
  room, nickname, sessionId, studyState, onStudyState, onLeave
}: StudyRoomProps) {

  /**
   * 채팅 메시지 목록 (로컬 상태)
   *
   * 채팅은 게임 상태(studyState)와 별도로 관리합니다.
   * 이유:
   *   - 채팅은 게임과 무관하게 계속 쌓이는 이벤트 로그
   *   - 서버가 게임 상태를 덮어쓸 때 채팅 기록이 사라지면 안 됨
   *   - 채널도 /topic/chat/{roomId}로 분리되어 있음
   */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  /**
   * 채팅 메시지 수신 핸들러
   *
   * useWebSocket 훅이 /topic/chat/{roomId}에서 메시지를 받을 때마다 호출됩니다.
   * prev => [...prev, msg] : 이전 배열을 복사하고 새 메시지를 뒤에 추가합니다.
   * (배열을 직접 수정하면 React가 변경을 감지 못함 → 반드시 새 배열 생성)
   *
   * useCallback의 빈 deps []:
   *   이 함수는 처음 생성된 참조를 계속 사용합니다.
   *   setChatMessages는 React가 제공하는 안정된(stable) 함수라 deps에 불필요합니다.
   */
  const handleChat = useCallback((msg: ChatMessage) => {
    setChatMessages(prev => [...prev, msg]);
  }, []);

  /**
   * useWebSocket 훅으로 WebSocket 연결 및 기능 획득
   *
   * connected  : 현재 STOMP 연결 여부 (UI 상태 표시용)
   * sendMove   : 게임 액션을 서버로 전송 (/app/study/{roomId}/move)
   * sendChat   : 채팅 메시지를 서버로 전송 (/app/study/{roomId}/chat)
   */
  const { connected, sendMove, sendChat } = useWebSocket({
    roomId: room.roomId,
    onStudyState,     // 서버 게임 상태 → App의 studyState 업데이트
    onChat: handleChat, // 서버 채팅 메시지 → 로컬 chatMessages 업데이트
  });

  /**
   * 나의 플레이어 인덱스 계산
   *
   * room.playerNames 배열에서 내 닉네임의 위치를 찾습니다.
   * 예) playerNames = ["Alice", "Bob", "Carol"], nickname = "Bob" → myPlayerIndex = 1
   * 이 인덱스로 게임 데이터 배열(guessHistories[1], boards[1] 등)에 접근합니다.
   * 닉네임이 없으면 -1 반환 (대기 중 상태)
   */
  const myPlayerIndex = room.playerNames.indexOf(nickname);
  const isBaseball    = room.studyType === 'BASEBALL';

  return (
    // 가로 flex: 게임 영역(flex:1) + 채팅 패널(220px)
    <div style={{ display: 'flex', gap: '12px', height: '100%' }}>

      {/* ── 게임 영역 ────────────────────────────────────────── */}
      {/* minWidth: 0 → flex 자식이 내용보다 작아질 수 있게 허용 (텍스트 오버플로우 방지) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>

        {/* 방 정보 + 연결 상태 + 나가기 버튼 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 10px', background: '#252526', border: '1px solid #3e3e42', fontSize: '12px',
        }}>
          <span>
            <span className="cmt">{'// '}</span>
            <span className="kw">room </span>
            <span className="str">"{room.roomName}"</span>
            <span className="dim"> · </span>
            <span className="typ">{room.studyType}</span>
            <span className="dim"> · </span>
            <span className="num">
              {isBaseball ? `${room.digits}-digit` : `${room.boardSize}×${room.boardSize}`}
            </span>
            <span className="dim"> · </span>
            {/* connected가 true면 초록, false면 빨간 점으로 연결 상태 표시 */}
            <span style={{ color: connected ? '#6a9955' : '#f14c4c' }}>
              {connected ? '● connected' : '○ connecting...'}
            </span>
          </span>
          <button className="btn-danger" style={{ fontSize: '11px' }} onClick={onLeave}>
            .leave()
          </button>
        </div>

        {/* 서버 메시지 표시 (일반 메시지 or 에러 메시지) */}
        {studyState?.message && (
          <div className={`msg-bar ${studyState.message.startsWith('ERROR') ? 'error' : ''}`}>
            <span className="cmt">{'> '}</span>
            {/* 에러 접두사 제거 후 표시 */}
            {studyState.message.replace('ERROR: ', '')}
          </div>
        )}

        {/* 게임 타입에 따라 다른 컴포넌트 렌더링 */}
        {isBaseball ? (
          // 숫자야구 게임 컴포넌트
          <Baseball
            studyState={studyState}
            sessionId={sessionId}
            myPlayerIndex={myPlayerIndex}
            sendMove={sendMove}
            digits={room.digits}      // 방 생성 시 설정한 자릿수
          />
        ) : (
          // 빙고 게임 컴포넌트
          <Bingo
            studyState={studyState}
            sessionId={sessionId}
            myPlayerIndex={myPlayerIndex}
            sendMove={sendMove}
            boardSize={room.boardSize} // 방 생성 시 설정한 보드 크기
          />
        )}
      </div>

      {/* ── 채팅 패널 (우측 220px 고정) ──────────────────────── */}
      {/* flexShrink: 0 → 공간이 부족해도 채팅 패널 너비 유지 */}
      <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <Chat
          messages={chatMessages}   // 수신된 채팅 메시지 목록
          myNickname={nickname}     // 내 닉네임 (내 메시지 강조 표시용)
          sessionId={sessionId}     // 전송 시 서버가 발신자 식별하는데 사용
          onSend={sendChat}         // 전송 버튼/엔터 시 WebSocket으로 전송
        />
      </div>
    </div>
  );
}
