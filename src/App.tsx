import { useState, useEffect, useCallback } from 'react';
import { Room, StudyStateResponse } from './types';
import Lobby from './components/Lobby';
import StudyRoom from './components/StudyRoom';

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
  const [nickname, setNickname] = useState('');

  const [emoji, setEmoji] = useState("🐱");

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

  // 서버에서 WebSocket으로 받는 최신 게임 상태
  const [studyState, setStudyState] = useState<StudyStateResponse | null>(null);

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

  // 현재 열린 탭 레이블: 로비면 'lobby.ts', 방에 들어가면 '방이름.bs/.bg'
  // (VS Code 파일탭 스타일)
  const tabLabel = currentRoom
    ? `${currentRoom.roomName}.${currentRoom.studyType === 'BASEBALL' ? 'bs' : 'bg'}`
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
            <span className="tab-close" onClick={handleLeaveRoom}>✕</span>
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
          // 로비: 닉네임 설정 + 방 목록 + 방 만들기
          <Lobby
            nickname={nickname}
            emoji={emoji}
            onEmojiChange={(e) => setEmoji(e)}
            sessionId={sessionId}
            onNicknameChange={(name) => setNickname(name)}  
            onJoinRoom={handleJoinRoom}                
          />
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
              : `◻ Bingo · ${currentRoom.boardSize}×${currentRoom.boardSize}`}
          </span>
        )}
        {/* 우측 정렬: 현재 인원 / 최대 인원 */}
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
          {currentRoom
            ? `${currentRoom.playerCount}/${currentRoom.maxPlayers} players`
            : 'Lobby'}
        </span>
      </div>
    </div>
  );
}

export default App;
