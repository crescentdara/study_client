import { memo, useCallback, useEffect, useState } from 'react';
import { Room, StudyStateResponse } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import Baseball from './games/Baseball';
import Bingo from './games/Bingo';
import Omok from './games/Omok';
import OldMaid from './games/OldMaid';
import Tetris from './games/Tetris';
import IncidentAvoid from './games/IncidentAvoid';
import Breakout from './games/Breakout';
import CatchMind from './games/CatchMind';
import WordChainRoom from './games/WordChainRoom';
import Rummikub from './games/Rummikub';
import DaVinci from './games/DaVinci';
import RushHour from './games/RushHour';
import Ubongo from './games/Ubongo';

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

function StudyRoom({
    room,
    nickname,
    emoji: _emoji,
    sessionId,
    studyState,
    onStudyState,
    onLeave,
    leaveRef,
}: StudyRoomProps) {
    const [secretState, setSecretState] = useState<StudyStateResponse | null>(null);
    const { connected, sendMove } = useWebSocket({
        roomId: room.roomId,
        onStudyState,
        onSecretState: setSecretState,
    });

    const playerNames = studyState?.playerNames ?? room.playerNames;
    const myPlayerIndex = playerNames.indexOf(nickname);
    const isHost = myPlayerIndex === 0;
    const isBaseball = room.studyType === 'BASEBALL';
    const isOmok = room.studyType === 'OMOK';
    const isTetris = room.studyType === 'TETRIS';
    const isIncidentAvoid = room.studyType === 'INCIDENT_AVOID';
    const isBreakout = room.studyType === 'BREAKOUT';
    const isCatchMind = room.studyType === 'CATCHMIND';
    const isWordChain = room.studyType === 'WORD_CHAIN';
    const isRummikub = room.studyType === 'RUMMIKUB';
    const isDaVinci = room.studyType === 'DAVINCI_CODE';
    const isRushHour = room.studyType === 'RUSH_HOUR';
    const isUbongo   = room.studyType === 'UBONGO';
    const maxPlayers = isTetris || isIncidentAvoid || isBreakout ? 3 : room.maxPlayers;
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

    return (
        <div style={{ display: 'flex', height: '100%' }}>
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
                                    : isBreakout
                                      ? '420x520'
                                      : isCatchMind
                                        ? `${maxPlayers}p`
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
                        {isHost && (status === 'FINISHED' || (isUbongo && (studyState?.winner ?? -1) >= 0)) && (
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
                                            disabled={
                                                !isTetris && !isIncidentAvoid && !isBreakout && !isOldMaid && !isRushHour && !isUbongo && playerNames.length < 2
                                            }
                                        >
                                            ▶ startGame()
                                        </button>
                                        {!isTetris && !isIncidentAvoid && !isBreakout && !isOldMaid && playerNames.length < 2 && (
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
                    ) : isBreakout ? (
                        <Breakout
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : isCatchMind ? (
                        <CatchMind
                            studyState={studyState}
                            secretState={secretState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : isWordChain ? (
                        <WordChainRoom
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : isRummikub ? (
                        <Rummikub
                            studyState={studyState}
                            secretState={secretState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : isDaVinci ? (
                        <DaVinci
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : isRushHour ? (
                        <RushHour
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : isUbongo ? (
                        <Ubongo
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
        </div>
    );
}

export default memo(StudyRoom);
