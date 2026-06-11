import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, StudyType, StudyStateResponse, ChatMessage, JoinRoomRequest, ChatAttachment } from './types';
import Lobby from './components/Lobby';
import StudyRoom from './components/StudyRoom';
import PuyoPuyo from './components/games/PuyoPuyo';
import Sudoku from './components/games/Sudoku';
import Chat from './components/Chat';
import { useLobbyChat } from './hooks/useLobbyChat';

const PLAYER_AVATARS: { id: string; src: string | null; label: string }[] = [
    { id: 'ch1', src: '/src/assets/images/ch1.png', label: '😀' },
    { id: 'ch2', src: '/src/assets/images/ch2.png', label: '😁' },
    { id: 'ch3', src: '/src/assets/images/ch3.png', label: '👻' },
    { id: 'pig', src: '/src/assets/images/dalbit.png', label: '🐷' },
    { id: 'ggobuk', src: '/src/assets/images/ggobuk.png', label: '🐢' },
    { id: 'ch4', src: '/src/assets/images/ch4.png', label: '👽' },
    { id: 'ch5', src: '/src/assets/images/ch5.png', label: '🎉' },
    { id: 'ch6', src: '/src/assets/images/ch6.png', label: '😊' },
    { id: 'ch7', src: '/src/assets/images/ch7.png', label: '💖' },
];

const GAME_ICONS: Partial<Record<StudyType, string>> = {
    BASEBALL: '⚾',
    BINGO: '📝',
    OMOK: '⬛',
    TETRIS: '🟦',
    OLDMAID: '🃏',
};
const GAME_EXT: Record<StudyType, string> = {
    BASEBALL: '.bs',
    BINGO: '.bg',
    OMOK: '.omok',
    TETRIS: '.tetris',
    OLDMAID: '.cards',
    INCIDENT_AVOID: '.risk',
    BREAKOUT: '.flow',
};

