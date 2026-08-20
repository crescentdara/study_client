import { useState } from 'react';
import { Room, StudyType, CreateRoomRequest, AppleBoxRecord, TetrisRankRow } from '../types';
import { useAppleLeaderboard, useAppleRankOpen } from '../hooks/useAppleLeaderboard';
import { useTetrisLeaderboard, useTetrisRankOpen, tierLabel } from '../hooks/useTetrisLeaderboard';
import LunchVote from './LunchVote';

interface LobbyProps {
    nickname: string;
    emoji: string;
    sessionId: string;
    onNicknameChange: (name: string) => void;
    onEmojiChange: (emoji: string) => void;
    onJoinRoom: (room: Room) => void;
    rooms: Room[];
    loading: boolean;
    fetchRooms: () => void;
    profileEditing: boolean;
    onJoin: (roomId: string) => void;
    lobbyError: string;
    onClearLobbyError: () => void;
    wordRainOn?: boolean;
}

function Lobby({
    nickname,
    sessionId,
    onJoinRoom,
    rooms,
    loading,
    fetchRooms,
    profileEditing,
    onJoin,
    lobbyError,
    onClearLobbyError,
    wordRainOn,
}: LobbyProps) {
    const [error, setError] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [studyType, setStudyType] = useState<StudyType>('BASEBALL');
    const [maxPlayers, setMaxPlayers] = useState(2);
    const [digits, setDigits] = useState(3);
    const [boardSize, setBoardSize] = useState(5);
    const [creating, setCreating] = useState(false);
    // 테트리스 방 만들 때 대전/서바이벌 중 무엇으로 열지
    const [tetrisSurvival, setTetrisSurvival] = useState(false);
    const appleRanking = useAppleLeaderboard(10);
    const appleRank = useAppleRankOpen();
    const tetrisRanking = useTetrisLeaderboard(10);
    const tetrisRank = useTetrisRankOpen();
    // 사과게임은 방을 만들지 않는다 — 좌측 🍎 버튼으로 혼자 바로 시작한다
    const mainStudyTypes: StudyType[] = ['BASEBALL', 'BINGO', 'OMOK', 'TETRIS', 'CATCHMIND', 'OLDMAID', 'WORD_CHAIN', 'RUMMIKUB', 'DAVINCI_CODE', 'RUSH_HOUR', 'UBONGO', 'ALKKAGI'];

    const defaultRoomName = (type: StudyType) => `${type} room`;
    const selectStudyType = (type: StudyType) => {
        setStudyType(type);
        if (type !== 'TETRIS') setTetrisSurvival(false);
        if (type === 'OMOK') { setMaxPlayers(2); setBoardSize(19); }
        else if (type === 'ALKKAGI') { setMaxPlayers(1); setBoardSize(0); }
        else if (type === 'TETRIS') { setMaxPlayers(3); setBoardSize(20); }
        else if (type === 'INCIDENT_AVOID' || type === 'BREAKOUT') { setMaxPlayers(3); setBoardSize(20); }
        else if (type === 'OLDMAID') { setMaxPlayers(4); setBoardSize(0); }
        else if (type === 'WORD_CHAIN') { setMaxPlayers(4); setDigits(7); }
        else if (type === 'RUMMIKUB') { setMaxPlayers(4); setBoardSize(0); }
        else if (type === 'DAVINCI_CODE') { setMaxPlayers(4); setBoardSize(0); }
        else if (type === 'RUSH_HOUR') { setMaxPlayers(1); setBoardSize(0); }
        else if (type === 'UBONGO') { setMaxPlayers(1); setBoardSize(0); }
    };

    const handleCreate = async () => {
        if (profileEditing) { setError('Save your profile first.'); return; }
        if (!nickname.trim()) { setError('Enter a nickname first.'); return; }
        setCreating(true);
        try {
            const body: CreateRoomRequest = {
                roomName: roomName.trim() || defaultRoomName(studyType),
                studyType,
                nickname: nickname.trim(),
                sessionId,
                maxPlayers:
                    // 서바이벌은 1~3명 중 고른 값을 그대로, 대전은 항상 3명
                    studyType === 'TETRIS'
                        ? (tetrisSurvival ? Math.max(1, Math.min(3, maxPlayers)) : 3)
                    : studyType === 'INCIDENT_AVOID' || studyType === 'BREAKOUT'
                        ? 3
                        : studyType === 'OMOK'
                          ? 2
                        : maxPlayers,
                digits,
                boardSize:
                    studyType === 'TETRIS' || studyType === 'INCIDENT_AVOID' || studyType === 'BREAKOUT'
                        ? 20
                        : studyType === 'OMOK'
                          ? 19
                          : studyType === 'ALKKAGI'
                            ? 0
                          : studyType === 'OLDMAID'
                            ? 0
                            : boardSize,
                mode: studyType === 'TETRIS' && tetrisSurvival ? 'SURVIVAL' : '',
            };
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await res.text());
            onJoinRoom(await res.json());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to create room.');
        } finally {
            setCreating(false);
        }
    };

    // 에디터 줄 번호 헬퍼
    let ln = 1;
    const L = (body: React.ReactNode, indent = 0) => {
        const n = ln++;
        return (
            <div className="c-line" key={n}>
                <span className="ln">{n}</span>
                <span className="c-line-body" style={{ paddingLeft: indent * 16 }}>
                    {body}
                </span>
            </div>
        );
    };

    // 랭킹 한 줄 — 주간·누적 목록이 같은 모양을 쓴다
    const appleRankRow = (record: AppleBoxRecord) => {
        const mine = record.nickname === nickname;
        return L(
            <span style={{ display: 'flex', alignItems: 'center' }}>
                <span className="pct">{'{ '}</span>
                <span className="var">rank</span><span className="pct">: </span>
                <span className="num">{record.rank}</span><span className="pct">, </span>
                <span className="var">nickname</span><span className="pct">: </span>
                <span className="str" style={mine ? { color: '#4ec9b0', fontWeight: 700 } : undefined}>
                    {`"${record.nickname}"`}
                </span><span className="pct">, </span>
                <span className="var">best</span><span className="pct">: </span>
                <span className="num">{record.best}</span><span className="pct">, </span>
                <span className="var">games</span><span className="pct">: </span>
                <span className="num">{record.games}</span>
                <span className="pct">{' },'}</span>
            </span>,
            1,
        );
    };

    // 테트리스 전적 한 줄 — 티어와 승패를 함께 보여준다
    const tetrisRankRow = (row: TetrisRankRow) => {
        const mine = row.nickname === nickname;
        return L(
            <span style={{ display: 'flex', alignItems: 'center' }}>
                <span className="pct">{'{ '}</span>
                <span className="var">rank</span><span className="pct">: </span>
                <span className="num">{row.rank}</span><span className="pct">, </span>
                <span className="var">nickname</span><span className="pct">: </span>
                <span className="str" style={mine ? { color: '#4ec9b0', fontWeight: 700 } : undefined}>
                    {`"${row.nickname}"`}
                </span><span className="pct">, </span>
                <span className="var">tier</span><span className="pct">: </span>
                <span className="str">{`"${tierLabel(row)}"`}</span><span className="pct">, </span>
                <span className="var">rp</span><span className="pct">: </span>
                <span className="num">{row.ranked ? row.rp : row.rating}</span><span className="pct">, </span>
                <span className="var">record</span><span className="pct">: </span>
                <span className="str">{`"${row.wins}승 ${row.losses}패"`}</span>
                <span className="pct">{' },'}</span>
            </span>,
            1,
        );
    };

    const displayError = error || lobbyError;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: '#1e1e1e',
                fontFamily: "'Consolas','Courier New',monospace",
                position: 'relative',
            }}
        >
            {/* 오류 바 */}
            {displayError && (
                <div
                    className="msg-bar error"
                    style={{ margin: 0, borderRadius: 0, flexShrink: 0, cursor: 'pointer' }}
                    onClick={() => { setError(''); onClearLobbyError(); }}
                >
                    <span className="cmt">// </span>
                    <span style={{ color: '#f44747' }}>error: </span>
                    {displayError}
                </div>
            )}

            {/* 스크롤 가능한 에디터 콘텐츠 */}
            <div style={{ flex: 1, overflow: 'auto' }}>

                {/* ── 워드레인 실행 중: symbol-resolver 설명 블록 ── */}
                {wordRainOn && (
                    <div className="code-block" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid #2a2a2a' }}>
                        {L(<><span className="cmt">{'// config/symbol-resolver.ts'}</span></>)}
                        {L(<><span className="kw">import </span><span className="pct">{'{ '}</span><span className="typ">Resolver</span><span className="pct">{', '}</span><span className="typ">DaemonConfig</span><span className="pct">{' }'}</span><span className="kw"> from </span><span className="str">"@study/daemon"</span></>)}
                        {L(<></>)}
                        {L(<><span className="cmt">{'/**'}</span></>)}
                        {L(<><span className="cmt">{' * Symbol Resolver — JS identifier trainer'}</span></>)}
                        {L(<><span className="cmt">{' *'}</span></>)}
                        {L(<><span className="cmt">{' * @usage  identifier + Enter  →  resolve a falling symbol'}</span></>)}
                        {L(<><span className="cmt">{' * @usage  ESC               →  hide overlay  (game pauses)'}</span></>)}
                        {L(<><span className="cmt">{' * @usage  wordrain stop     →  terminate daemon'}</span></>)}
                        {L(<><span className="cmt">{' */'}</span></>)}
                        {L(<><span className="kw">export function </span><span className="fn">useSymbolResolver</span><span className="pct">{'(cfg: '}</span><span className="typ">DaemonConfig</span><span className="pct">{'): '}</span><span className="typ">Resolver</span><span className="pct">{' {'}</span></>)}
                        {L(<><span className="kw">const </span><span className="var">daemon</span><span className="pct"> = </span><span className="kw">new </span><span className="typ">Resolver</span><span className="pct">{'(cfg)'}</span></>, 1)}
                        {L(<><span className="var">daemon</span><span className="pct">{'.'}</span><span className="fn">start</span><span className="pct">{'()'}</span><span className="cmt">{'  // begins emitting identifiers'}</span></>, 1)}
                        {L(<><span className="kw">return </span><span className="var">daemon</span></>, 1)}
                        {L(<><span className="pct">{'}'}</span></>)}
                        {L(<></>)}
                    </div>
                )}

                {/* ── 방 목록 뷰 ── */}
                {!showCreate && (
                    <div className="code-block" style={{ borderRadius: 0, border: 'none' }}>
                        {L(<><span className="cmt">{'// lobby.ts — Available rooms'}</span></>)}
                        {L(
                            <>
                                <span className="kw">import </span>
                                <span className="pct">{'{ '}</span>
                                <span className="var">Room</span>
                                <span className="pct">{' }'}</span>
                                <span className="kw"> from </span>
                                <span className="str">"@study/platform"</span>
                            </>,
                        )}
                        {L(<></>)}
                        {L(
                            <>
                                <span className="kw">const </span>
                                <span className="var">rooms</span>
                                <span className="pct">: </span>
                                <span className="typ">Room</span>
                                <span className="pct">[] = [</span>
                                <span className="cmt">{`  // ${rooms.length} room${rooms.length !== 1 ? 's' : ''}`}</span>
                            </>,
                        )}

                        {rooms.length === 0 &&
                            L(<><span className="cmt">{'  // no rooms — create one!'}</span></>)}

                        {rooms.map((room) => {
                            const opt =
                                room.studyType === 'BASEBALL'
                                    ? `${room.digits}digit`
                                    : room.studyType === 'TETRIS'
                                      ? (room.mode === 'SURVIVAL' ? 'survival' : '20x10')
                                      : room.studyType === 'INCIDENT_AVOID'
                                        ? '360x520'
                                        : room.studyType === 'BREAKOUT'
                                          ? '420x520'
                                          : room.studyType === 'CATCHMIND'
                                            ? `${room.maxPlayers}p`
                                          : room.studyType === 'WORD_CHAIN'
                                            ? `${room.digits}초`
                                          : room.studyType === 'RUMMIKUB'
                                            ? `${room.maxPlayers}p`
                                          : room.studyType === 'DAVINCI_CODE'
                                            ? `${room.maxPlayers}p`
                                          : room.studyType === 'RUSH_HOUR'
                                            ? `${room.maxPlayers}p`
                                          : room.studyType === 'ALKKAGI'
                                            ? `${room.maxPlayers}p`
                                          : room.studyType === 'APPLE_BOX'
                                            ? `10x17 · ${room.maxPlayers}p`
                                          : room.studyType === 'OMOK'
                                            ? '19x19'
                                            : room.studyType === 'OLDMAID'
                                              ? `${room.maxPlayers}p`
                                              : `${room.boardSize}x${room.boardSize}`;
                            const lineNum = ln++;
                            return (
                                <div className="c-line" key={room.roomId}>
                                    <span className="ln">{lineNum}</span>
                                    <span
                                        className="c-line-body"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}
                                    >
                                        <span style={{ flex: 1, overflow: 'hidden' }}>
                                            {'  '}
                                            <span className="pct">{'{ '}</span>
                                            <span className="var">name</span>
                                            <span className="pct">: </span>
                                            <span className="str">"{room.roomName}"</span>
                                            <span className="pct">, </span>
                                            <span className="var">type</span>
                                            <span className="pct">: </span>
                                            <span className="typ">{room.studyType}</span>
                                            <span className="pct">, </span>
                                            <span className="var">opt</span>
                                            <span className="pct">: </span>
                                            <span className="str">"{opt}"</span>
                                            <span className="pct">, </span>
                                            <span className="var">n</span>
                                            <span className="pct">: </span>
                                            <span className="num">{room.playerCount}</span>
                                            <span className="pct">/</span>
                                            <span className="num">
                                                {room.studyType === 'TETRIS' && room.mode !== 'SURVIVAL' ? 3 : room.maxPlayers}
                                            </span>
                                            <span className="pct">{' }'}</span>
                                        </span>
                                        <button
                                            className="btn-primary"
                                            style={{ fontSize: '11px', padding: '2px 10px', flexShrink: 0, marginRight: '4px' }}
                                            onClick={() => onJoin(room.roomId)}
                                        >
                                            .join()
                                        </button>
                                    </span>
                                </div>
                            );
                        })}

                        {L(<><span className="pct">]</span></>)}
                        {L(<></>)}
                        {(() => {
                            const lineNum = ln++;
                            return (
                                <div className="c-line" key={lineNum}>
                                    <span className="ln">{lineNum}</span>
                                    <span className="c-line-body" style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn-secondary" style={{ fontSize: '11px' }} onClick={fetchRooms} disabled={loading}>
                                            {loading ? 'refreshing...' : '↺ refresh()'}
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            style={{ fontSize: '11px', background: '#00ab77', color: '#fff' }}
                                            onClick={() => setShowCreate(true)}
                                        >
                                            + createRoom()
                                        </button>
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* ── 사과게임 랭킹 — 접었다 펼 수 있다 (설명 주석 없이 값만) ── */}
                {!showCreate && (
                    <LunchVote nickname={nickname} theme="vscode" />
                )}

                {!showCreate && (
                    <div className="code-block" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid #2a2a2a' }}>
                        {L(<></>)}
                        {L(
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span
                                    onClick={appleRank.toggle}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                    title={appleRank.open ? '접기' : '펼치기'}
                                >
                                    <span className="cmt" style={{ width: '9px' }}>{appleRank.open ? '▾' : '▸'}</span>
                                    <span className="kw">const </span>
                                    <span className="var">appleRanking</span>
                                    {appleRank.open ? (
                                        <>
                                            <span className="pct"> = </span>
                                            <span className="kw">await </span>
                                            <span className="fn">fetchTop</span>
                                            <span className="pct">{'(10)'}</span>
                                        </>
                                    ) : (
                                        <span className="pct">{' = [ ⋯ ]'}</span>
                                    )}
                                </span>
                                {appleRank.open && (
                                    <button
                                        className="btn-secondary"
                                        style={{ fontSize: '10px', padding: '1px 8px' }}
                                        onClick={() => void appleRanking.reload()}
                                        disabled={appleRanking.loading}
                                    >
                                        {appleRanking.loading ? 'loading...' : '↺ reload()'}
                                    </button>
                                )}
                                {appleRanking.failed && (
                                    <span style={{ color: '#f44747', fontSize: '10px' }}>불러오지 못했습니다</span>
                                )}
                            </span>,
                        )}

                        {appleRank.open && (
                            <>
                                {L(
                                    <>
                                        <span className="kw">const </span>
                                        <span className="var">weekly</span>
                                        <span className="pct">: </span>
                                        <span className="typ">AppleScore</span>
                                        <span className="pct">[] = [</span>
                                    </>,
                                )}
                                {appleRanking.weekly.map(appleRankRow)}
                                {L(<><span className="pct">]</span></>)}
                                {L(<></>)}

                                {L(
                                    <>
                                        <span className="kw">const </span>
                                        <span className="var">allTime</span>
                                        <span className="pct">: </span>
                                        <span className="typ">AppleScore</span>
                                        <span className="pct">[] = [</span>
                                    </>,
                                )}
                                {appleRanking.records.map(appleRankRow)}
                                {L(<><span className="pct">]</span></>)}
                            </>
                        )}
                    </div>
                )}

                {/* ── 테트리스 전적·티어 — 사과게임 랭킹과 같은 접기 방식 ── */}
                {!showCreate && (
                    <div className="code-block" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid #2a2a2a' }}>
                        {L(<></>)}
                        {L(
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span
                                    onClick={tetrisRank.toggle}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                    title={tetrisRank.open ? '접기' : '펼치기'}
                                >
                                    <span className="cmt" style={{ width: '9px' }}>{tetrisRank.open ? '▾' : '▸'}</span>
                                    <span className="kw">const </span>
                                    <span className="var">tetrisLadder</span>
                                    {tetrisRank.open ? (
                                        <>
                                            <span className="pct"> = </span>
                                            <span className="kw">await </span>
                                            <span className="fn">fetchLadder</span>
                                            <span className="pct">{'(10)'}</span>
                                        </>
                                    ) : (
                                            <span className="pct">{' = [ ⋯ ]'}</span>
                                    )}
                                </span>
                                {tetrisRank.open && (
                                    <button
                                        className="btn-secondary"
                                        style={{ fontSize: '10px', padding: '1px 8px' }}
                                        onClick={() => void tetrisRanking.reload()}
                                        disabled={tetrisRanking.loading}
                                    >
                                        {tetrisRanking.loading ? 'loading...' : '↺ reload()'}
                                    </button>
                                )}
                                {tetrisRanking.failed && (
                                    <span style={{ color: '#f44747', fontSize: '10px' }}>불러오지 못했습니다</span>
                                )}
                            </span>,
                        )}

                        {tetrisRank.open && (
                            <>
                                {L(
                                    <>
                                        <span className="kw">const </span>
                                        <span className="var">versus</span>
                                        <span className="pct">: </span>
                                        <span className="typ">TetrisRank</span>
                                        <span className="pct">[] = [</span>
                                    </>,
                                )}
                                {tetrisRanking.records.map(tetrisRankRow)}
                                {L(<><span className="pct">]</span></>)}
                                {L(<></>)}

                                {L(
                                    <>
                                        <span className="kw">const </span>
                                        <span className="var">survival</span>
                                        <span className="pct">: </span>
                                        <span className="typ">TetrisRank</span>
                                        <span className="pct">[] = [</span>
                                    </>,
                                )}
                                {tetrisRanking.survival.map(tetrisRankRow)}
                                {L(<><span className="pct">]</span></>)}
                            </>
                        )}
                    </div>
                )}

                {/* ── Filler: matchmaking.ts ── */}
                <div className="code-block" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid #2a2a2a' }}>
                    {L(<></>)}
                    {L(<><span className="cmt">{'// utils/matchmaking.ts'}</span></>)}
                    {L(<><span className="kw">import </span><span className="pct">{'{ '}</span><span className="var">Player</span><span className="pct">{', '}</span><span className="var">Room</span><span className="pct">{' }'}</span><span className="kw"> from </span><span className="str">"@study/types"</span></>)}
                    {L(<><span className="kw">import </span><span className="pct">{'{ '}</span><span className="var">shuffle</span><span className="pct">{' }'}</span><span className="kw"> from </span><span className="str">"lodash"</span></>)}
                    {L(<></>)}
                    {L(<><span className="kw">const </span><span className="var">MAX_RECONNECT</span><span className="pct"> = </span><span className="num">5</span></>)}
                    {L(<><span className="kw">const </span><span className="var">HEARTBEAT_MS</span><span className="pct"> = </span><span className="num">3000</span></>)}
                    {L(<><span className="kw">const </span><span className="var">LOBBY_VERSION</span><span className="pct"> = </span><span className="str">"2.4.1"</span></>)}
                    {L(<></>)}
                    {L(<><span className="kw">interface </span><span className="typ">MatchConfig</span><span className="pct">{' {'}</span></>)}
                    {L(<><span className="var">mode</span><span className="pct">: </span><span className="str">"ranked"</span><span className="pct">{' | '}</span><span className="str">"casual"</span><span className="pct">{' | '}</span><span className="str">"custom"</span></>, 1)}
                    {L(<><span className="var">maxLatency</span><span className="pct">: </span><span className="typ">number</span><span className="cmt">{'  // ms'}</span></>, 1)}
                    {L(<><span className="var">region</span><span className="pct">: </span><span className="str">"kr"</span><span className="pct">{' | '}</span><span className="str">"jp"</span><span className="pct">{' | '}</span><span className="str">"global"</span></>, 1)}
                    {L(<><span className="var">allowSpectators</span><span className="pct">?: </span><span className="typ">boolean</span></>, 1)}
                    {L(<><span className="pct">{'}'}</span></>)}
                    {L(<></>)}
                    {L(<><span className="kw">async function </span><span className="fn">findMatch</span><span className="pct">{'(player: Player, cfg: MatchConfig) {'}</span></>)}
                    {L(<><span className="kw">const </span><span className="var">pool</span><span className="pct"> = </span><span className="kw">await </span><span className="fn">fetchRoomPool</span><span className="pct">{'({ region: cfg.region })'}</span></>, 1)}
                    {L(<><span className="kw">const </span><span className="var">ok</span><span className="pct"> = </span><span className="var">pool</span><span className="pct">{'.'}</span><span className="fn">filter</span><span className="pct">{'(r => r.ping <= cfg.maxLatency)'}</span></>, 1)}
                    {L(<><span className="kw">if </span><span className="pct">{'(ok.length === 0)'}</span><span className="kw"> return </span><span className="num">null</span></>, 1)}
                    {L(<><span className="kw">return </span><span className="fn">shuffle</span><span className="pct">{'(ok)[0]'}</span></>, 1)}
                    {L(<><span className="pct">{'}'}</span></>)}
                    {L(<></>)}
                    {L(<><span className="kw">function </span><span className="fn">calcMMR</span><span className="pct">{'(wins: number, losses: number): number {'}</span></>)}
                    {L(<><span className="kw">const </span><span className="var">total</span><span className="pct"> = </span><span className="var">wins</span><span className="pct"> + </span><span className="var">losses</span></>, 1)}
                    {L(<><span className="kw">if </span><span className="pct">{'(total === 0)'}</span><span className="kw"> return </span><span className="num">1000</span><span className="cmt">{'  // default'}</span></>, 1)}
                    {L(<><span className="kw">return </span><span className="typ">Math</span><span className="pct">{'.'}</span><span className="fn">round</span><span className="pct">{'(1000 + (wins / total - 0.5) * 400)'}</span></>, 1)}
                    {L(<><span className="pct">{'}'}</span></>)}
                    {L(<></>)}
                    {L(<><span className="cmt">{'// event bus'}</span></>)}
                    {L(<><span className="kw">const </span><span className="var">emitter</span><span className="pct"> = </span><span className="kw">new </span><span className="typ">EventEmitter</span><span className="pct">{'()'}</span></>)}
                    {L(<><span className="var">emitter</span><span className="pct">{'.'}</span><span className="fn">on</span><span className="pct">{'("room:created", (r) => console.log("[lobby]", r.roomId))'}</span></>)}
                    {L(<><span className="var">emitter</span><span className="pct">{'.'}</span><span className="fn">on</span><span className="pct">{'("player:joined", (p) => updateRoster(p))'}</span></>)}
                    {L(<><span className="var">emitter</span><span className="pct">{'.'}</span><span className="fn">on</span><span className="pct">{'("session:expire", () => handleLogout())'}</span></>)}
                    {L(<></>)}
                    {L(<><span className="kw">export </span><span className="pct">{'{ '}</span><span className="fn">findMatch</span><span className="pct">{', '}</span><span className="fn">calcMMR</span><span className="pct">{', '}</span><span className="var">emitter</span><span className="pct">{' }'}</span></>)}
                </div>

                {/* ── 방 만들기 뷰 ── */}
                {showCreate && (
                    <div className="code-block" style={{ borderRadius: 0, border: 'none' }}>
                        {L(<><span className="cmt">{'// createRoom.ts'}</span></>)}
                        {L(
                            <>
                                <span className="kw">import </span>
                                <span className="pct">{'{ '}</span>
                                <span className="var">StudyType</span>
                                <span className="pct">{' }'}</span>
                                <span className="kw"> from </span>
                                <span className="str">"@study/types"</span>
                            </>,
                        )}
                        {L(<></>)}
                        {L(
                            <>
                                <span className="kw">async function </span>
                                <span className="fn">createRoom</span>
                                <span className="pct">{'() {'}</span>
                            </>,
                        )}

                        {L(
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="kw">const </span>
                                <span className="var">name</span>
                                <span className="pct"> = </span>
                                <input
                                    autoFocus
                                    style={{ width: '220px', fontSize: '12px', padding: '2px 6px', background: '#1e1e1e', color: '#ce9178', border: '1px solid #3e3e42', outline: 'none' }}
                                    placeholder='"room name"'
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    maxLength={20}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                />
                            </span>,
                            1,
                        )}

                        {L(
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span className="kw">const </span>
                                <span className="var">type</span>
                                <span className="pct">: </span>
                                <span className="typ">StudyType</span>
                                <span className="pct"> = </span>
                                {mainStudyTypes.map((t) => (
                                    <button
                                        key={t}
                                        className={`btn-opt ${studyType === t ? 'on' : ''}`}
                                        onClick={() => selectStudyType(t)}
                                        style={{ fontSize: '11px' }}
                                    >
                                        <span className="typ">{t}</span>
                                    </button>
                                ))}
                            </span>,
                            1,
                        )}

                        {studyType === 'OLDMAID' &&
                            L(
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="kw">const </span><span className="var">maxPlayers</span><span className="pct"> = </span>
                                    {[2, 3, 4, 5, 6, 7].map((n) => (
                                        <button key={n} className={`btn-opt ${maxPlayers === n ? 'on' : ''}`} onClick={() => setMaxPlayers(n)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                                            <span className="num">{n}</span>
                                        </button>
                                    ))}
                                    <span className="cmt"> // joker stays last</span>
                                </span>,
                                1,
                            )}
                        {studyType === 'TETRIS' &&
                            L(
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="kw">const </span>
                                    <span className="var">mode</span>
                                    <span className="pct"> = </span>
                                    <button
                                        className={`btn-opt ${tetrisSurvival ? '' : 'on'}`}
                                        onClick={() => setTetrisSurvival(false)}
                                        style={{ fontSize: '11px', padding: '3px 8px' }}
                                    >
                                        <span className="str">"versus"</span>
                                    </button>
                                    <button
                                        className={`btn-opt ${tetrisSurvival ? 'on' : ''}`}
                                        onClick={() => { setTetrisSurvival(true); setMaxPlayers(1); }}
                                        style={{ fontSize: '11px', padding: '3px 8px' }}
                                    >
                                        <span className="str">"survival"</span>
                                    </button>
                                </span>,
                                1,
                            )}
                        {studyType === 'TETRIS' &&
                            L(
                                tetrisSurvival
                                    ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span className="kw">const </span>
                                            <span className="var">players</span>
                                            <span className="pct"> = </span>
                                            {[1, 2, 3].map((n) => (
                                                <button
                                                    key={n}
                                                    className={`btn-opt ${maxPlayers === n ? 'on' : ''}`}
                                                    onClick={() => setMaxPlayers(n)}
                                                    style={{ fontSize: '11px', padding: '3px 8px' }}
                                                >
                                                    <span className="num">{n}</span>
                                                </button>
                                            ))}
                                        </span>
                                    )
                                    : <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="kw">const </span><span className="var">players</span><span className="pct"> = </span><span className="num">1..3</span><span className="cmt"> // 1명 연습, 2~3명 랭크전</span></span>,
                                1,
                            )}
                        {(studyType === 'INCIDENT_AVOID' || studyType === 'BREAKOUT') &&
                            L(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="kw">const </span><span className="var">maxPlayers</span><span className="pct"> = </span><span className="num">3</span><span className="cmt"> // fixed</span></span>, 1)}
                        {studyType === 'OMOK' &&
                            L(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="kw">const </span><span className="var">maxPlayers</span><span className="pct"> = </span><span className="num">2</span><span className="cmt"> // 1v1 only</span></span>, 1)}
                        {studyType === 'ALKKAGI' &&
                            L(
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="kw">const </span><span className="var">maxPlayers</span><span className="pct"> = </span>
                                    {[1, 2, 3].map((n) => (
                                        <button key={n} className={`btn-opt ${maxPlayers === n ? 'on' : ''}`} onClick={() => setMaxPlayers(n)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                                            <span className="num">{n}</span>
                                        </button>
                                    ))}
                                </span>,
                                1,
                            )}
                        {(studyType === 'RUSH_HOUR' || studyType === 'UBONGO') &&
                            L(
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="kw">const </span><span className="var">maxPlayers</span><span className="pct"> = </span>
                                    {[1, 2, 3].map((n) => (
                                        <button key={n} className={`btn-opt ${maxPlayers === n ? 'on' : ''}`} onClick={() => setMaxPlayers(n)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                                            <span className="num">{n}</span>
                                        </button>
                                    ))}
                                </span>,
                                1,
                            )}
                        {studyType !== 'OLDMAID' && studyType !== 'TETRIS' && studyType !== 'INCIDENT_AVOID' && studyType !== 'BREAKOUT' && studyType !== 'OMOK' && studyType !== 'ALKKAGI' && studyType !== 'RUSH_HOUR' && studyType !== 'UBONGO' &&
                            L(
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="kw">const </span><span className="var">maxPlayers</span><span className="pct"> = </span>
                                    {[2, 3, 4, 5, 6].map((n) => (
                                        <button key={n} className={`btn-opt ${maxPlayers === n ? 'on' : ''}`} onClick={() => setMaxPlayers(n)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                                            <span className="num">{n}</span>
                                        </button>
                                    ))}
                                </span>,
                                1,
                            )}

                        {studyType === 'BASEBALL' &&
                            L(
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="kw">const </span><span className="var">digits</span><span className="pct"> = </span>
                                    {[3, 4, 5].map((d) => (
                                        <button key={d} className={`btn-opt ${digits === d ? 'on' : ''}`} onClick={() => setDigits(d)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                                            <span className="num">{d}</span>
                                        </button>
                                    ))}
                                    <span className="cmt"> // no duplicates, 1–9</span>
                                </span>,
                                1,
                            )}

                        {studyType === 'BINGO' &&
                            L(
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="kw">const </span><span className="var">boardSize</span><span className="pct"> = </span>
                                    {[3, 4, 5].map((s) => (
                                        <button key={s} className={`btn-opt ${boardSize === s ? 'on' : ''}`} onClick={() => setBoardSize(s)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                                            <span className="num">{s}</span>
                                        </button>
                                    ))}
                                    <span className="cmt"> // win: {boardSize === 3 ? 2 : 3} lines</span>
                                </span>,
                                1,
                            )}

                        {studyType === 'CATCHMIND' &&
                            L(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="kw">const </span><span className="var">rounds</span><span className="pct"> = </span><span className="str">"players x 2"</span><span className="cmt"> // drawing and guessing</span></span>, 1)}

                        {studyType === 'WORD_CHAIN' &&
                            L(
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="kw">const </span><span className="var">timeLimit</span><span className="pct"> = </span>
                                    {[5, 7, 10, 15, 20].map((s) => (
                                        <button key={s} className={`btn-opt ${digits === s ? 'on' : ''}`} onClick={() => setDigits(s)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                                            <span className="num">{s}s</span>
                                        </button>
                                    ))}
                                    <span className="cmt"> // seconds per turn</span>
                                </span>,
                                1,
                            )}

                        {studyType === 'OMOK' &&
                            L(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="kw">const </span><span className="var">boardSize</span><span className="pct"> = </span><span className="num">19</span><span className="cmt"> // fixed 19×19, P1 3-3 banned</span></span>, 1)}
                        {studyType === 'ALKKAGI' &&
                            L(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="kw">const </span><span className="var">board</span><span className="pct"> = </span><span className="str">"drag shot"</span><span className="cmt"> // click, pull, release</span></span>, 1)}
                        {studyType === 'TETRIS' &&
                            L(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="kw">const </span><span className="var">queue</span><span className="pct"> = </span><span className="str">"20x10"</span><span className="cmt"> // 2-player default, max 3</span></span>, 1)}
                        {studyType === 'INCIDENT_AVOID' &&
                            L(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="kw">const </span><span className="var">monitor</span><span className="pct"> = </span><span className="str">"360x520"</span><span className="cmt"> // 3-player workspace</span></span>, 1)}
                        {studyType === 'BREAKOUT' &&
                            L(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="kw">const </span><span className="var">pipeline</span><span className="pct"> = </span><span className="str">"420x520"</span><span className="cmt"> // 3-player workspace</span></span>, 1)}

                        {L(<></>)}
                        {L(
                            <span style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-primary" onClick={handleCreate} disabled={creating} style={{ fontSize: '12px' }}>
                                    {creating ? 'creating...' : '▶ return createRoom()'}
                                </button>
                                <button className="btn-secondary" onClick={() => setShowCreate(false)} style={{ fontSize: '12px' }}>cancel</button>
                            </span>,
                            1,
                        )}
                        {L(<><span className="pct">{'}'}</span></>)}
                    </div>
                )}

                {/* ── Filler: websocket.ts ── */}
                <div className="code-block" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid #2a2a2a' }}>
                    {L(<></>)}
                    {L(<><span className="cmt">{'// hooks/useWebSocket.ts'}</span></>)}
                    {L(<><span className="kw">import </span><span className="pct">{'{ '}</span><span className="var">useEffect</span><span className="pct">{', '}</span><span className="var">useRef</span><span className="pct">{', '}</span><span className="var">useCallback</span><span className="pct">{' }'}</span><span className="kw"> from </span><span className="str">"react"</span></>)}
                    {L(<><span className="kw">import </span><span className="pct">{'{ '}</span><span className="var">Client</span><span className="pct">{' }'}</span><span className="kw"> from </span><span className="str">"@stomp/stompjs"</span></>)}
                    {L(<><span className="kw">import </span><span className="typ">SockJS</span><span className="kw"> from </span><span className="str">"sockjs-client"</span></>)}
                    {L(<></>)}
                    {L(<><span className="kw">type </span><span className="typ">MoveType</span><span className="pct"> = </span><span className="str">"START_GAME"</span><span className="pct">{' | '}</span><span className="str">"LEAVE"</span><span className="pct">{' | '}</span><span className="str">"CHAT"</span><span className="pct">{' | '}</span><span className="str">"..."</span></>)}
                    {L(<></>)}
                    {L(<><span className="kw">export function </span><span className="fn">useWebSocket</span><span className="pct">{'({ roomId, onState }) {'}</span></>)}
                    {L(<><span className="kw">const </span><span className="var">clientRef</span><span className="pct"> = </span><span className="fn">useRef</span><span className="pct">{'<Client | null>(null)'}</span></>, 1)}
                    {L(<><span className="kw">const </span><span className="pct">{'['}</span><span className="var">connected</span><span className="pct">{', '}</span><span className="var">setConnected</span><span className="pct">{'] = '}</span><span className="fn">useState</span><span className="pct">{'(false)'}</span></>, 1)}
                    {L(<></>)}
                    {L(<><span className="fn">useEffect</span><span className="pct">{'(() => {'}</span></>, 1)}
                    {L(<><span className="kw">const </span><span className="var">c</span><span className="pct"> = </span><span className="kw">new </span><span className="typ">Client</span><span className="pct">{'({'}</span></>, 2)}
                    {L(<><span className="var">webSocketFactory</span><span className="pct">: () =&gt; </span><span className="kw">new </span><span className="typ">SockJS</span><span className="pct">{'("/ws")'}</span></>, 3)}
                    {L(<><span className="var">reconnectDelay</span><span className="pct">: </span><span className="num">5000</span></>, 3)}
                    {L(<><span className="var">onConnect</span><span className="pct">{': () => { setConnected(true) }'}</span></>, 3)}
                    {L(<><span className="pct">{'}'}</span><span className="pct">{')'}</span></>, 2)}
                    {L(<><span className="var">c</span><span className="pct">{'.'}</span><span className="fn">activate</span><span className="pct">{'()'}</span></>, 2)}
                    {L(<><span className="var">clientRef</span><span className="pct">{'.'}</span><span className="var">current</span><span className="pct"> = </span><span className="var">c</span></>, 2)}
                    {L(<><span className="kw">return </span><span className="pct">{'() => c.'}</span><span className="fn">deactivate</span><span className="pct">{'()'}</span></>, 2)}
                    {L(<><span className="pct">{'}, [roomId])'}</span></>, 1)}
                    {L(<></>)}
                    {L(<><span className="kw">const </span><span className="fn">sendMove</span><span className="pct"> = </span><span className="fn">useCallback</span><span className="pct">{'((move) => {'}</span></>, 1)}
                    {L(<><span className="var">clientRef</span><span className="pct">{'.'}</span><span className="var">current</span><span className="pct">{'?.publish({ destination: "/app/move", body: JSON.stringify(move) })'}</span></>, 2)}
                    {L(<><span className="pct">{'}, [])'}</span></>, 1)}
                    {L(<></>)}
                    {L(<><span className="kw">return </span><span className="pct">{'{ '}</span><span className="var">connected</span><span className="pct">{', '}</span><span className="fn">sendMove</span><span className="pct">{' }'}</span></>, 1)}
                    {L(<><span className="pct">{'}'}</span></>)}
                    {L(<></>)}
                </div>

            </div>
        </div>
    );
}

export default Lobby;
