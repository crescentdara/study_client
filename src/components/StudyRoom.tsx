import { useState, useCallback } from 'react';
import { Room, StudyStateResponse, ChatMessage } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import Baseball from './games/Baseball';
import Bingo from './games/Bingo';
import Chat from './Chat';

interface StudyRoomProps {
  room: Room;
  nickname: string;
  sessionId: string;
  studyState: StudyStateResponse | null;
  onStudyState: (state: StudyStateResponse) => void;
  onLeave: () => void;
}

export default function StudyRoom({
  room, nickname, sessionId, studyState, onStudyState, onLeave,
}: StudyRoomProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const handleChat = useCallback((msg: ChatMessage) => {
    setChatMessages(prev => [...prev, msg]);
  }, []);

  const { connected, sendMove, sendChat } = useWebSocket({
    roomId: room.roomId,
    onStudyState,
    onChat: handleChat,
  });

  const myPlayerIndex = room.playerNames.indexOf(nickname);
  const isHost        = myPlayerIndex === 0; // 방장 여부 (playerIndex === 0)
  const isBaseball    = room.studyType === 'BASEBALL';

  // 현재 상태 (studyState가 없으면 room.status 기반으로 판단)
  const status = studyState?.status ?? room.status;
  // 입장한 플레이어 목록 (studyState에 최신 정보가 있음)
  const playerNames = studyState?.playerNames ?? room.playerNames;

  /** 게임 시작 요청 (방장 전용) */
  const handleStart = () => {
    sendMove({ moveType: 'START_GAME', data: '', sessionId });
  };

  /** 재시작 요청 (방장 전용, FINISHED 상태에서만) */
  const handleRestart = () => {
    sendMove({ moveType: 'RESTART', data: '', sessionId });
  };

  return (
    <div style={{ display: 'flex', gap: '12px', height: '100%' }}>

      {/* ── 게임 영역 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>

        {/* 상단 정보바 */}
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
            <span style={{ color: connected ? '#6a9955' : '#f14c4c' }}>
              {connected ? '● connected' : '○ connecting...'}
            </span>
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* 재시작 버튼: 방장 + FINISHED 상태일 때만 표시 */}
            {isHost && status === 'FINISHED' && (
              <button
                className="btn-primary"
                style={{ fontSize: '11px' }}
                onClick={handleRestart}
              >
                ↺ restart()
              </button>
            )}
            <button className="btn-danger" style={{ fontSize: '11px' }} onClick={onLeave}>
              .leave()
            </button>
          </div>
        </div>

        {/* 상태 메시지 (에러 포함) */}
        {studyState?.message && (
          <div className={`msg-bar ${studyState.message.startsWith('ERROR') ? 'error' : ''}`}>
            <span className="cmt">{'> '}</span>
            {studyState.message.replace('ERROR: ', '')}
          </div>
        )}

        {/* ── WAITING: 대기 화면 + 시작 버튼 ── */}
        {status === 'WAITING' && (
          <div className="code-block">
            <div className="c-line">
              <span className="ln">1</span>
              <span className="c-line-body">
                <span className="cmt">{'// Waiting for host to start...'}</span>
              </span>
            </div>
            <div className="c-line">
              <span className="ln">2</span>
              <span className="c-line-body">
                <span className="kw">const </span>
                <span className="var">players</span>
                <span className="pct"> = [</span>
                {playerNames.map((nm, i, arr) => (
                  <span key={i}>
                    <span className="str">"{nm}"</span>
                    {nm === nickname && <span className="cmt"> /*me*/</span>}
                    {i < arr.length - 1 && <span className="pct">, </span>}
                  </span>
                ))}
                <span className="pct">]</span>
                <span className="dim">  // {playerNames.length}/{room.maxPlayers}</span>
              </span>
            </div>
            <div className="c-line">
              <span className="ln">3</span>
              <span className="c-line-body" style={{ paddingLeft: 16 }}>
                {isHost ? (
                  // 방장: 2명 이상이면 시작 버튼 활성화
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      className="btn-primary"
                      style={{ fontSize: '12px' }}
                      onClick={handleStart}
                      disabled={playerNames.length < 2}
                    >
                      ▶ startGame()
                    </button>
                    {playerNames.length < 2 && (
                      <span className="cmt">// need at least 2 players</span>
                    )}
                  </span>
                ) : (
                  // 비방장: 방장이 시작하길 기다림
                  <span className="cmt">
                    {'// waiting for ' + playerNames[0] + ' to press start...'}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* ── SETUP / PLAYING / FINISHED: 게임 컴포넌트 ── */}
        {status !== 'WAITING' && (
          isBaseball ? (
            <Baseball
              studyState={studyState}
              sessionId={sessionId}
              myPlayerIndex={myPlayerIndex}
              sendMove={sendMove}
              digits={room.digits}
            />
          ) : (
            <Bingo
              studyState={studyState}
              sessionId={sessionId}
              myPlayerIndex={myPlayerIndex}
              sendMove={sendMove}
              boardSize={room.boardSize}
            />
          )
        )}
      </div>

      {/* ── 채팅 패널 (우측 220px) ── */}
      <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <Chat
          messages={chatMessages}
          myNickname={nickname}
          sessionId={sessionId}
          onSend={sendChat}
        />
      </div>
    </div>
  );
}
