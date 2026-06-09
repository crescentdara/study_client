import { useState, useEffect } from 'react';
import { Room, StudyType, CreateRoomRequest, JoinRoomRequest } from '../types';

const PLAYER_AVATARS: { id: string; src: string | null; label: string }[] = [
    { id: '🐱', src: null, label: '🐱' },
    { id: '🐶', src: null, label: '🐶' },
    { id: '🦊', src: null, label: '🦊' },
    { id: '🐼', src: null, label: '🐼' },
    { id: '🐨', src: null, label: '🐨' },
    { id: '💀', src: null, label: '💀' },
    { id: 'ch1', src: '/src/assets/images/ch1.png', label: '😀' },
    { id: 'ch2', src: '/src/assets/images/ch2.png', label: '😁' },
    { id: 'ch3', src: '/src/assets/images/ch3.png', label: '👻' },
    { id: 'ch4', src: '/src/assets/images/ch4.png', label: '👽' },
    { id: 'pig', src: '/src/assets/images/dalbit.png', label: '🐷' },
    { id: 'ggobuk', src: '/src/assets/images/ggobuk.png', label: '🐢' },
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
};

interface LobbyProps {
    nickname: string;
    emoji: string;
    sessionId: string;
    onNicknameChange: (name: string) => void;
    onEmojiChange: (emoji: string) => void;
    onJoinRoom: (room: Room) => void;
}

