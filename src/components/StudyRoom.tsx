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
import Alkkagi from './games/Alkkagi';
import AppleGame from './games/AppleGame';

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
    onCellSelect?: (address: string, value: string) => void;
    onRangeSelect?: (startAddress: string, endAddress: string) => void;
    workspaceMode?: 'vscode' | 'excel';
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
    onCellSelect,
    onRangeSelect,
    workspaceMode = 'vscode',
}: StudyRoomProps) {
    const [secretState, setSecretState] = useState<StudyStateResponse | null>(null);
    const [excelRoomSelection, setExcelRoomSelection] = useState('B10');
    const [excelRoomEdits, setExcelRoomEdits] = useState({ sessionMemo: '3인 실시간 대전 · 일반 매치', operationMemo: '참가자 연결 상태 확인 후 게임을 시작하세요.' });
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
    const isAlkkagi = room.studyType === 'ALKKAGI';
    const isApple   = room.studyType === 'APPLE_BOX';
    const maxPlayers = isTetris ? 3 : isIncidentAvoid || isBreakout ? 3 : room.maxPlayers;
    const isOldMaid = room.studyType === 'OLDMAID';
    const status = studyState?.status ?? room.status;
    const hasGameData = Boolean(studyState?.gameData);
    const isPlayableMember = myPlayerIndex >= 0 && myPlayerIndex < playerNames.length;

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
        window.setTimeout(onLeave, 80);
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

    const selectExcelRoomCell = (address: string, value: string) => {
        setExcelRoomSelection(address);
        onCellSelect?.(address, value);
        onRangeSelect?.(address, address);
    };

    return (
        <div className={`study-room-shell ${isTetris ? 'study-room-shell--tetris' : ''}`} style={{ display: 'flex', height: '100%' }}>
            {/* ── 게임 영역 ── */}
            <div className={`study-room-main ${isTetris ? 'tetris-room' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: isAlkkagi ? '4px' : '10px', minWidth: 0 }}>
                {/* 상단 정보바 */}
                <div
                    className="study-room-header"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: isAlkkagi ? '3px 8px' : '5px 10px',
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
                                      : isApple
                                        ? '10×17 · sum 10'
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
                {studyState?.message && !isAlkkagi && !studyState.message.startsWith('ROOM_CLOSED:') && (
                    <div className={`msg-bar study-room-status-message ${studyState.message.startsWith('ERROR') ? 'error' : ''}`}>
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
                    <div className={`code-block waiting-code-block ${isTetris ? 'tetris-waiting-code' : ''}`}>
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
                                        {i === myPlayerIndex && <span className="cmt"> /*me*/</span>}
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
                                                !isTetris && !isIncidentAvoid && !isBreakout && !isOldMaid && !isRushHour && !isUbongo && !isAlkkagi && !isApple && playerNames.length < 2
                                            }
                                        >
                                            ▶ startGame()
                                        </button>
                                        {!isTetris && !isIncidentAvoid && !isBreakout && !isOldMaid && !isAlkkagi && !isApple && playerNames.length < 2 && (
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

                {status === 'WAITING' && isTetris && (
                    <div className="tetris-excel-waiting-sheet" role="grid" aria-label="테트리스 게임방 대기 시트">
                        <div className="tetris-room-title" style={{ gridColumn: 'span 9' }}>테트리스 멀티플레이 세션 현황</div>

                        <div className="tetris-room-cell label">세션 ID</div><div className="tetris-room-cell" style={{ gridColumn: 'span 2' }}>{room.roomId}</div>
                        <div className="tetris-room-cell label">게임</div><div className="tetris-room-cell" style={{ gridColumn: 'span 2' }}>테트리스</div>
                        <div className="tetris-room-cell label">연결 상태</div><div className={`tetris-room-cell ${connected ? 'ready' : 'warning'}`} style={{ gridColumn: 'span 2' }}>{connected ? '● 서버 연결됨' : '○ 연결 중'}</div>

                        <div className="tetris-room-section" style={{ gridColumn: 'span 9' }}>1. 참가자 배정 현황</div>
                        <div className="tetris-room-cell table-head">No.</div><div className="tetris-room-cell table-head" style={{ gridColumn: 'span 3' }}>참가자</div><div className="tetris-room-cell table-head" style={{ gridColumn: 'span 2' }}>권한</div><div className="tetris-room-cell table-head">상태</div><div className="tetris-room-cell table-head" style={{ gridColumn: 'span 2' }}>접속 구분</div>
                        {Array.from({ length: 3 }, (_, index) => {
                            const player = playerNames[index];
                            return (
                                <div className="tetris-room-player-row" key={`tetris-player-slot-${index}`}>
                                    <div className="tetris-room-cell center">{index + 1}</div>
                                    <div className={`tetris-room-cell ${player ? 'player' : 'muted'}`} style={{ gridColumn: 'span 3' }}>{player || '참가자 대기 중'}</div>
                                    <div className="tetris-room-cell center" style={{ gridColumn: 'span 2' }}>{index === 0 ? '방장' : player ? '참가자' : '-'}</div>
                                    <div className={`tetris-room-cell center ${player ? 'ready' : 'muted'}`}>{player ? '접속' : '대기'}</div>
                                    <div className="tetris-room-cell center" style={{ gridColumn: 'span 2' }}>{player ? (index === myPlayerIndex ? '현재 사용자' : '원격 사용자') : '빈 슬롯'}</div>
                                </div>
                            );
                        })}

                        <div className="tetris-room-section" style={{ gridColumn: 'span 9' }}>2. 게임 운영 설정</div>
                        <div className="tetris-room-cell label">최대 인원</div><div className="tetris-room-cell center">3명</div>
                        <div className="tetris-room-cell label">보드 규격</div><div className="tetris-room-cell center">10 × 20</div>
                        <div className="tetris-room-cell label">동기화</div><div className="tetris-room-cell" style={{ gridColumn: 'span 2' }}>WebSocket 실시간</div>
                        <div className="tetris-room-cell label">진행 상태</div><div className="tetris-room-cell warning">시작 대기</div>

                        <div className="tetris-room-cell label">세션 메모</div>
                        <div className={`tetris-room-cell editable ${excelRoomSelection === 'B10' ? 'selected' : ''}`} style={{ gridColumn: 'span 8' }} contentEditable suppressContentEditableWarning onFocus={() => selectExcelRoomCell('B10', excelRoomEdits.sessionMemo)} onInput={(event) => { const value = event.currentTarget.textContent ?? ''; setExcelRoomEdits(current => ({ ...current, sessionMemo: value })); onCellSelect?.('B10', value); }}>{excelRoomEdits.sessionMemo}</div>
                        <div className="tetris-room-cell note-label">운영 메모</div>
                        <div className={`tetris-room-cell note editable ${excelRoomSelection === 'B11' ? 'selected' : ''}`} style={{ gridColumn: 'span 8' }} contentEditable suppressContentEditableWarning onFocus={() => selectExcelRoomCell('B11', excelRoomEdits.operationMemo)} onInput={(event) => { const value = event.currentTarget.textContent ?? ''; setExcelRoomEdits(current => ({ ...current, operationMemo: value })); onCellSelect?.('B11', value); }}>{excelRoomEdits.operationMemo}</div>

                        {Array.from({ length: 9 }, (_, index) => <div className="tetris-room-empty" key={`tetris-wait-spacer-${index}`} />)}
                        <div className="tetris-room-status" style={{ gridColumn: 'span 6' }}>{isHost ? '방장 권한 확인됨 · 게임 시작 가능' : `${playerNames[0] || '방장'}님의 시작 승인을 기다리는 중`}</div>
                        <button className="tetris-room-leave" type="button" onClick={handleLeave}>나가기</button>
                        {isHost ? <button className="tetris-room-start" type="button" onClick={handleStart}>게임 시작</button> : <div className="tetris-room-wait" style={{ gridColumn: 'span 2' }}>승인 대기</div>}
                        {Array.from({ length: 32 * 9 }, (_, index) => <div className="tetris-room-empty" key={`tetris-wait-empty-${index}`} />)}
                    </div>
                )}

                {/* ── SETUP / PLAYING / FINISHED: 게임 컴포넌트 ── */}
                {status !== 'WAITING' && !isPlayableMember && (
                    <div className="msg-bar error">
                        <span className="cmt">{'> '}</span>
                        Player sync failed. Please leave and join again.
                    </div>
                )}
                {status !== 'WAITING' && isPlayableMember && !hasGameData && (
                    <div className="code-block">
                        <div className="c-line">
                            <span className="ln">1</span>
                            <span className="c-line-body">
                                <span className="cmt">
                                    {status === 'FINISHED'
                                        ? '// Game ended because a player left. Host can restart.'
                                        : '// Game state is syncing...'}
                                </span>
                            </span>
                        </div>
                    </div>
                )}
                {status !== 'WAITING' && isPlayableMember && hasGameData &&
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
                            workspaceMode={workspaceMode}
                            onLeave={handleLeave}
                            onRestart={handleRestart}
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
                            secretState={secretState}
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
                    ) : isAlkkagi ? (
                        <Alkkagi
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                        />
                    ) : isApple ? (
                        <AppleGame
                            studyState={studyState}
                            sessionId={sessionId}
                            myPlayerIndex={myPlayerIndex}
                            sendMove={sendMove}
                            workspaceMode={workspaceMode}
                            onCellSelect={onCellSelect}
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
