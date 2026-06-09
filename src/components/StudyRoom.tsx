import { useState, useCallback, useEffect } from 'react';
import { Room, StudyStateResponse, ChatMessage } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import Baseball from './games/Baseball';
import Bingo from './games/Bingo';
import Omok from './games/Omok';
import OldMaid from './games/OldMaid';
import Tetris from './games/Tetris';
import IncidentAvoid from './games/IncidentAvoid';
import Chat from './Chat';

interface StudyRoomProps {
    room: Room;
    nickname: string;
    emoji: string;
    sessionId: string;
    studyState: StudyStateResponse | null;
    onStudyState: (state: StudyStateResponse) => void;
    onLeave: () => void;
    /** App의 탭 ✕ 버튼과 연결: 마운트 시 handleLeave를 여기에 등록 */
    leaveRef?: React.MutableRefObject<(() => void) | null>;
}

export default function StudyRoom({
    room,
    nickname,
    emoji,
    sessionId,
    studyState,
    onStudyState,
    onLeave,
    leaveRef,
}: StudyRoomProps) {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    const handleChat = useCallback((msg: ChatMessage) => {
        setChatMessages((prev) => [...prev, msg]);
    }, []);

    const { connected, sendMove, sendChat } = useWebSocket({
        roomId: room.roomId,
        onStudyState,
        onChat: handleChat,
    });

    const playerNames = studyState?.playerNames ?? room.playerNames;
    const myPlayerIndex = playerNames.indexOf(nickname);
    const isHost = myPlayerIndex === 0;
    const isBaseball = room.studyType === 'BASEBALL';
    const isOmok = room.studyType === 'OMOK';
    const isTetris = room.studyType === 'TETRIS';
    const isIncidentAvoid = room.studyType === 'INCIDENT_AVOID';
    const maxPlayers = isTetris || isIncidentAvoid ? 3 : room.maxPlayers;
    const isOldMaid = room.studyType === 'OLDMAID';
    const status = studyState?.status ?? room.status;

    /**
     * 방이 폐쇄됐을 때 자동으로 로비로 이동
     * 서버가 'ROOM_CLOSED:' 메시지를 보내면 방장이 나갔다는 신호입니다.
     */
    useEffect(() => {
        if (studyState?.message?.startsWith('ROOM_CLOSED:')) {
            // 잠시 메시지를 보여준 후 로비로 이동
            const timer = setTimeout(onLeave, 2000);
            return () => clearTimeout(timer);
        }
    }, [studyState?.message, onLeave]);

    /** 방 나가기: 서버에 LEAVE 알림 후 로비 전환 */
    const handleLeave = useCallback(() => {
        sendMove({ moveType: 'LEAVE', data: '', sessionId });
        // 서버 메시지 전송 직후 바로 로비로 전환
        // (WebSocket은 비동기라 deactivate 전에 publish가 완료됨)
        onLeave();
    }, [sendMove, sessionId, onLeave]);

    /**
     * 탭 ✕ 버튼과 연결
     * leaveRef.current에 handleLeave를 등록해두면
     * App.tsx의 탭 닫기 버튼에서 이 함수를 호출할 수 있습니다.
     */
    useEffect(() => {
        if (leaveRef) leaveRef.current = handleLeave;
        return () => {
            if (leaveRef) leaveRef.current = null;
        }; // 언마운트 시 정리
    }, [leaveRef, handleLeave]);

    /** 게임 시작 (방장 전용) */
    const handleStart = () => {
        sendMove({ moveType: 'START_GAME', data: '', sessionId });
    };

    /** 재시작 (방장 전용) */
    const handleRestart = () => {
        sendMove({ moveType: 'RESTART', data: '', sessionId });
    };

    /**
     * 채팅 전송 래퍼
     * sendChat(text, sessionId)를 호출하면서 emoji를 자동으로 추가합니다.
     * Chat 컴포넌트는 (text, sessionId)만 넘기므로, 여기서 emoji를 붙여줍니다.
     */
    const handleChatSend = useCallback(
        (text: string, sid: string) => {
            sendChat(text, sid, emoji);
        },
        [sendChat, emoji],
    );

    return (
        <div style={{ display: 'flex', gap: '12px', height: '100%' }}>
            {/* ── 게임 영역 ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                {/* 상단 정보바 */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 10px',
                        background: '#252526',
                        border: '1px solid #3e3e42',
                        fontSize: '12px',
                    }}
                >
                    <span>
                        <span className="cmt">{'// '}</span>
                        <span className="kw">room </span>
                        <span className="str">"{room.roomName}"</span>
                        <span className="dim"> · </span>
                        <span className="typ">{isOmok ? 'OMOK' : room.studyType}</span>
                        <span className="dim"> · </span>
                        <span className="num">
                            {isBaseball
                                ? `${room.digits}-digit`
                                : isTetris
                                  ? '20×10'
                                  : isIncidentAvoid
                                    ? '360×520'
                                  : isOldMaid
                                    ? '🃏 Old Maid'
                                    : `${room.boardSize}×${room.boardSize}`}
                        </span>
                        <span className="dim"> · </span>
                        <span style={{ color: connected ? '#6a9955' : '#f14c4c' }}>
                            {connected ? '● connected' : '○ connecting...'}
                        </span>
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {isHost && status === 'FINISHED' && (
                            <button className="btn-primary" style={{ fontSize: '11px' }} onClick={handleRestart}>
                                ↺ restart()
                            </button>
                        )}
                        {/* onLeave 대신 handleLeave를 사용해 서버에 알림 */}
                        <button className="btn-danger" style={{ fontSize: '11px' }} onClick={handleLeave}>
                            .leave()
                        </button>
                    </div>
                </div>

                {/* 상태 메시지 */}
                {studyState?.message && !studyState.message.startsWith('ROOM_CLOSED:') && (
                    <div className={`msg-bar ${studyState.message.startsWith('ERROR') ? 'error' : ''}`}>
                        <span className="cmt">{'> '}</span>
                        {studyState.message.replace('ERROR: ', '')}
                    </div>
                )}

                {/* 방 폐쇄 알림 */}
                {studyState?.message?.startsWith('ROOM_CLOSED:') && (
                    <div className="msg-bar error">
                        <span className="cmt">{'> '}</span>
                        Host has left. Returning to lobby...
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
                                <span className="dim">
                                    {' '}
                                    // {playerNames.length}/{maxPlayers}
                                </span>
                            </span>
                        </div>
                        <div className="c-line">
                            <span className="ln">3</span>
                            <span className="c-line-body" style={{ paddingLeft: 16 }}>
                                {isHost ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <button
                                            className="btn-primary"
                                            style={{ fontSize: '12px' }}
                                            onClick={handleStart}
                                            disabled={!isTetris && !isIncidentAvoid && !isOldMaid && playerNames.length < 2}
                                        >
                                            ▶ startGame()
                                        </button>
                                        {!isTetris && !isIncidentAvoid && !isOldMaid && playerNames.length < 2 && (
                                            <span className="cmt">// need at least 2 players</span>
                                        )}
                                    </span>
                                ) : (
                                    <span className="cmt">
                                        {'// waiting for ' + playerNames[0] + ' to press start...'}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                )}

                {/* ── SETUP / PLAYING / FINISHED: 게임 컴포넌트 ── */}
                {status !== 'WAITING' &&
                    (isBaseball ? (
                        <Baseball
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                            digits={room.digits}
                        />
                    ) : isOmok ? (
                        <Omok
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                            boardSize={room.boardSize}
                        />
                    ) : isOldMaid ? (
                        <OldMaid
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : isTetris ? (
                        <Tetris
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : isIncidentAvoid ? (
                        <IncidentAvoid
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : (
                        <Bingo
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                            boardSize={room.boardSize}
                        />
                    ))}
            </div>

            {/* ── 채팅 패널 (우측 220px) ── */}
            <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                <Chat
                    messages={chatMessages}
                    myNickname={nickname}
                    myEmoji={emoji}
                    sessionId={sessionId}
                    onSend={handleChatSend}
                />
            </div>
        </div>
    );
}