function Lobby({ nickname, emoji, sessionId, onNicknameChange, onEmojiChange, onJoinRoom }: LobbyProps) {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [studyType, setStudyType] = useState<StudyType>('BASEBALL');
    const [maxPlayers, setMaxPlayers] = useState(2);
    const [digits, setDigits] = useState(3);
    const [boardSize, setBoardSize] = useState(5);
    const [creating, setCreating] = useState(false);
    const [profileEditing, setProfileEditing] = useState(() => !nickname.trim());
    const [draftNickname, setDraftNickname] = useState(nickname);
    const [draftEmoji, setDraftEmoji] = useState(emoji);

    // Explorer sections
    const [userExpanded, setUserExpanded] = useState(true);
    const [roomsExpanded, setRoomsExpanded] = useState(true);
    const [ytExpanded] = useState(true);

    // Active sidebar panel
    const [activePanel, setActivePanel] = useState<'explorer' | 'profile'>('explorer');

    const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

    // Terminal
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
        { type: 'out', text: '  ➜  Network: http://192.168.0.x:8000/' },
    ]);

    const termRef = { current: null as HTMLDivElement | null };

    const handleTermCmd = (cmd: string) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;
        const next: { type: 'cmd' | 'out' | 'err'; text: string }[] = [...termHistory, { type: 'cmd', text: trimmed }];
        if (trimmed === 'clear' || trimmed === 'cls') {
            setTermHistory([]);
        } else if (trimmed === 'git status') {
            next.push({ type: 'out', text: 'On branch main — nothing to commit, working tree clean' });
            setTermHistory(next);
        } else if (trimmed === 'git log --oneline') {
            next.push({ type: 'out', text: 'a3f91c2 fix: OldMaid black screen on discard' });
            next.push({ type: 'out', text: '8b2e104 feat: global lobby chat' });
            next.push({ type: 'out', text: 'd19a3f7 feat: OldMaid end-turn button' });
            next.push({ type: 'out', text: 'c84120a init: study-platform scaffold' });
            setTermHistory(next);
        } else if (trimmed === 'git branch') {
            next.push({ type: 'out', text: '* main' });
            next.push({ type: 'out', text: '  dev' });
            setTermHistory(next);
        } else if (trimmed === 'ls' || trimmed === 'ls -la') {
            next.push({ type: 'out', text: 'drwxr-xr-x  study-client/' });
            next.push({ type: 'out', text: 'drwxr-xr-x  study-server/' });
            next.push({ type: 'out', text: '-rw-r--r--  README.md' });
            next.push({ type: 'out', text: '-rw-r--r--  .gitignore' });
            setTermHistory(next);
        } else if (trimmed === 'help') {
            next.push({ type: 'out', text: 'Available: git status, git log --oneline, git branch, ls, clear' });
            setTermHistory(next);
        } else {
            next.push({ type: 'err', text: `bash: ${trimmed}: command not found` });
            setTermHistory(next);
        }
        setTermInput('');
        setTimeout(() => {
            if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
        }, 30);
    };

    // YouTube
    const [ytUrl, setYtUrl] = useState('');
    const [ytInput, setYtInput] = useState('');
    const [showPlayer, setShowPlayer] = useState(false);
    const [ytCollapsed, setYtCollapsed] = useState(false);

    const extractYtId = (url: string): string | null => {
        const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
        return m ? m[1] : null;
    };

    useEffect(() => {
        if (!profileEditing) {
            setDraftNickname(nickname);
            setDraftEmoji(emoji);
        }
    }, [emoji, nickname, profileEditing]);

    const saveProfile = () => {
        const nextName = draftNickname.trim();
        if (!nextName) {
            setError('Nickname is required.');
            return;
        }
        onNicknameChange(nextName);
        onEmojiChange(draftEmoji);
        setProfileEditing(false);
        setError('');
    };

    const cancelProfileEdit = () => {
        setDraftNickname(nickname);
        setDraftEmoji(emoji);
        setProfileEditing(!nickname.trim());
        setError('');
    };

    const fetchRooms = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/rooms');
            if (!res.ok) throw new Error();
            setRooms(await res.json());
            setError('');
        } catch {
            setError('Failed to fetch rooms.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
        const t = setInterval(fetchRooms, 5000);
        return () => clearInterval(t);
    }, []);

    const handleCreate = async () => {
        if (profileEditing) {
            setError('Save your profile first.');
            return;
        }
        if (!nickname.trim()) {
            setError('Enter a nickname first.');
            return;
        }
        if (!roomName.trim()) {
            setError('Room name is required.');
            return;
        }
        setCreating(true);
        try {
            const body: CreateRoomRequest = {
                roomName: roomName.trim(),
                studyType,
                nickname: nickname.trim(),
                sessionId,
                maxPlayers: studyType === 'TETRIS' || studyType === 'INCIDENT_AVOID' ? 3 : studyType === 'OMOK' ? 2 : maxPlayers,
                digits,
                boardSize:
                    studyType === 'TETRIS' || studyType === 'INCIDENT_AVOID'
                        ? 20
                        : studyType === 'OMOK'
                          ? 19
                          : studyType === 'OLDMAID'
                            ? 0
                            : boardSize,
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

    const handleJoin = async (roomId: string) => {
        if (profileEditing) {
            setError('Save your profile first.');
            return;
        }
        if (!nickname.trim()) {
            setError('Enter a nickname first.');
            return;
        }
        try {
            const body: JoinRoomRequest = { nickname: nickname.trim(), sessionId };
            const res = await fetch(`/api/rooms/${roomId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await res.text());
            onJoinRoom(await res.json());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to join room.');
        }
    };

    // Editor line number helper
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

    const currentAvatar = PLAYER_AVATARS.find((a) => a.id === (profileEditing ? draftEmoji : emoji));

    return (
        <div
            style={{
                display: 'flex',
                height: 'calc(100vh - 88px)',
                overflow: 'hidden',
                background: '#1e1e1e',
                fontFamily: "'Consolas','Courier New',monospace",
            }}
        >
            {/* ════════ ACTIVITY BAR ════════ */}
            <div
                style={{
                    width: '36px',
                    flexShrink: 0,
                    background: '#333333',
                    borderRight: '1px solid #252526',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingTop: '6px',
                    gap: '4px',
                }}
            >
                {(['explorer', 'profile'] as const).map((panel) => (
                    <div
                        key={panel}
                        title={panel === 'explorer' ? 'Explorer' : 'Profile'}
                        onClick={() => setActivePanel(panel)}
                        style={{
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            background: activePanel === panel ? 'rgba(255,255,255,0.08)' : 'transparent',
                            borderLeft: activePanel === panel ? '2px solid #ccc' : '2px solid transparent',
                            opacity: activePanel === panel ? 1 : 0.45,
                            transition: 'all 0.12s',
                        }}
                    >
                        {panel === 'explorer' ? '📁' : '👤'}
                    </div>
                ))}
            </div>

            {/* ════════ SIDEBAR ════════ */}
            <div
                style={{
                    width: '240px',
                    flexShrink: 0,
                    background: '#252526',
                    borderRight: '1px solid #3e3e42',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Sidebar title */}
                <div
                    style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#bbb',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '8px 14px 5px',
                        flexShrink: 0,
                    }}
                >
                    {activePanel === 'explorer' ? 'Explorer' : 'Profile'}
                </div>

                {/* ── EXPLORER PANEL ── */}
                {activePanel === 'explorer' && (
                    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                        {/* USER section */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 10px',
                                fontSize: '11px',
                                color: '#bbb',
                                cursor: 'pointer',
                                userSelect: 'none',
                            }}
                            onClick={() => setUserExpanded((v) => !v)}
                        >
                            <span
                                style={{
                                    fontSize: '9px',
                                    color: '#666',
                                    display: 'inline-block',
                                    transition: 'transform 0.15s',
                                    transform: userExpanded ? 'rotate(90deg)' : 'none',
                                }}
                            >
                                ▶
                            </span>
                            <span>USER</span>
                        </div>

                        {userExpanded && (
                            <div style={{ padding: '2px 0 8px', flexShrink: 0 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '3px 14px 3px 22px',
                                        fontSize: '12px',
                                    }}
                                >
                                    {currentAvatar?.src ? (
                                        <img
                                            src={currentAvatar.src}
                                            style={{ width: 14, height: 14, objectFit: 'contain' }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: '14px' }}>{currentAvatar?.label ?? '🐱'}</span>
                                    )}
                                    <span style={{ color: nickname.trim() ? '#4ec9b0' : '#858585' }}>
                                        {nickname.trim() || 'not set'}
                                    </span>
                                    {nickname.trim() && <span style={{ color: '#6a9955', fontSize: '10px' }}>✓</span>}
                                </div>
                                <div
                                    style={{
                                        padding: '2px 14px 2px 28px',
                                        fontSize: '11px',
                                        color: '#569cd6',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                        setActivePanel('profile');
                                        setProfileEditing(true);
                                    }}
                                >
                                    {profileEditing ? (
                                        <span style={{ color: '#ce9178' }}>● editing...</span>
                                    ) : (
                                        '✎ editProfile()'
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ROOMS section */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 10px',
                                fontSize: '11px',
                                color: '#bbb',
                                cursor: 'pointer',
                                userSelect: 'none',
                                borderTop: '1px solid #3e3e42',
                            }}
                            onClick={() => setRoomsExpanded((v) => !v)}
                        >
                            <span
                                style={{
                                    fontSize: '9px',
                                    color: '#666',
                                    display: 'inline-block',
                                    transition: 'transform 0.15s',
                                    transform: roomsExpanded ? 'rotate(90deg)' : 'none',
                                }}
                            >
                                ▶
                            </span>
                            <span>ROOMS</span>
                            <span style={{ marginLeft: 'auto', color: loading ? '#569cd6' : '#555', fontSize: '10px' }}>
                                {loading ? '↻' : rooms.length}
                            </span>
                        </div>

                        {roomsExpanded && (
                            <>
                                <div style={{ flex: 1, overflow: 'auto', minHeight: '40px' }}>
                                    {rooms.length === 0 && (
                                        <div style={{ padding: '4px 14px 4px 24px', fontSize: '11px', color: '#555' }}>
                                            // no rooms yet
                                        </div>
                                    )}
                                    {rooms.map((room) => (
                                        <div
                                            key={room.roomId}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '3px 8px 3px 22px',
                                                fontSize: '12px',
                                                background:
                                                    hoveredRoom === room.roomId
                                                        ? 'rgba(255,255,255,0.06)'
                                                        : 'transparent',
                                                cursor: 'pointer',
                                                gap: '5px',
                                            }}
                                            onMouseEnter={() => setHoveredRoom(room.roomId)}
                                            onMouseLeave={() => setHoveredRoom(null)}
                                            onClick={() => handleJoin(room.roomId)}
                                        >
                                            <span style={{ fontSize: '11px', flexShrink: 0 }}>
                                                {GAME_ICONS[room.studyType] ?? '!'}
                                            </span>
                                            <span
                                                style={{
                                                    color: '#d4d4d4',
                                                    flex: 1,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {room.roomName}
                                            </span>
                                            <span style={{ color: '#ce9178', fontSize: '10px', flexShrink: 0 }}>
                                                {GAME_EXT[room.studyType]}
                                            </span>
                                            <span style={{ color: '#858585', fontSize: '10px', flexShrink: 0 }}>
                                                {room.playerCount}/{room.maxPlayers}
                                            </span>
                                            {hoveredRoom === room.roomId && (
                                                <button
                                                    className="btn-primary"
                                                    style={{ fontSize: '9px', padding: '1px 5px', flexShrink: 0 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleJoin(room.roomId);
                                                    }}
                                                >
                                                    join
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* refresh / new room */}
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '4px',
                                        padding: '5px 8px',
                                        borderTop: '1px solid #3e3e42',
                                        flexShrink: 0,
                                    }}
                                >
                                    <button
                                        className="btn-secondary"
                                        style={{ fontSize: '10px', padding: '2px 8px' }}
                                        onClick={fetchRooms}
                                        disabled={loading}
                                    >
                                        {loading ? '…' : '↺'}
                                    </button>
                                    <button
                                        className={showCreate ? 'btn-primary' : 'btn-secondary'}
                                        style={{
                                            flex: 1,
                                            fontSize: '10px',
                                            padding: '2px 0',
                                            background: showCreate ? '#0e639c' : '#00ab77',
                                            color: '#fff',
                                        }}
                                        onClick={() => setShowCreate((v) => !v)}
                                    >
                                        {showCreate ? '✕ cancel' : '+ new room'}
                                    </button>
                                </div>
                            </>
                        )}
                        {ytExpanded && (
                            <div style={{ padding: '4px 8px 8px', flexShrink: 0 }}>
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                                    <input
                                        style={{ flex: 1, fontSize: '10px', padding: '2px 5px', minWidth: 0 }}
                                        placeholder="paste YouTube URL..."
                                        value={ytInput}
                                        onChange={(e) => setYtInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const id = extractYtId(ytInput);
                                                if (id) {
                                                    setYtUrl(id);
                                                    setShowPlayer(true);
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        className="btn-secondary"
                                        style={{ fontSize: '10px', padding: '2px 7px' }}
                                        onClick={() => {
                                            const id = extractYtId(ytInput);
                                            if (id) {
                                                setYtUrl(id);
                                                setShowPlayer(true);
                                            }
                                        }}
                                    >
                                        ▶
                                    </button>
                                    {showPlayer && (
                                        <>
                                            <button
                                                className="btn-secondary"
                                                style={{ fontSize: '10px', padding: '2px 6px' }}
                                                onClick={() => setYtCollapsed((c) => !c)}
                                            >
                                                {ytCollapsed ? '▼' : '▲'}
                                            </button>
                                            <button
                                                className="btn-secondary"
                                                style={{ fontSize: '10px', padding: '2px 5px', color: '#f44747' }}
                                                onClick={() => {
                                                    setShowPlayer(false);
                                                    setYtUrl('');
                                                    setYtInput('');
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </>
                                    )}
                                </div>
                                {showPlayer && ytUrl && (
                                    <div
                                        style={{
                                            overflow: 'hidden',
                                            height: ytCollapsed ? 0 : undefined,
                                            transition: 'height 0.2s',
                                            ...(ytCollapsed ? {} : { position: 'relative', paddingBottom: '56.25%' }),
                                        }}
                                    >
                                        <iframe
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: ytCollapsed ? 0 : '100%',
                                                border: 'none',
                                            }}
                                            src={`https://www.youtube.com/embed/${ytUrl}?autoplay=1`}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                                            allowFullScreen
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── PROFILE PANEL ── */}
                {activePanel === 'profile' && (
                    <div style={{ flex: 1, overflow: 'auto', padding: '0 0 8px' }}>
                        <div style={{ padding: '4px 12px', fontSize: '10px', color: '#6a9955' }}>// select avatar</div>
                        <div
                            style={{
                                padding: '0 10px 8px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '4px',
                            }}
                        >
                            {PLAYER_AVATARS.map((a) => {
                                const isSel = draftEmoji === a.id;
                                return (
                                    <div
                                        key={a.id}
                                        onClick={() => profileEditing && setDraftEmoji(a.id)}
                                        style={{
                                            height: '42px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: isSel ? 'rgba(14,99,156,0.5)' : 'rgba(255,255,255,0.03)',
                                            border: isSel ? '1px solid #0e639c' : '1px solid #3e3e42',
                                            borderRadius: '3px',
                                            cursor: profileEditing ? 'pointer' : 'default',
                                            opacity: isSel ? 1 : 0.55,
                                            transition: 'all 0.12s',
                                            position: 'relative',
                                        }}
                                    >
                                        {a.src ? (
                                            <img
                                                src={a.src}
                                                alt={a.label}
                                                style={{ width: 32, height: 32, objectFit: 'contain' }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: '24px', lineHeight: 1 }}>{a.label}</span>
                                        )}
                                        {isSel && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    top: -3,
                                                    right: -3,
                                                    width: 8,
                                                    height: 8,
                                                    background: '#4ec9b0',
                                                    border: '1px solid #1e1e1e',
                                                    borderRadius: '50%',
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div
                            style={{
                                padding: '4px 12px',
                                fontSize: '10px',
                                color: '#6a9955',
                                borderTop: '1px solid #3e3e42',
                            }}
                        >
                            // nickname
                        </div>
                        <div style={{ padding: '2px 10px 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {currentAvatar?.src ? (
                                <img src={currentAvatar.src} style={{ width: 14, height: 14, objectFit: 'contain' }} />
                            ) : (
                                <span style={{ fontSize: '14px' }}>{currentAvatar?.label}</span>
                            )}
                            <input
                                style={{
                                    flex: 1,
                                    fontSize: '12px',
                                    padding: '3px 6px',
                                    border: nickname.trim() ? '1px solid #4ec9b0' : '1px solid #3e3e42',
                                    outline: 'none',
                                    background: '#1e1e1e',
                                    color: '#d4d4d4',
                                }}
                                placeholder="nickname"
                                value={draftNickname}
                                onChange={(e) => setDraftNickname(e.target.value)}
                                disabled={!profileEditing}
                                maxLength={12}
                                onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
                            />
                        </div>

                        <div style={{ padding: '0 10px 6px', display: 'flex', gap: '4px' }}>
                            {profileEditing ? (
                                <>
                                    <button
                                        className="btn-primary"
                                        style={{ flex: 1, fontSize: '11px', padding: '3px 0' }}
                                        onClick={saveProfile}
                                    >
                                        save()
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        style={{ flex: 1, fontSize: '11px', padding: '3px 0' }}
                                        onClick={cancelProfileEdit}
                                    >
                                        cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn-secondary"
                                    style={{ flex: 1, fontSize: '11px', padding: '3px 0' }}
                                    onClick={() => setProfileEditing(true)}
                                >
                                    ✎ edit
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ════════ EDITOR AREA ════════ */}
            <div
                style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1e1e1e' }}
            >
                {/* Error */}
                {error && (
                    <div className="msg-bar error" style={{ margin: 0, borderRadius: 0, flexShrink: 0 }}>
                        <span className="cmt">// </span>
                        <span style={{ color: '#f44747' }}>error: </span>
                        {error}
                    </div>
                )}

                {/* Scrollable editor content */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                    {/* ── ROOM LIST view ── */}
                    {!showCreate && (
                        <div className="code-block" style={{ borderRadius: 0, border: 'none' }}>
                            {L(
                                <>
                                    <span className="cmt">{'// lobby.ts — Available rooms'}</span>
                                </>,
                            )}
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
                                L(
                                    <>
                                        <span className="cmt">{'  // no rooms — create one!'}</span>
                                    </>,
                                )}

                            {rooms.map((room) => {
                                const opt =
                                    room.studyType === 'BASEBALL'
                                        ? `${room.digits}digit`
                                        : room.studyType === 'TETRIS'
                                          ? '20x10'
                                          : room.studyType === 'INCIDENT_AVOID'
                                            ? '360x520'
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
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                width: '100%',
                                                gap: '8px',
                                            }}
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
                                                <span className="num">{room.maxPlayers}</span>
                                                <span className="pct">{' }'}</span>
                                            </span>
                                            <button
                                                className="btn-primary"
                                                style={{
                                                    fontSize: '11px',
                                                    padding: '2px 10px',
                                                    flexShrink: 0,
                                                    marginRight: '4px',
                                                }}
                                                onClick={() => handleJoin(room.roomId)}
                                            >
                                                .join()
                                            </button>
                                        </span>
                                    </div>
                                );
                            })}

                            {L(
                                <>
                                    <span className="pct">]</span>
                                </>,
                            )}
                            {L(<></>)}
                            {(() => {
                                const lineNum = ln++;
                                return (
                                    <div className="c-line" key={lineNum}>
                                        <span className="ln">{lineNum}</span>
                                        <span className="c-line-body" style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className="btn-secondary"
                                                style={{ fontSize: '11px' }}
                                                onClick={fetchRooms}
                                                disabled={loading}
                                            >
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

                    {/* ── CREATE ROOM view ── */}
                    {showCreate && (
                        <div className="code-block" style={{ borderRadius: 0, border: 'none' }}>
                            {L(
                                <>
                                    <span className="cmt">{'// createRoom.ts'}</span>
                                </>,
                            )}
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
                                        style={{
                                            width: '220px',
                                            fontSize: '12px',
                                            padding: '2px 6px',
                                            background: '#1e1e1e',
                                            color: '#ce9178',
                                            border: '1px solid #3e3e42',
                                            outline: 'none',
                                        }}
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
                                    {(['BASEBALL', 'BINGO', 'OMOK', 'TETRIS', 'INCIDENT_AVOID', 'OLDMAID'] as StudyType[]).map((t) => (
                                        <button
                                            key={t}
                                            className={`btn-opt ${studyType === t ? 'on' : ''}`}
                                            onClick={() => {
                                                setStudyType(t);
                                                if (t === 'OMOK') {
                                                    setMaxPlayers(2);
                                                    setBoardSize(19);
                                                } else if (t === 'TETRIS' || t === 'INCIDENT_AVOID') {
                                                    setMaxPlayers(3);
                                                    setBoardSize(20);
                                                } else if (t === 'OLDMAID') {
                                                    setMaxPlayers(4);
                                                    setBoardSize(0);
                                                }
                                            }}
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
                                        <span className="kw">const </span>
                                        <span className="var">maxPlayers</span>
                                        <span className="pct"> = </span>
                                        {[2, 3, 4, 5, 6, 7].map((n) => (
                                            <button
                                                key={n}
                                                className={`btn-opt ${maxPlayers === n ? 'on' : ''}`}
                                                onClick={() => setMaxPlayers(n)}
                                                style={{ fontSize: '11px', padding: '3px 8px' }}
                                            >
                                                <span className="num">{n}</span>
                                            </button>
                                        ))}
                                        <span className="cmt"> // joker stays last</span>
                                    </span>,
                                    1,
                                )}
                            {(studyType === 'TETRIS' || studyType === 'INCIDENT_AVOID') &&
                                L(
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="kw">const </span>
                                        <span className="var">maxPlayers</span>
                                        <span className="pct"> = </span>
                                        <span className="num">3</span>
                                        <span className="cmt"> // fixed</span>
                                    </span>,
                                    1,
                                )}
                            {studyType === 'OMOK' &&
                                L(
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="kw">const </span>
                                        <span className="var">maxPlayers</span>
                                        <span className="pct"> = </span>
                                        <span className="num">2</span>
                                        <span className="cmt"> // 1v1 only</span>
                                    </span>,
                                    1,
                                )}
                            {studyType !== 'OLDMAID' &&
                                studyType !== 'TETRIS' &&
                                studyType !== 'INCIDENT_AVOID' &&
                                studyType !== 'OMOK' &&
                                L(
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="kw">const </span>
                                        <span className="var">maxPlayers</span>
                                        <span className="pct"> = </span>
                                        {[2, 3, 4, 5, 6].map((n) => (
                                            <button
                                                key={n}
                                                className={`btn-opt ${maxPlayers === n ? 'on' : ''}`}
                                                onClick={() => setMaxPlayers(n)}
                                                style={{ fontSize: '11px', padding: '3px 8px' }}
                                            >
                                                <span className="num">{n}</span>
                                            </button>
                                        ))}
                                    </span>,
                                    1,
                                )}

                            {studyType === 'BASEBALL' &&
                                L(
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="kw">const </span>
                                        <span className="var">digits</span>
                                        <span className="pct"> = </span>
                                        {[3, 4, 5].map((d) => (
                                            <button
                                                key={d}
                                                className={`btn-opt ${digits === d ? 'on' : ''}`}
                                                onClick={() => setDigits(d)}
                                                style={{ fontSize: '11px', padding: '3px 8px' }}
                                            >
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
                                        <span className="kw">const </span>
                                        <span className="var">boardSize</span>
                                        <span className="pct"> = </span>
                                        {[3, 4, 5].map((s) => (
                                            <button
                                                key={s}
                                                className={`btn-opt ${boardSize === s ? 'on' : ''}`}
                                                onClick={() => setBoardSize(s)}
                                                style={{ fontSize: '11px', padding: '3px 8px' }}
                                            >
                                                <span className="num">{s}</span>
                                            </button>
                                        ))}
                                        <span className="cmt"> // win: {boardSize === 3 ? 2 : 3} lines</span>
                                    </span>,
                                    1,
                                )}

                            {studyType === 'OMOK' &&
                                L(
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="kw">const </span>
                                        <span className="var">boardSize</span>
                                        <span className="pct"> = </span>
                                        <span className="num">19</span>
                                        <span className="cmt"> // fixed 19×19, P1 3-3 banned</span>
                                    </span>,
                                    1,
                                )}
                            {studyType === 'TETRIS' &&
                                L(
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="kw">const </span>
                                        <span className="var">queue</span>
                                        <span className="pct"> = </span>
                                        <span className="str">"20x10"</span>
                                        <span className="cmt"> // 3-player workspace</span>
                                    </span>,
                                    1,
                                )}
                            {studyType === 'INCIDENT_AVOID' &&
                                L(
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="kw">const </span>
                                        <span className="var">monitor</span>
                                        <span className="pct"> = </span>
                                        <span className="str">"360x520"</span>
                                        <span className="cmt"> // 3-player workspace</span>
                                    </span>,
                                    1,
                                )}

                            {L(<></>)}
                            {L(
                                <span style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        className="btn-primary"
                                        onClick={handleCreate}
                                        disabled={creating}
                                        style={{ fontSize: '12px' }}
                                    >
                                        {creating ? 'creating...' : '▶ return createRoom()'}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setShowCreate(false)}
                                        style={{ fontSize: '12px' }}
                                    >
                                        cancel
                                    </button>
                                </span>,
                                1,
                            )}
                            {L(
                                <>
                                    <span className="pct">{'}'}</span>
                                </>,
                            )}
                        </div>
                    )}
                </div>

                {/* ════════ TERMINAL PANEL ════════ */}
                {termOpen && (
                    <div
                        style={{
                            height: termHeight,
                            flexShrink: 0,
                            borderTop: '1px solid #3e3e42',
                            background: '#1e1e1e',
                            display: 'flex',
                            flexDirection: 'column',
                            fontFamily: "'Consolas','Courier New',monospace",
                        }}
                    >
                        {/* Terminal header bar */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0',
                                background: '#252526',
                                borderBottom: '1px solid #3e3e42',
                                flexShrink: 0,
                                height: '26px',
                            }}
                        >
                            {/* Tab */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '0 14px',
                                    height: '100%',
                                    background: '#1e1e1e',
                                    borderRight: '1px solid #3e3e42',
                                    fontSize: '11px',
                                    color: '#ccc',
                                }}
                            >
                                <span style={{ color: '#6a9955', fontSize: '11px' }}>⬤</span>
                                <span>TERMINAL</span>
                                <span style={{ color: '#858585', fontSize: '10px' }}>bash</span>
                            </div>
                            {/* Resize handle hint + close */}
                            <div
                                style={{ flex: 1, cursor: 'ns-resize', height: '100%' }}
                                onMouseDown={(e) => {
                                    const startY = e.clientY;
                                    const startH = termHeight;
                                    const onMove = (ev: MouseEvent) => {
                                        const delta = startY - ev.clientY;
                                        setTermHeight(Math.max(80, Math.min(400, startH + delta)));
                                    };
                                    const onUp = () => {
                                        window.removeEventListener('mousemove', onMove);
                                        window.removeEventListener('mouseup', onUp);
                                    };
                                    window.addEventListener('mousemove', onMove);
                                    window.addEventListener('mouseup', onUp);
                                }}
                            />
                            <div style={{ display: 'flex', gap: '2px', paddingRight: '8px' }}>
                                <span
                                    style={{
                                        fontSize: '14px',
                                        color: '#555',
                                        cursor: 'pointer',
                                        padding: '0 4px',
                                        lineHeight: 1,
                                    }}
                                    title="Close terminal"
                                    onClick={() => setTermOpen(false)}
                                >
                                    ✕
                                </span>
                            </div>
                        </div>

                        {/* Terminal output */}
                        <div
                            ref={(el) => {
                                termRef.current = el;
                            }}
                            style={{
                                flex: 1,
                                overflow: 'auto',
                                padding: '6px 12px 2px',
                                fontSize: '12px',
                                lineHeight: '1.5',
                            }}
                        >
                            {termHistory.map((line, i) => (
                                <div key={i} style={{ display: 'flex', gap: '6px' }}>
                                    {line.type === 'cmd' && (
                                        <>
                                            <span style={{ color: '#6a9955', userSelect: 'none' }}>
                                                PC024@STUDY-PLATFORM <span style={{ color: '#569cd6' }}>MINGW64</span>{' '}
                                                <span style={{ color: '#ce9178' }}>~/study-platform</span>
                                            </span>
                                            <span style={{ color: '#4ec9b0' }}>$</span>
                                            <span style={{ color: '#d4d4d4' }}>{line.text}</span>
                                        </>
                                    )}
                                    {line.type === 'out' && (
                                        <span style={{ color: '#d4d4d4', paddingLeft: '2px' }}>{line.text || ' '}</span>
                                    )}
                                    {line.type === 'err' && (
                                        <span style={{ color: '#f44747', paddingLeft: '2px' }}>{line.text}</span>
                                    )}
                                </div>
                            ))}

                            {/* Input line */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                <span style={{ color: '#6a9955', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                    PC024@STUDY-PLATFORM <span style={{ color: '#569cd6' }}>MINGW64</span>{' '}
                                    <span style={{ color: '#ce9178' }}>~/study-platform</span>
                                </span>
                                <span style={{ color: '#4ec9b0' }}>$</span>
                                <input
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        color: '#d4d4d4',
                                        fontSize: '12px',
                                        fontFamily: 'inherit',
                                        caretColor: '#d4d4d4',
                                    }}
                                    value={termInput}
                                    onChange={(e) => setTermInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleTermCmd(termInput);
                                    }}
                                    placeholder=""
                                    spellCheck={false}
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Re-open terminal button when closed */}
                {!termOpen && (
                    <div
                        style={{
                            flexShrink: 0,
                            borderTop: '1px solid #3e3e42',
                            background: '#252526',
                            padding: '3px 12px',
                            fontSize: '11px',
                            color: '#555',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                        onClick={() => setTermOpen(true)}
                    >
                        <span style={{ color: '#6a9955' }}>⬤</span> TERMINAL
                    </div>
                )}
            </div>
        </div>
    );
}

export default Lobby;
