import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, StudyStateResponse, ChatMessage } from './types';
import Lobby from './components/Lobby';
import StudyRoom from './components/StudyRoom';
import Chat from './components/Chat';
import { useLobbyChat } from './hooks/useLobbyChat';

/**
 * 최상위 컴포넌트 (App)
 *
 * ─── 상태 관리 전략 ──────────────────────────────────────────────────────────
 * 이 프로젝트는 Redux/Zustand 같은 외부 라이브러리 없이
 * React 기본 useState + props 전달(Prop Drilling)로 상태를 관리합니다.
 *
 * 상태를 App에서 관리하는 이유:
 *   - Lobby(로비)와 StudyRoom(게임방) 모두 nickname, sessionId가 필요하기 때문
 *   - 컴포넌트를 전환할 때 상태를 유지하기 위해 공통 부모에서 관리
 *
 * ─── 화면 전환 ────────────────────────────────────────────────────────────────
 * currentRoom === null  →  Lobby 화면 (방 목록, 방 만들기)
 * currentRoom !== null  →  StudyRoom 화면 (실제 게임)
 */
function App() {
  // 플레이어 닉네임: Lobby에서 입력, StudyRoom 상단에 표시
  const [nickname, setNicknameState] = useState(() => localStorage.getItem('study.nickname') ?? '');

  const [emoji, setEmojiState] = useState(() => localStorage.getItem('study.emoji') ?? "🐱");

  /**
   * 클라이언트 고유 세션 ID
   *
   * sessionStorage: 탭 단위로 유지되는 브라우저 저장소
   *   - 탭을 닫으면 삭제 (localStorage는 영구 보존)
   *   - 같은 탭에서 새로고침해도 유지
   *   - 다른 탭과 공유되지 않아 2개 탭으로 2명 테스트 가능
   *
   * 이 ID로 서버에서 어떤 플레이어인지 구분합니다.
   * (실제 서비스라면 JWT 토큰 등 인증 메커니즘 사용)
   */
  const [sessionId, setSessionId] = useState('');

  // 현재 입장한 방 (null = 로비 상태)
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);

  /**
   * StudyRoom 내부의 handleLeave 함수를 외부(App)에서 호출할 수 있도록 저장하는 ref
   * 탭의 ✕ 버튼 → leaveRef.current() → StudyRoom.handleLeave()
   *   → 서버에 LEAVE 전송 + 로비 전환
   */
  const leaveRef = useRef<(() => void) | null>(null);

  // 서버에서 WebSocket으로 받는 최신 게임 상태
  const [studyState, setStudyState] = useState<StudyStateResponse | null>(null);

  // 로비 채팅
  const [lobbyMessages, setLobbyMessages] = useState<ChatMessage[]>([]);
  const handleLobbyMessage = useCallback((msg: ChatMessage) => {
    setLobbyMessages(prev => [...prev, msg]);
  }, []);
  const { sendChat: sendLobbyChat } = useLobbyChat({ onMessage: handleLobbyMessage });
  const handleLobbyChatSend = useCallback((text: string, _sid: string) => {
    sendLobbyChat(text, nickname, emoji, sessionId);
  }, [sendLobbyChat, nickname, emoji, sessionId]);

  /**
   * 앱 최초 마운트 시 세션 ID 초기화
   *
   * useEffect의 두 번째 인자 [] = 의존성 배열이 비어있어 최초 한 번만 실행됩니다.
   * 의존성 배열을 생략하면 매 렌더링마다 실행 (무한루프 위험).
   */
  useEffect(() => {
    let id = sessionStorage.getItem('sessionId');
    if (!id) {
      // crypto.randomUUID()는 보안 컨텍스트(HTTPS/localhost)에서만 동작
      // IP 주소로 접근 시 HTTP가 되어 사용 불가 → Math.random() 대안 사용
      id = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('sessionId', id);
    }
    setSessionId(id);
  }, []);

  /**
   * 방 입장 핸들러 (Lobby → StudyRoom 전환)
   *
   * useCallback: 이 함수를 자식(Lobby)에 props로 넘기므로
   * 매 렌더링마다 새 함수가 생성되지 않도록 메모이제이션합니다.
   * deps 배열이 []이므로 처음 생성된 함수 참조를 재사용합니다.
   */
  const handleJoinRoom = useCallback((room: Room) => {
    setCurrentRoom(room);
    setStudyState(null); // 이전 게임 상태 초기화
  }, []);

  /** 방 나가기 핸들러 (StudyRoom → Lobby 전환) */
  const handleLeaveRoom = useCallback(() => {
    setCurrentRoom(null);
    setStudyState(null);
  }, []);

  /**
   * WebSocket 게임 상태 수신 핸들러
   *
   * useWebSocket 훅이 서버 메시지를 받을 때마다 이 함수를 호출합니다.
   * 상태 업데이트가 일어나면 StudyRoom과 하위 컴포넌트들이 리렌더링됩니다.
   */
  const handleStudyState = useCallback((s: StudyStateResponse) => {
    setStudyState(s);
  }, []);

  const handleNicknameChange = useCallback((name: string) => {
    setNicknameState(name);
    localStorage.setItem('study.nickname', name);
  }, []);

  const handleEmojiChange = useCallback((nextEmoji: string) => {
    setEmojiState(nextEmoji);
    localStorage.setItem('study.emoji', nextEmoji);
  }, []);

  // 현재 열린 탭 레이블: 로비면 'lobby.ts', 방에 들어가면 '방이름.bs/.bg'
  // (VS Code 파일탭 스타일)
  const tabLabel = currentRoom
    ? `${currentRoom.roomName}.${currentRoom.studyType === 'BASEBALL' ? 'bs' : currentRoom.studyType === 'OMOK' ? 'omok' : currentRoom.studyType === 'TETRIS' ? 'tetris' : currentRoom.studyType === 'INCIDENT_AVOID' ? 'incident' : currentRoom.studyType === 'OLDMAID' ? 'cards' : 'bg'}`
    : 'lobby.ts';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* ── VS Code 타이틀 바 ─────────────────────────────────── */}
      <div style={{
        background: '#323233',
        borderBottom: '1px solid #3e3e42',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '30px',
        flexShrink: 0, // flex 컨테이너 안에서 크기가 줄어들지 않도록
      }}>
        {/* 앱 이름을 syntax highlight 스타일로 표시 */}
        <span style={{ fontSize: '12px', color: '#cccccc' }}>
          <span style={{ color: '#569cd6' }}>study</span>
          <span style={{ color: '#d4d4d4' }}>-</span>
          <span style={{ color: '#ce9178' }}>platform</span>
        </span>
        {/* 닉네임이 설정된 경우 코드 주석 스타일로 표시 */}
        {nickname && (
          <span style={{ fontSize: '11px', color: '#858585' }}>
            <span style={{ color: '#6a9955' }}>// </span>
            <span style={{ color: '#9cdcfe' }}>{nickname}</span>
          </span>
        )}
      </div>

      {/* ── VS Code 탭 바 ─────────────────────────────────────── */}
      <div className="tab-bar" style={{ flexShrink: 0 }}>
        {/* 활성 탭: 현재 열린 파일 (로비 또는 게임방) */}
        <div className="tab active">
          <span style={{ color: '#569cd6', fontSize: '11px' }}>▶</span>
          <span>{tabLabel}</span>
          {/* 게임방에 있을 때만 닫기(×) 버튼 표시 → 클릭 시 방 나가기 */}
          {currentRoom && (
            // leaveRef.current가 있으면 LEAVE 전송 후 로비 이동, 없으면 바로 이동
            <span className="tab-close" onClick={() => leaveRef.current ? leaveRef.current() : handleLeaveRoom()}>✕</span>
          )}
        </div>
        {/* 비활성 탭 힌트: 게임 중이면 lobby.ts가 배경에 있음을 암시 */}
        <div className="tab" style={{ color: '#555', fontSize: '11px', padding: '8px 10px' }}>
          {currentRoom ? 'lobby.ts' : ''}
        </div>
      </div>

      {/* ── 에디터 영역 (메인 콘텐츠) ────────────────────────── */}
      {/* flex: 1 로 남은 공간을 모두 차지, overflow: auto로 스크롤 허용 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {currentRoom === null ? (
          // 로비: 닉네임 설정 + 방 목록 + 방 만들기 + 로비 채팅
          <div style={{ display: 'flex', gap: '16px', height: '100%', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Lobby
                nickname={nickname}
                emoji={emoji}
                onEmojiChange={handleEmojiChange}
                sessionId={sessionId}
                onNicknameChange={handleNicknameChange}
                onJoinRoom={handleJoinRoom}
              />
            </div>
            <div style={{ width: '240px', flexShrink: 0, height: '520px', position: 'sticky', top: 0 }}>
              {!nickname.trim() && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 1,
                  background: 'rgba(30,30,30,0.85)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '4px', fontSize: '12px', color: '#858585',
                  fontFamily: 'monospace', flexDirection: 'column', gap: '6px',
                  pointerEvents: 'none',
                }}>
                  <span style={{ color: '#569cd6' }}>// 채팅하려면</span>
                  <span>닉네임을 먼저 입력해주세요</span>
                </div>
              )}
              <Chat
                messages={lobbyMessages}
                myNickname={nickname}
                myEmoji={emoji}
                sessionId={sessionId}
                onSend={nickname.trim() ? handleLobbyChatSend : () => {}}
              />
            </div>
          </div>
        ) : (
          // 게임방: WebSocket 연결 + 게임 컴포넌트 + 채팅
          <StudyRoom
            room={currentRoom}
            nickname={nickname}
            emoji={emoji}
            sessionId={sessionId}
            studyState={studyState}
            onStudyState={handleStudyState}
            onLeave={handleLeaveRoom}
            leaveRef={leaveRef}
          />
        )}
      </div>

      {/* ── VS Code 상태 바 (하단 파란 바) ──────────────────── */}
      <div className="status-bar" style={{ flexShrink: 0 }}>
        <span>⚡ study-platform</span>
        <span style={{ opacity: 0.7 }}>TypeScript</span>
        {/* 게임방에 있을 때 게임 정보 표시 */}
        {currentRoom && (
          <span style={{ opacity: 0.7 }}>
            {currentRoom.studyType === 'BASEBALL'
              ? `⚾ Baseball · ${currentRoom.digits}-digit`
              : currentRoom.studyType === 'OMOK'
                ? `OMOK · ${currentRoom.boardSize}×${currentRoom.boardSize}`
                : currentRoom.studyType === 'TETRIS'
                  ? 'TETRIS · 20×10'
                  : currentRoom.studyType === 'INCIDENT_AVOID'
                    ? 'INCIDENT_AVOID · 360×520'
                  : currentRoom.studyType === 'OLDMAID'
                    ? '🃏 Old Maid'
                    : `◻ Bingo · ${currentRoom.boardSize}×${currentRoom.boardSize}`}
          </span>
        )}
        {/* 우측 정렬: 현재 인원 / 최대 인원 */}
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
          {currentRoom
            ? `${currentRoom.playerCount}/${currentRoom.studyType === 'TETRIS' || currentRoom.studyType === 'INCIDENT_AVOID' ? 3 : currentRoom.maxPlayers} players`
            : 'Lobby'}
        </span>
      </div>
    </div>
  );
}

export default App;
