import { useState, useEffect } from "react";
import { Room, StudyType, CreateRoomRequest, JoinRoomRequest } from "../types";

const PLAYER_EMOJIS = ["🐱", "🐶", "🦊", "🐼", "🐨", "🦁", "🐸", "🐧", "👽", "👻", "💀", "🐢"];
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
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [studyType, setStudyType] = useState<StudyType>("BASEBALL");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [digits, setDigits] = useState(3);
  const [boardSize, setBoardSize] = useState(5);
  const [creating, setCreating] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rooms");
      if (!res.ok) throw new Error();
      setRooms(await res.json());
      setError("");
    } catch {
      setError("Failed to fetch rooms.");
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
    if (!nickname.trim()) {
      setError("Enter a nickname first.");
      return;
    }
    if (!roomName.trim()) {
      setError("Room name is required.");
      return;
    }
    setCreating(true);
    try {
      const body: CreateRoomRequest = {
        roomName: roomName.trim(),
        studyType,
        nickname: nickname.trim(),
        sessionId,
        maxPlayers,
        digits,
        boardSize,
      };
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      onJoinRoom(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create room.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (roomId: string) => {
    if (!nickname.trim()) {
      setError("Enter a nickname first.");
      return;
    }
    try {
      const body: JoinRoomRequest = { nickname: nickname.trim(), sessionId };
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      onJoinRoom(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to join room.");
    }
  };

  // line counter for gutter
  let ln = 1;
  const L = (body: React.ReactNode, indent = 0) => (
    <div className="c-line" key={ln}>
      <span className="ln">{ln++}</span>
      <span className="c-line-body" style={{ paddingLeft: indent * 16 }}>
        {body}
      </span>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: "20px", maxWidth: "900px" }}>
      {/* ── Left: Explorer panel ──────────────────── */}
      <div style={{ width: "200px", flexShrink: 0 }}>
        <div
          style={{
            background: "rgba(0,0,0,0.05)",
            border: "1px solid #3e3e42",
            paddingBottom: "8px",
            borderRadius: "6px",
          }}
        >
          <div className="section-head" style={{ color: "#bbb", fontSize: "11px" }}>
            USER
          </div>

          {/* ── Emoji picker ── */}
          <div style={{ padding: "8px 12px 4px", fontSize: "11px" }}>
            <span className="cmt">AVATAR</span>
          </div>
          <div
            style={{
              padding: "0 12px 10px",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "6px",
            }}
          >
            {PLAYER_EMOJIS.map((e) => {
              const isSelected = emoji === e;
              return (
                <div
                  key={e}
                  onClick={() => onEmojiChange(e)}
                  style={{
                    position: "relative", // ← 래퍼에 relative
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    padding: "5px",
                    background: isSelected ? "rgba(14,99,156,0.5)" : "transparent",
                    border: isSelected ? "1px solid #0e639c" : "1px solid #3e3e42",
                    borderRadius: "4px",
                    cursor: "pointer",
                    lineHeight: 1,
                    transition: "all 0.15s",
                    opacity: isSelected ? 1 : 0.5, // ← 미선택은 흐리게
                  }}
                  title={e}
                >
                  {e}
                  {isSelected && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-4px",
                        right: "-4px",
                        width: "10px",
                        height: "10px",
                        background: "#4ec9b0", // ← VS Code 민트색
                        border: "1px solid #1e1e1e",
                        borderRadius: "50%",
                        display: "block",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Nickname ── */}
          <div style={{ padding: "4px 12px 4px", fontSize: "11px", borderTop: "1px solid #3e3e42" }}>
            <span className="cmt">NICKNAME</span>
          </div>
          <div style={{ padding: "0 12px 10px", display: "flex", gap: "6px", alignItems: "center" }}>
            {emoji && <span style={{ fontSize: "16px", lineHeight: 1 }}>{emoji}</span>}
            <input
              style={{
                fontSize: "12px",
                padding: "4px 6px",
                flex: 1,
                minWidth: 0,
                border: nickname.trim() ? "1px solid #4ec9b0" : undefined, // ← 입력 시 민트 보더
                outline: nickname.trim() ? "none" : undefined,
                transition: "border-color 0.2s",
              }}
              placeholder="nickname"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              maxLength={12}
            />
          </div>
          {/* {nickname && (
            <div style={{ padding: "0 12px 10px", fontSize: "11px" }}>
              <span className="kw">const </span>
              <span className="var">me</span>
              <span className="pct"> = </span>
              <span className="str">"{nickname}"</span>
              <span className="dim"> ✓</span>
            </div>
          )} */}

          <div style={{ borderTop: "1px solid #3e3e42", padding: "8px 12px 4px", fontSize: "11px" }}>
            <span className="cmt">PLAYGROUND</span>
          </div>
          <div style={{ padding: "2px 12px", fontSize: "12px", color: "#858585" }}>👯‍♀️ LOBBY</div>
          <div style={{ padding: "2px 12px", fontSize: "12px", color: "#555" }}>📁 GAMES</div>
          <div style={{ padding: "2px 12px 2px 24px", fontSize: "12px", color: "#555" }}>ㄴ ⚾ BASEBALL</div>
          <div style={{ padding: "2px 12px 2px 24px", fontSize: "12px", color: "#555" }}>ㄴ 📝 BINGO</div>
        </div>
      </div>

      {/* ── Right: Editor ─────────────────────────── */}
      <div style={{ flex: 1 }}>
        {/* Error */}
        {error && (
          <div className="msg-bar error" style={{ marginBottom: "12px" }}>
            <span className="cmt">// error: </span>
            {error}
          </div>
        )}

        {/* ── Room list ── */}
        <div className="code-block" style={{ marginBottom: "16px", borderRadius: "6px" }}>
          {L(
            <>
              <span className="cmt">
                {"// Available rooms"} {loading ? "(loading...)" : `(${rooms.length})`}
              </span>
            </>,
          )}
          {L(
            <>
              <span className="kw">const </span>
              <span className="var">rooms</span>
              <span className="pct"> = [</span>
            </>,
          )}

          {rooms.length === 0 && L(<span className="cmt">{"  방을 만들어주세요."}</span>)}

          {rooms.map((room) => {
            const isBaseball = room.studyType === "BASEBALL";
            const opt = isBaseball ? `${room.digits}digit` : `${room.boardSize}x${room.boardSize}`;
            return (
              <div className="c-line" key={room.roomId} style={{ alignItems: "flex-start" }}>
                <span className="ln">{ln++}</span>
                <span
                  className="c-line-body"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                >
                  <span>
                    {"  "}
                    <span className="pct">{"{ "}</span>
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
                    <span className="num">{opt}</span>
                    <span className="pct">, </span>
                    <span className="var">players</span>
                    <span className="pct">: </span>
                    <span className="num">
                      {room.playerCount}/{room.maxPlayers}
                    </span>
                    <span className="pct">{" }"}</span>
                  </span>
                  <button
                    className="btn-primary"
                    style={{ marginLeft: "12px", fontSize: "11px", padding: "3px 10px" }}
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
          <div className="c-line">
            <span className="ln">{ln++}</span>
            <span className="c-line-body" style={{ display: "flex", gap: "8px" }}>
              <button className="btn-secondary" style={{ fontSize: "11px" }} onClick={fetchRooms} disabled={loading}>
                {loading ? "refreshing..." : "↺ refresh()"}
              </button>
              <button
                className={showCreate ? "btn-primary" : "btn-secondary"}
                style={{ fontSize: "11px", background: showCreate ? "#0e639c" : "#00ab77", color: showCreate ? "#fff" : "#fff" }}
                onClick={() => setShowCreate(!showCreate)}
              >
                {showCreate ? "✕ cancel" : "+ createRoom()"}
              </button>
            </span>
          </div>
        </div>

        {/* ── Create room form ── */}
        {showCreate && (
          <div className="code-block">
            {L(
              <>
                <span className="cmt">{"// Create new room"}</span>
              </>,
            )}
            {L(
              <>
                <span className="kw">function </span>
                <span className="fn">createRoom</span>
                <span className="pct">{"() {"}</span>
              </>,
            )}

            {/* room name */}
            {L(
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="kw">const </span>
                <span className="var">name</span>
                <span className="pct"> = </span>
                <input
                  style={{ width: "180px", fontSize: "12px", padding: "2px 6px", display: "inline-block" }}
                  placeholder='"room name"'
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={20}
                />
              </span>,
              1,
            )}

            {/* game type */}
            {L(
              <span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span className="kw">const </span>
                <span className="var">type</span>
                <span className="pct"> = </span>
                {(["BASEBALL", "BINGO"] as StudyType[]).map((t) => (
                  <button
                    key={t}
                    className={`btn-opt ${studyType === t ? "on" : ""}`}
                    onClick={() => setStudyType(t)}
                    style={{ fontSize: "11px" }}
                  >
                    <span className="typ">{t}</span>
                  </button>
                ))}
              </span>,
              1,
            )}

            {/* max players */}
            {L(
              <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span className="kw">const </span>
                <span className="var">maxPlayers</span>
                <span className="pct"> = </span>
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    className={`btn-opt ${maxPlayers === n ? "on" : ""}`}
                    onClick={() => setMaxPlayers(n)}
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                  >
                    <span className="num">{n}</span>
                  </button>
                ))}
              </span>,
              1,
            )}

            {/* baseball: digits */}
            {studyType === "BASEBALL" &&
              L(
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="kw">const </span>
                  <span className="var">digits</span>
                  <span className="pct"> = </span>
                  {[3, 4, 5].map((d) => (
                    <button
                      key={d}
                      className={`btn-opt ${digits === d ? "on" : ""}`}
                      onClick={() => setDigits(d)}
                      style={{ fontSize: "11px", padding: "3px 8px" }}
                    >
                      <span className="num">{d}</span>
                    </button>
                  ))}
                  <span className="cmt"> // 1–9, no duplicates</span>
                </span>,
                1,
              )}

            {/* bingo: board size */}
            {studyType === "BINGO" &&
              L(
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="kw">const </span>
                  <span className="var">boardSize</span>
                  <span className="pct"> = </span>
                  {[3, 4, 5].map((s) => (
                    <button
                      key={s}
                      className={`btn-opt ${boardSize === s ? "on" : ""}`}
                      onClick={() => setBoardSize(s)}
                      style={{ fontSize: "11px", padding: "3px 8px" }}
                    >
                      <span className="num">{s}</span>
                    </button>
                  ))}
                  <span className="cmt"> // win: {boardSize === 3 ? 2 : 3} lines</span>
                </span>,
                1,
              )}

            {L(
              <button className="btn-primary" onClick={handleCreate} disabled={creating} style={{ fontSize: "12px" }}>
                {creating ? "creating..." : "return createRoom()  ▶"}
              </button>,
              1,
            )}
            {L(
              <>
                <span className="pct">{"}"}</span>
              </>,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Lobby;