function App() {
    // ── 기본 상태 ──────────────────────────────────────────────────────────────
    const [nickname, setNicknameState] = useState(() => localStorage.getItem('study.nickname') ?? '');
    const [emoji, setEmojiState] = useState(() => localStorage.getItem('study.emoji') ?? '🐱');
    const [sessionId, setSessionId] = useState('');
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const leaveRef = useRef<(() => void) | null>(null);
    const [studyState, setStudyState] = useState<StudyStateResponse | null>(null);

    // ── 로비 채팅 ──────────────────────────────────────────────────────────────
    const [lobbyMessages, setLobbyMessages] = useState<ChatMessage[]>([]);
    const handleLobbyMessage = useCallback((msg: ChatMessage) => {
        setLobbyMessages((prev) => [...prev, msg]);
    }, []);
    const { sendChat: sendLobbyChat } = useLobbyChat({ onMessage: handleLobbyMessage });
    const handleLobbyChatSend = useCallback(
        (text: string, _sid: string, attachment?: ChatAttachment) => {
            sendLobbyChat(text, nickname, emoji, sessionId, attachment);
        },
        [sendLobbyChat, nickname, emoji, sessionId],
    );

    // ── 로비 채팅 창 너비 ──────────────────────────────────────────────────────────────
    const [chatWidth, setChatWidth] = useState(() => Math.max(240, Math.min(500, parseInt(localStorage.getItem('study.chatWidth') ?? '240', 10))));

    // ── 뿌요뿌요 / 스도쿠 ─────────────────────────────────────────────────────
    const [showPuyo, setShowPuyo] = useState(false);
    const [showSudoku, setShowSudoku] = useState(false);

    // ── 사이드바 상태 ──────────────────────────────────────────────────────────
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(false);
    const [lobbyError, setLobbyError] = useState('');
    const [profileEditing, setProfileEditing] = useState(() => !localStorage.getItem('study.nickname'));
    const [draftNickname, setDraftNickname] = useState(() => localStorage.getItem('study.nickname') ?? '');
    const [draftEmoji, setDraftEmoji] = useState(() => localStorage.getItem('study.emoji') ?? '🐱');
    const [userExpanded, setUserExpanded] = useState(true);
    const [roomsExpanded, setRoomsExpanded] = useState(true);
    const [activePanel, setActivePanel] = useState<'explorer' | 'profile'>('explorer');
    const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);


    // ── 터미널 상태 ────────────────────────────────────────────────────────────
    const [termOpen, setTermOpen] = useState(true);
    const [termHeight, setTermHeight] = useState(160);
    const [termInput, setTermInput] = useState('');
    const [termHistory, setTermHistory] = useState<{ type: 'cmd' | 'out' | 'err'; text: string }[]>([
        { type: 'out', text: 'Initialized empty Git repository in /study-platform/.git/' },
        { type: 'cmd', text: 'git status' },
        { type: 'out', text: 'On branch main' },
        { type: 'out', text: "Your branch is up to date with 'origin/main'." },
        { type: 'out', text: '' },
        { type: 'out', text: 'nothing to commit, working tree clean' },
        { type: 'cmd', text: 'npm run dev' },
        { type: 'out', text: '' },
        { type: 'out', text: '  VITE v5.4.0  ready in 312 ms' },
        { type: 'out', text: '' },
        { type: 'out', text: '  ➜  Local:   http://localhost:8000/' },
        { type: 'out', text: '  ➜  Network: http://192.168.0.124:8000/' },
    ]);
    const termRef = useRef<HTMLDivElement | null>(null);

    // ── 유틸 함수 ──────────────────────────────────────────────────────────────

    const handleTermCmd = (cmd: string) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;
        setTermHistory((prev) => {
            const next = [...prev, { type: 'cmd' as const, text: trimmed }];
            if (trimmed === 'clear' || trimmed === 'cls') return [];
            if (trimmed === 'git status') {
                next.push({ type: 'out', text: 'On branch main — nothing to commit, working tree clean' });
            } else if (trimmed === 'git log --oneline') {
                next.push({ type: 'out', text: 'a3f91c2 fix: OldMaid black screen on discard' });
                next.push({ type: 'out', text: '8b2e104 feat: global lobby chat' });
                next.push({ type: 'out', text: 'd19a3f7 feat: OldMaid end-turn button' });
                next.push({ type: 'out', text: 'c84120a init: study-platform scaffold' });
            } else if (trimmed === 'git branch') {
                next.push({ type: 'out', text: '* main' });
                next.push({ type: 'out', text: '  dev' });
            } else if (trimmed === 'ls' || trimmed === 'ls -la') {
                next.push({ type: 'out', text: 'drwxr-xr-x  study-client/' });
                next.push({ type: 'out', text: 'drwxr-xr-x  study-server/' });
                next.push({ type: 'out', text: '-rw-r--r--  README.md' });
                next.push({ type: 'out', text: '-rw-r--r--  .gitignore' });
            } else if (trimmed === 'help') {
                next.push({ type: 'out', text: 'Available: git status, git log --oneline, git branch, ls, clear' });
            } else {
                next.push({ type: 'err', text: `bash: ${trimmed}: command not found` });
            }
            return next;
        });
        setTermInput('');
        setTimeout(() => {
            if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
        }, 30);
    };

    // ── 초기화 ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        let id = sessionStorage.getItem('sessionId');
        if (!id) {
            id =
                typeof crypto.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : Math.random().toString(36).slice(2) + Date.now().toString(36);
            sessionStorage.setItem('sessionId', id);
        }
        setSessionId(id);
    }, []);

    // ── 방 목록 ────────────────────────────────────────────────────────────────
    const fetchRooms = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/rooms');
            if (!res.ok) throw new Error();
            setRooms(await res.json());
            setLobbyError('');
        } catch {
            setLobbyError('Failed to fetch rooms.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRooms();
        const t = setInterval(fetchRooms, 5000);
        return () => clearInterval(t);
    }, [fetchRooms]);

    // ── 프로필 ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!profileEditing) {
            setDraftNickname(nickname);
            setDraftEmoji(emoji);
        }
    }, [emoji, nickname, profileEditing]);

    const handleNicknameChange = useCallback((name: string) => {
        setNicknameState(name);
        localStorage.setItem('study.nickname', name);
    }, []);

    const handleEmojiChange = useCallback((nextEmoji: string) => {
        setEmojiState(nextEmoji);
        localStorage.setItem('study.emoji', nextEmoji);
    }, []);

    const saveProfile = () => {
        const nextName = draftNickname.trim();
        if (!nextName) { setLobbyError('Nickname is required.'); return; }
        handleNicknameChange(nextName);
        handleEmojiChange(draftEmoji);
        setProfileEditing(false);
        setLobbyError('');
    };

    const cancelProfileEdit = () => {
        setDraftNickname(nickname);
        setDraftEmoji(emoji);
        setProfileEditing(!nickname.trim());
        setLobbyError('');
    };

    // ── 방 입/퇴장 ─────────────────────────────────────────────────────────────
    const handleJoinRoom = useCallback((room: Room) => {
        setCurrentRoom(room);
        setStudyState(null);
    }, []);

    const handleLeaveRoom = useCallback(() => {
        setCurrentRoom(null);
        setStudyState(null);
    }, []);

    const handleStudyState = useCallback((s: StudyStateResponse) => {
        setStudyState(s);
    }, []);

    const handleJoin = useCallback(
        async (roomId: string) => {
            if (profileEditing) { setLobbyError('Save your profile first.'); return; }
            if (!nickname.trim()) { setLobbyError('Enter a nickname first.'); return; }
            try {
                const body: JoinRoomRequest = { nickname: nickname.trim(), sessionId };
                const res = await fetch(`/api/rooms/${roomId}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) throw new Error(await res.text());
                handleJoinRoom(await res.json());
            } catch (e: unknown) {
                setLobbyError(e instanceof Error ? e.message : 'Failed to join room.');
            }
        },
        [profileEditing, nickname, sessionId, handleJoinRoom],
    );

    // ── 탭 라벨 ────────────────────────────────────────────────────────────────
    const tabLabel = showPuyo && !currentRoom
        ? 'puyo_puyo.ts'
        : showSudoku && !currentRoom
        ? 'sudoku.ts'
        : currentRoom
        ? `${currentRoom.roomName}.${
              currentRoom.studyType === 'BASEBALL'
                  ? 'bs'
                  : currentRoom.studyType === 'OMOK'
                    ? 'omok'
                    : currentRoom.studyType === 'TETRIS'
                      ? 'tetris'
                      : currentRoom.studyType === 'OLDMAID'
                        ? 'cards'
                        : currentRoom.studyType === 'INCIDENT_AVOID'
                          ? 'risk'
                          : currentRoom.studyType === 'BREAKOUT'
                            ? 'flow'
                            : 'bg'
          }`
        : 'lobby.ts';

    const currentAvatar = PLAYER_AVATARS.find((a) => a.id === (profileEditing ? draftEmoji : emoji));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

            {/* ── VS Code 타이틀 바 ───────────────────────────────────────── */}
            <div style={{ background: '#323233', borderBottom: '1px solid #3e3e42', padding: '2px 12px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '32px', flexShrink: 0, position: 'relative' }}>
                <ul style={{ display: 'flex', gap: '14px', listStyle: 'none', margin: 0, padding: 0 }}>
                    {['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'].map((m) => (
                        <li key={m} style={{ color: '#888', fontSize: '12px' }}>{m}</li>
                    ))}
                </ul>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                    <ul style={{ display: 'flex', gap: '4px', listStyle: 'none', margin: 0, padding: 0 }}>
                        <li style={{ color: '#888', fontSize: '12px' }}>←</li>
                        <div style={{ marginLeft: '10px' }}></div>
                        <li style={{ color: '#888', fontSize: '12px' }}>→</li>
                    </ul>
                    <div style={{ background: '#3f3f3f', color: '#888', fontSize: '12px', padding: '3px 8px', width: '500px', borderRadius: '6px' }}>study-platform</div>
                </div>
                <ul style={{ display: 'flex', gap: '30px', listStyle: 'none', margin: 0, padding: 0, fontSize: '14px', color: '#888' }}>
                    <li style={{ width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ background: '#888', width: '16px', display: 'block', height: '2px', borderRadius: '2px' }}></span>
                    </li>
                    <li style={{ width: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg style={{ fill: '#888' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M544 144L256 144C247.2 144 240 151.2 240 160L240 176L192 176L192 160C192 124.7 220.7 96 256 96L544 96C579.3 96 608 124.7 608 160L608 352C608 387.3 579.3 416 544 416L496 416L496 368L544 368C552.8 368 560 360.8 560 352L560 160C560 151.2 552.8 144 544 144zM400 352L80 352L80 480C80 488.8 87.2 496 96 496L384 496C392.8 496 400 488.8 400 480L400 352zM96 224L384 224C419.3 224 448 252.7 448 288L448 480C448 515.3 419.3 544 384 544L96 544C60.7 544 32 515.3 32 480L32 288C32 252.7 60.7 224 96 224z" /></svg>
                    </li>
                    <li style={{ width: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg style={{ fill: '#888' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z" /></svg>
                    </li>
                </ul>
            </div>

            {/* ── 메인 영역 ──────────────────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

                {/* ── ACTIVITY BAR ── */}
                <div style={{ width: '36px', flexShrink: 0, background: '#333333', borderRight: '1px solid #252526', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '6px', gap: '15px', marginBottom: '5px' }}>
                    {(['explorer', 'profile'] as const).map((panel) => (
                        <div
                            key={panel}
                            title={panel === 'explorer' ? 'Explorer' : 'Profile'}
                            onClick={() => { setActivePanel(panel); setShowPuyo(false); }}
                            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', borderRadius: '4px', background: activePanel === panel && !showPuyo ? 'rgba(255,255,255,0.08)' : 'transparent', borderLeft: activePanel === panel && !showPuyo ? '2px solid #ccc' : '2px solid transparent', opacity: activePanel === panel && !showPuyo ? 1 : 0.45, transition: 'all 0.12s' }}
                        >
                            {panel === 'explorer' ? <img src="/src/assets/images/side_icon1.png" style={{ width: 18, }} /> : <img src="/src/assets/images/side_icon2.png" style={{ width: 18,  }} />}
                        </div>
                    ))}
                    <ul style={{ width: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px', listStyle: 'none', margin: 0, padding: 0 }}>
                        <li style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><img src="/src/assets/images/side_icon3.png" style={{ width: 18,  }} /></li>
                        <li style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><img src="/src/assets/images/side_icon4.png" style={{ width: 18,  }} /></li>
                        <li style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><img src="/src/assets/images/side_icon5.png" style={{ width: 18,  }} /></li>
                        <li style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><img src="/src/assets/images/side_icon6.png" style={{ width: 18,  }} /></li>
                    </ul>
                    
                    {/* 게임 버튼 */}
                    {currentRoom === null && (
                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                            <div title="Puyo Puyo"
                                onClick={() => { setShowPuyo(v => !v); setShowSudoku(false); }}
                                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', cursor: 'pointer', borderRadius: '4px', background: showPuyo ? 'rgba(255,255,255,0.08)' : 'transparent', borderLeft: showPuyo ? '2px solid #ccc' : '2px solid transparent', opacity: showPuyo ? 1 : 0.45, transition: 'all 0.12s' }}>
                                🩵
                            </div>
                            <div title="Sudoku"
                                onClick={() => { setShowSudoku(v => !v); setShowPuyo(false); }}
                                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', cursor: 'pointer', borderRadius: '4px', background: showSudoku ? 'rgba(255,255,255,0.08)' : 'transparent', borderLeft: showSudoku ? '2px solid #ccc' : '2px solid transparent', opacity: showSudoku ? 1 : 0.45, transition: 'all 0.12s' }}>
                                🔢
                            </div>
                        </div>
                    )}
                </div>

                {/* ── SIDEBAR ── */}
                <div style={{ width: '240px', flexShrink: 0, background: '#252526', borderRight: '1px solid #3e3e42', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#bbb', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 14px 5px', flexShrink: 0 }}>
                        {activePanel === 'explorer' ? 'Explorer' : 'Profile'}
                    </div>

                    {/* EXPLORER */}
                    {activePanel === 'explorer' && (
                        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                            {/* USER */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', fontSize: '11px', color: '#bbb', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => setUserExpanded((v) => !v)}>
                                <span style={{ fontSize: '9px', color: '#666', display: 'inline-block', transition: 'transform 0.15s', transform: userExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                                <span>USER</span>
                            </div>
                            {userExpanded && (
                                <div style={{ padding: '2px 0 8px', flexShrink: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 14px 3px 22px', fontSize: '12px' }}>
                                        {currentAvatar?.src
                                            ? <img src={currentAvatar.src} style={{ width: 14, height: 14, objectFit: 'contain' }} />
                                            : <span style={{ fontSize: '14px' }}>{currentAvatar?.label ?? '🐱'}</span>
                                        }
                                        <span style={{ color: nickname.trim() ? '#4ec9b0' : '#858585' }}>{nickname.trim() || 'not set'}</span>
                                        {nickname.trim() && <span style={{ color: '#6a9955', fontSize: '10px' }}>✓</span>}
                                    </div>
                                    <div style={{ padding: '2px 14px 2px 28px', fontSize: '11px', color: '#569cd6', cursor: 'pointer' }}
                                        onClick={() => { setActivePanel('profile'); setProfileEditing(true); }}>
                                        {profileEditing ? <span style={{ color: '#ce9178' }}>● editing...</span> : '✎ editProfile()'}
                                    </div>
                                </div>
                            )}

                            {/* ROOMS */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', fontSize: '11px', color: '#bbb', cursor: 'pointer', userSelect: 'none', borderTop: '1px solid #3e3e42' }}
                                onClick={() => setRoomsExpanded((v) => !v)}>
                                <span style={{ fontSize: '9px', color: '#666', display: 'inline-block', transition: 'transform 0.15s', transform: roomsExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                                <span>ROOMS</span>
                                <span style={{ marginLeft: 'auto', color: loading ? '#569cd6' : '#555', fontSize: '10px' }}>{loading ? '↻' : rooms.length}</span>
                            </div>
                            {roomsExpanded && (
                                <>
                                    <div style={{ flex: 1, overflow: 'auto', minHeight: '40px' }}>
                                        {rooms.length === 0 && <div style={{ padding: '4px 14px 4px 24px', fontSize: '11px', color: '#555' }}>// no rooms yet</div>}
                                        {rooms.map((room) => (
                                            <div key={room.roomId}
                                                style={{ display: 'flex', alignItems: 'center', padding: '3px 8px 3px 22px', fontSize: '12px', background: hoveredRoom === room.roomId ? 'rgba(255,255,255,0.06)' : 'transparent', cursor: 'pointer', gap: '5px' }}
                                                onMouseEnter={() => setHoveredRoom(room.roomId)}
                                                onMouseLeave={() => setHoveredRoom(null)}
                                                onClick={() => handleJoin(room.roomId)}
                                            >
                                                <span style={{ fontSize: '11px', flexShrink: 0 }}>{GAME_ICONS[room.studyType] ?? '!'}</span>
                                                <span style={{ color: '#d4d4d4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.roomName}</span>
                                                <span style={{ color: '#ce9178', fontSize: '10px', flexShrink: 0 }}>{GAME_EXT[room.studyType]}</span>
                                                <span style={{ color: '#858585', fontSize: '10px', flexShrink: 0 }}>{room.playerCount}/{room.maxPlayers}</span>
                                                {hoveredRoom === room.roomId && (
                                                    <button className="btn-primary" style={{ fontSize: '9px', padding: '1px 5px', flexShrink: 0 }}
                                                        onClick={(e) => { e.stopPropagation(); handleJoin(room.roomId); }}>join</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', padding: '5px 8px', borderTop: '1px solid #3e3e42', flexShrink: 0 }}>
                                        <button className="btn-secondary" style={{ fontSize: '10px', padding: '2px 8px' }} onClick={fetchRooms} disabled={loading}>{loading ? '…' : '↺'}</button>
                                    </div>
                                </>
                            )}

                        </div>
                    )}

                    {/* PROFILE */}
                    {activePanel === 'profile' && (
                        <div style={{ flex: 1, overflow: 'auto', padding: '0 0 8px' }}>
                            <div style={{ padding: '4px 12px', fontSize: '10px', color: '#6a9955' }}>// select avatar</div>
                            <div style={{ padding: '0 10px 8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                {PLAYER_AVATARS.map((a) => {
                                    const isSel = draftEmoji === a.id;
                                    return (
                                        <div key={a.id} onClick={() => profileEditing && setDraftEmoji(a.id)}
                                            style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSel ? 'rgba(14,99,156,0.5)' : 'rgba(255,255,255,0.03)', border: isSel ? '1px solid #0e639c' : '1px solid #3e3e42', borderRadius: '3px', cursor: profileEditing ? 'pointer' : 'default', opacity: isSel ? 1 : 0.55, transition: 'all 0.12s', position: 'relative' }}>
                                            {a.src
                                                ? <img src={a.src} alt={a.label} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                                : <span style={{ fontSize: '24px', lineHeight: '1' }}>{a.label}</span>
                                            }
                                            {isSel && <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, background: '#4ec9b0', border: '1px solid #1e1e1e', borderRadius: '50%' }} />}
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ padding: '4px 12px', fontSize: '10px', color: '#6a9955', borderTop: '1px solid #3e3e42' }}>// nickname</div>
                            <div style={{ padding: '2px 10px 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {currentAvatar?.src
                                    ? <img src={currentAvatar.src} style={{ width: 14, height: 14, objectFit: 'contain' }} />
                                    : <span style={{ fontSize: '14px' }}>{currentAvatar?.label}</span>
                                }
                                <input
                                    style={{ flex: 1, fontSize: '12px', padding: '3px 6px', border: nickname.trim() ? '1px solid #4ec9b0' : '1px solid #3e3e42', outline: 'none', background: '#1e1e1e', color: '#d4d4d4' }}
                                    placeholder="nickname" value={draftNickname} onChange={(e) => setDraftNickname(e.target.value)}
                                    disabled={!profileEditing} maxLength={12} onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
                                />
                            </div>
                            <div style={{ padding: '0 10px 6px', display: 'flex', gap: '4px' }}>
                                {profileEditing ? (
                                    <>
                                        <button className="btn-primary" style={{ flex: 1, fontSize: '11px', padding: '3px 0' }} onClick={saveProfile}>save()</button>
                                        <button className="btn-secondary" style={{ flex: 1, fontSize: '11px', padding: '3px 0' }} onClick={cancelProfileEdit}>cancel</button>
                                    </>
                                ) : (
                                    <button className="btn-secondary" style={{ flex: 1, fontSize: '11px', padding: '3px 0' }} onClick={() => setProfileEditing(true)}>✎ edit</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 에디터 + 터미널 컬럼 ──────────────────────────────── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1e1e1e', minWidth: 0 }}>

                    {/* 탭 바 (사이드바 헤더와 같은 높이) */}
                    <div className="tab-bar" style={{ flexShrink: 0 }}>
                        <div className="tab active">
                            <span style={{ color: '#569cd6', fontSize: '11px' }}>▶</span>
                            <span>{tabLabel}</span>
                            {currentRoom && (
                                <span className="tab-close" onClick={() => (leaveRef.current ? leaveRef.current() : handleLeaveRoom())}>✕</span>
                            )}
                        </div>
                        <div className="tab" style={{ color: '#555', fontSize: '11px', padding: '8px 10px' }}>
                            {currentRoom ? 'lobby.ts' : ''}
                        </div>
                    </div>

                    {/* 콘텐츠 영역 */}
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        {currentRoom === null && showPuyo ? (
                            <PuyoPuyo onClose={() => setShowPuyo(false)} />
                        ) : currentRoom === null && showSudoku ? (
                            <Sudoku onClose={() => setShowSudoku(false)} />
                        ) : currentRoom === null ? (
                            <Lobby
                                nickname={nickname}
                                emoji={emoji}
                                sessionId={sessionId}
                                onNicknameChange={handleNicknameChange}
                                onEmojiChange={handleEmojiChange}
                                onJoinRoom={handleJoinRoom}
                                rooms={rooms}
                                loading={loading}
                                fetchRooms={fetchRooms}
                                profileEditing={profileEditing}
                                onJoin={handleJoin}
                                lobbyError={lobbyError}
                                onClearLobbyError={() => setLobbyError('')}
                            />
                        ) : (
                            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
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
                            </div>
                        )}
                    </div>

                    {/* 터미널 패널 */}
                    {termOpen && (
                        <div style={{ height: termHeight, flexShrink: 0, borderTop: '1px solid #3e3e42', background: '#1e1e1e', display: 'flex', flexDirection: 'column', fontFamily: "'Consolas','Courier New',monospace" }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: '#252526', borderBottom: '1px solid #3e3e42', flexShrink: 0, height: '26px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '100%', background: '#1e1e1e', borderRight: '1px solid #3e3e42', fontSize: '11px', color: '#ccc' }}>
                                    <span style={{ color: '#6a9955', fontSize: '11px' }}>⬤</span>
                                    <span>TERMINAL</span>
                                    <span style={{ color: '#858585', fontSize: '10px' }}>bash</span>
                                </div>
                                <div style={{ flex: 1, cursor: 'ns-resize', height: '100%' }}
                                    onMouseDown={(e) => {
                                        const startY = e.clientY;
                                        const startH = termHeight;
                                        const onMove = (ev: MouseEvent) => { setTermHeight(Math.max(80, Math.min(400, startH + (startY - ev.clientY)))); };
                                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                                        window.addEventListener('mousemove', onMove);
                                        window.addEventListener('mouseup', onUp);
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '2px', paddingRight: '8px' }}>
                                    <span style={{ fontSize: '14px', color: '#555', cursor: 'pointer', padding: '0 4px', lineHeight: '1' }} title="Close terminal" onClick={() => setTermOpen(false)}>✕</span>
                                </div>
                            </div>
                            <div ref={termRef} style={{ flex: 1, overflow: 'auto', padding: '6px 12px 2px', fontSize: '12px', lineHeight: '1.5' }}>
                                {termHistory.map((line, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '6px' }}>
                                        {line.type === 'cmd' && (
                                            <>
                                                <span style={{ color: '#00d48e', userSelect: 'none' }}>
                                                    PC024@STUDY-PLATFORM <span style={{ color: '#ff63ff' }}>MINGW64</span>{' '}
                                                    <span style={{ color: '#f1ff2f' }}>~/study-platform</span>
                                                </span>
                                                <span style={{ color: '#49cbff' }}>(main)</span>
                                                <span style={{ color: '#d4d4d4' }}>{line.text}</span>
                                            </>
                                        )}
                                        {line.type === 'out' && <span style={{ color: '#d4d4d4', paddingLeft: '2px' }}>{line.text || ' '}</span>}
                                        {line.type === 'err' && <span style={{ color: '#f44747', paddingLeft: '2px' }}>{line.text}</span>}
                                    </div>
                                ))}
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                    <span style={{ color: '#00d48e', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        PC024@STUDY-PLATFORM <span style={{ color: '#ff63ff' }}>MINGW64</span>{' '}
                                        <span style={{ color: '#f1ff2f' }}>~/study-platform</span>
                                    </span>
                                    <span style={{ color: '#49cbff' }}>(main)</span>
                                    <input
                                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#d4d4d4', fontSize: '12px', fontFamily: 'inherit', caretColor: '#d4d4d4' }}
                                        value={termInput}
                                        onChange={(e) => setTermInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleTermCmd(termInput); }}
                                        placeholder="" spellCheck={false} autoComplete="off"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {!termOpen && (
                        <div style={{ flexShrink: 0, borderTop: '1px solid #3e3e42', background: '#252526', padding: '3px 12px', fontSize: '11px', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => setTermOpen(true)}>
                            <span style={{ color: '#6a9955' }}>⬤</span> TERMINAL
                        </div>
                    )}
                </div>

                {/* ── 전역 채팅 패널 ──────────────────────────────────── */}
                <div style={{ width: chatWidth, flexShrink: 0, borderLeft: '1px solid #3e3e42', position: 'relative', display: 'flex' }}>
                    <div
                        style={{ width: '4px', flexShrink: 0, cursor: 'ew-resize', position: 'absolute', left: -2, top: 0, bottom: 0, zIndex: 2 }}
                        onMouseDown={(e) => {
                            const startX = e.clientX;
                            const startW = chatWidth;
                            const onMove = (ev: MouseEvent) => {
                                const next = Math.max(240, Math.min(500, startW - (ev.clientX - startX)));
                                setChatWidth(next);
                                localStorage.setItem('study.chatWidth', String(next));
                            };
                            const onUp = () => {
                                window.removeEventListener('mousemove', onMove);
                                window.removeEventListener('mouseup', onUp);
                            };
                            window.addEventListener('mousemove', onMove);
                            window.addEventListener('mouseup', onUp);
                        }}
                    />
                    {!nickname.trim() && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(30,30,30,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#858585', fontFamily: 'monospace', pointerEvents: 'none' }}>
                            <span style={{ color: '#569cd6' }}>// 채팅하려면</span>
                            <span>닉네임을 먼저 입력해주세요</span>
                        </div>
                    )}
                    <Chat messages={lobbyMessages} myNickname={nickname} myEmoji={emoji} sessionId={sessionId} onSend={nickname.trim() ? handleLobbyChatSend : () => {}} />
                </div>

            </div>

            {/* ── VS Code 상태 바 ─────────────────────────────────────── */}
            <div className="status-bar" style={{ flexShrink: 0 }}>
                <span>⚡ study-platform</span>
                <span style={{ opacity: 0.7 }}>TypeScript</span>
                {currentRoom && (
                    <span style={{ opacity: 0.7 }}>
                        {currentRoom.studyType === 'BASEBALL'
                            ? `⚾ Baseball · ${currentRoom.digits}-digit`
                            : currentRoom.studyType === 'OMOK'
                              ? `OMOK · ${currentRoom.boardSize}×${currentRoom.boardSize}`
                              : currentRoom.studyType === 'TETRIS'
                                ? 'TETRIS · 20×10'
                                : currentRoom.studyType === 'BREAKOUT'
                                  ? 'BREAKOUT - 420x520'
                                  : currentRoom.studyType === 'INCIDENT_AVOID'
                                    ? 'INCIDENT_AVOID - 360x520'
                                    : currentRoom.studyType === 'OLDMAID'
                                      ? '🃏 Old Maid'
                                      : `◻ Bingo · ${currentRoom.boardSize}×${currentRoom.boardSize}`}
                    </span>
                )}
                <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
                    {currentRoom
                        ? `${currentRoom.playerCount}/${currentRoom.studyType === 'TETRIS' || currentRoom.studyType === 'INCIDENT_AVOID' || currentRoom.studyType === 'BREAKOUT' ? 3 : currentRoom.maxPlayers} players`
                        : 'Lobby'}
                </span>
            </div>
        </div>
    );
}

export default App;
