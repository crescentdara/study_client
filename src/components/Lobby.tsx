import { useState, useEffect } from 'react';
import { Room, StudyType, CreateRoomRequest, JoinRoomRequest } from '../types';

interface LobbyProps {
  nickname: string;
  sessionId: string;
  onNicknameChange: (name: string) => void;
  onJoinRoom: (room: Room) => void;
}

function Lobby({ nickname, sessionId, onNicknameChange, onJoinRoom }: LobbyProps) {
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

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error();
      setRooms(await res.json());
      setError('');
    } catch { setError('Failed to fetch rooms.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchRooms();
    const t = setInterval(fetchRooms, 5000);
    return () => clearInterval(t);
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim()) { setError('Enter a nickname first.'); return; }
    if (!roomName.trim()) { setError('Room name is required.'); return; }
    setCreating(true);
    try {
      const body: CreateRoomRequest = {
        roomName: roomName.trim(), studyType, nickname: nickname.trim(),
        sessionId, maxPlayers, digits, boardSize,
      };
      const res = await fetch('/api/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      onJoinRoom(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create room.');
    } finally { setCreating(false); }
  };

  const handleJoin = async (roomId: string) => {
    if (!nickname.trim()) { setError('Enter a nickname first.'); return; }
    try {
      const body: JoinRoomRequest = { nickname: nickname.trim(), sessionId };
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      onJoinRoom(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join room.');
    }
  };

  // line counter for gutter
  let ln = 1;
  const L = (body: React.ReactNode, indent = 0) => (
    <div className="c-line" key={ln}>
      <span className="ln">{ln++}</span>
      <span className="c-line-body" style={{ paddingLeft: indent * 16 }}>{body}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: '20px', maxWidth: '900px' }}>

      {/* ── Left: Explorer panel ──────────────────── */}
      <div style={{ width: '200px', flexShrink: 0 }}>
        <div style={{ background: '#252526', border: '1px solid #3e3e42', paddingBottom: '8px' }}>
          <div className="section-head" style={{ color: '#bbb', fontSize: '11px' }}>EXPLORER</div>

          {/* Player */}
          <div style={{ padding: '8px 12px 4px', fontSize: '11px' }}>
            <span className="cmt">// player</span>
          </div>
          <div style={{ padding: '0 12px 10px', display: 'flex', gap: '6px' }}>
            <input
              style={{ fontSize: '12px', padding: '4px 6px' }}
              placeholder="nickname"
              value={nickname}
              onChange={e => onNicknameChange(e.target.value)}
              maxLength={12}
            />
          </div>
          {nickname && (
            <div style={{ padding: '0 12px 10px', fontSize: '11px' }}>
              <span className="kw">const </span>
              <span className="var">me</span>
              <span className="pct"> = </span>
              <span className="str">"{nickname}"</span>
              <span className="dim"> ✓</span>
            </div>
          )}

          <div style={{ borderTop: '1px solid #3e3e42', padding: '8px 12px 4px', fontSize: '11px' }}>
            <span className="cmt">// files</span>
          </div>
          <div style={{ padding: '2px 12px', fontSize: '12px', color: '#858585' }}>
            📄 lobby.ts
          </div>
          <div style={{ padding: '2px 12px', fontSize: '12px', color: '#555' }}>
            📁 games/
          </div>
          <div style={{ padding: '2px 12px 2px 24px', fontSize: '12px', color: '#555' }}>
            ⚾ baseball.ts
          </div>
          <div style={{ padding: '2px 12px 2px 24px', fontSize: '12px', color: '#555' }}>
            ◻ bingo.ts
          </div>
        </div>
      </div>

      {/* ── Right: Editor ─────────────────────────── */}
      <div style={{ flex: 1 }}>

        {/* Error */}
        {error && (
          <div className="msg-bar error" style={{ marginBottom: '12px' }}>
            <span className="cmt">// error: </span>{error}
          </div>
        )}

        {/* ── Room list ── */}
        <div className="code-block" style={{ marginBottom: '16px' }}>
          {L(<><span className="cmt">{'// Available rooms'} {loading ? '(loading...)' : `(${rooms.length})`}</span></>)}
          {L(<><span className="kw">const </span><span className="var">rooms</span><span className="pct"> = [</span></>)}

          {rooms.length === 0 && L(
            <span className="cmt">{'  // no rooms waiting — create one!'}</span>,
          )}

          {rooms.map(room => {
            const isBaseball = room.studyType === 'BASEBALL';
            const opt = isBaseball ? `${room.digits}digit` : `${room.boardSize}x${room.boardSize}`;
            return (
              <div className="c-line" key={room.roomId} style={{ alignItems: 'flex-start' }}>
                <span className="ln">{ln++}</span>
                <span className="c-line-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>
                    {'  '}
                    <span className="pct">{'{ '}</span>
                    <span className="var">name</span><span className="pct">: </span>
                    <span className="str">"{room.roomName}"</span>
                    <span className="pct">, </span>
                    <span className="var">type</span><span className="pct">: </span>
                    <span className="typ">{room.studyType}</span>
                    <span className="pct">, </span>
                    <span className="var">opt</span><span className="pct">: </span>
                    <span className="num">{opt}</span>
                    <span className="pct">, </span>
                    <span className="var">players</span><span className="pct">: </span>
                    <span className="num">{room.playerCount}/{room.maxPlayers}</span>
                    <span className="pct">{' }'}</span>
                  </span>
                  <button className="btn-primary" style={{ marginLeft: '12px', fontSize: '11px', padding: '3px 10px' }}
                    onClick={() => handleJoin(room.roomId)}>
                    .join()
                  </button>
                </span>
              </div>
            );
          })}

          {L(<><span className="pct">]</span></>)}
          <div className="c-line">
            <span className="ln">{ln++}</span>
            <span className="c-line-body" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" style={{ fontSize: '11px' }} onClick={fetchRooms} disabled={loading}>
                {loading ? 'refreshing...' : '↺ refresh()'}
              </button>
              <button
                className={showCreate ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '11px' }}
                onClick={() => setShowCreate(!showCreate)}
              >
                {showCreate ? '✕ cancel' : '+ createRoom()'}
              </button>
            </span>
          </div>
        </div>

        {/* ── Create room form ── */}
        {showCreate && (
          <div className="code-block">
            {L(<><span className="cmt">{'// Create new room'}</span></>)}
            {L(<><span className="kw">function </span><span className="fn">createRoom</span><span className="pct">{'() {'}</span></>)}

            {/* room name */}
            {L(
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="kw">const </span>
                <span className="var">name</span>
                <span className="pct"> = </span>
                <input
                  style={{ width: '180px', fontSize: '12px', padding: '2px 6px', display: 'inline-block' }}
                  placeholder='"room name"'
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  maxLength={20}
                />
              </span>, 1
            )}

            {/* game type */}
            {L(
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="kw">const </span>
                <span className="var">type</span>
                <span className="pct"> = </span>
                {(['BASEBALL', 'BINGO'] as StudyType[]).map(t => (
                  <button key={t} className={`btn-opt ${studyType === t ? 'on' : ''}`}
                    onClick={() => setStudyType(t)} style={{ fontSize: '11px' }}>
                    <span className="typ">{t}</span>
                  </button>
                ))}
              </span>, 1
            )}

            {/* max players */}
            {L(
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span className="kw">const </span>
                <span className="var">maxPlayers</span>
                <span className="pct"> = </span>
                {[2, 3, 4, 5, 6].map(n => (
                  <button key={n} className={`btn-opt ${maxPlayers === n ? 'on' : ''}`}
                    onClick={() => setMaxPlayers(n)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                    <span className="num">{n}</span>
                  </button>
                ))}
              </span>, 1
            )}

            {/* baseball: digits */}
            {studyType === 'BASEBALL' && L(
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="kw">const </span>
                <span className="var">digits</span>
                <span className="pct"> = </span>
                {[3, 4, 5].map(d => (
                  <button key={d} className={`btn-opt ${digits === d ? 'on' : ''}`}
                    onClick={() => setDigits(d)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                    <span className="num">{d}</span>
                  </button>
                ))}
                <span className="cmt">  // 1–9, no duplicates</span>
              </span>, 1
            )}

            {/* bingo: board size */}
            {studyType === 'BINGO' && L(
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="kw">const </span>
                <span className="var">boardSize</span>
                <span className="pct"> = </span>
                {[3, 4, 5].map(s => (
                  <button key={s} className={`btn-opt ${boardSize === s ? 'on' : ''}`}
                    onClick={() => setBoardSize(s)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                    <span className="num">{s}</span>
                  </button>
                ))}
                <span className="cmt">  // win: {boardSize === 3 ? 2 : 3} lines</span>
              </span>, 1
            )}

            {L(
              <button className="btn-primary" onClick={handleCreate} disabled={creating}
                style={{ fontSize: '12px' }}>
                {creating ? 'creating...' : 'return createRoom()  ▶'}
              </button>, 1
            )}
            {L(<><span className="pct">{'}'}</span></>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default Lobby;
