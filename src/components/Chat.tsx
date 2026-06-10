import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "../types";

/**
 * Chat Props 타입 정의
 */
interface ChatProps {
  messages: ChatMessage[]; // 수신된 메시지 목록 (StudyRoom에서 관리)
  myNickname: string; // 내 메시지를 강조 표시하기 위한 닉네임
  myEmoji: string; // 내 이모지 (닉네임 앞에 표시)
  sessionId: string; // 전송 시 서버로 전달할 세션 ID
  onSend: (text: string, sessionId: string) => void; // 전송 시 호출할 콜백 (useWebSocket의 sendChat)
}

const PLAYER_AVATARS: { id: string; src: string | null; label: string }[] = [
  { id: "🐱", src: null, label: "🐱" },
  { id: "🐶", src: null, label: "🐶" },
  { id: "🦊", src: null, label: "🦊" },
  { id: "🐼", src: null, label: "🐼" },
  { id: "🐨", src: null, label: "🐨" },
  { id: "💀", src: null, label: "💀" },
  { id: "ch1", src: "/src/assets/images/ch1.png", label: "😀" },
  { id: "ch2", src: "/src/assets/images/ch2.png", label: "😁" },
  { id: "ch3", src: "/src/assets/images/ch3.png", label: "👻" },
  { id: "ch4", src: "/src/assets/images/ch4.png", label: "👽" },
  { id: "pig", src: "/src/assets/images/dalbit.png", label: "🐷" },
  { id: "ggobuk", src: "/src/assets/images/ggobuk.png", label: "🐢" },
];

// 헬퍼 함수 추가
const renderAvatar = (emojiId: string, size = 16) => {
  const a = PLAYER_AVATARS.find((a) => a.id === emojiId);
  if (!a) return <span>{emojiId}</span>;
  return a.src ? (
    <img
      src={a.src}
      alt={a.label}
      style={{ width: size, height: size, objectFit: "contain", verticalAlign: "middle" }}
    />
  ) : (
    <span style={{ fontSize: size }}>{a.label}</span>
  );
};

/**
 * 채팅 패널 컴포넌트
 *
 * VS Code 터미널/출력 패널 스타일로 구현한 실시간 채팅 UI입니다.
 *
 * ─── 데이터 흐름 ──────────────────────────────────────────────────────────
 * 전송:
 *   사용자 입력 → handleSend → onSend(text, sessionId)
 *   → useWebSocket.sendChat → STOMP publish → 서버
 *   → 서버 브로드캐스트 → 수신 (아래 수신 흐름)
 *
 * 수신:
 *   서버 → STOMP /topic/chat/{roomId}
 *   → useWebSocket onChat 콜백
 *   → StudyRoom.handleChat → setChatMessages
 *   → messages prop 업데이트 → 이 컴포넌트 리렌더링
 */
export default function Chat({ messages, myNickname, myEmoji, sessionId, onSend }: ChatProps) {
  const [input, setInput] = useState("");
  // 패널 접기/펼치기 상태 (true = 펼침)
  const [open, setOpen] = useState(true);

  const [showOpacity, setShowOpacity] = useState(false);
  const [chatOpacity, setChatOpacity] = useState<number>(() => {
    const raw = parseFloat(localStorage.getItem('study.chatOpacity') ?? '100');
    // 이전에 0~1 float로 저장된 값 호환 처리
    const v = raw <= 1 ? Math.round(raw * 100) : raw;
    return Math.max(20, Math.min(100, v));
  });

  /**
   * 메시지 목록의 맨 아래를 참조하는 DOM 참조 (useRef)
   *
   * useRef: 렌더링을 발생시키지 않고 DOM 요소를 직접 참조할 때 사용합니다.
   * (useState는 값이 바뀌면 리렌더링이 발생하지만, useRef는 그렇지 않음)
   * 여기서는 새 메시지 도착 시 자동 스크롤에만 사용합니다.
   */
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * 새 메시지가 도착할 때마다 자동으로 맨 아래로 스크롤
   *
   * useEffect의 deps [messages]:
   *   messages 배열이 바뀔 때(새 메시지 추가)마다 이 effect가 실행됩니다.
   *
   * scrollIntoView: DOM 요소를 뷰포트 안으로 스크롤합니다.
   * behavior: 'smooth' → 부드럽게 애니메이션하며 스크롤
   *
   * ?. (옵셔널 체이닝): bottomRef.current가 null이면 에러 없이 무시합니다.
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * 메시지 전송 처리
   *
   * input.trim(): 앞뒤 공백 제거. 공백만 있으면 전송하지 않습니다.
   * 전송 후 입력창을 비워 다음 메시지를 바로 입력할 수 있게 합니다.
   */
  const handleSend = () => {
    if (!input.trim()) return; // 빈 메시지 전송 방지
    onSend(input.trim(), sessionId);
    setInput(""); // 전송 후 입력창 초기화
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#1e1e1e",
        border: "1px solid #3e3e42",
        height: "100%",
        minHeight: "200px",
        opacity: chatOpacity / 100, // ← 추가
        transition: "opacity 0.2s", // ← 추가
      }}
    >
      {/* ── 패널 헤더 (VS Code 출력 패널 스타일) ── */}
      <div
        style={{
          padding: "4px 10px",
          background: "#252526",
          borderBottom: "1px solid #3e3e42",
          fontSize: "11px",
          color: "#858585",
          letterSpacing: "1px",
          textTransform: "uppercase",
          flexShrink: 0, // 헤더가 줄어들지 않게
          justifyContent: "space-between",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span style={{ color: "#569cd6" }}>// </span>CHAT
        {/* 접기/펼치기 버튼 */}
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: "#858585",
            cursor: "pointer",
            fontSize: "12px",
            padding: "0 2px",
          }}
        >
          {open ? "−" : "+"}
        </button>
      </div>

      {/* ── 메시지 목록 (스크롤 가능) ── */}
      {/*
        flex: 1 → 헤더와 입력창을 제외한 남은 공간을 모두 차지
        overflowY: 'auto' → 내용이 넘치면 세로 스크롤 생성
        minHeight: 0 → flex 컨테이너에서 자식이 최소 크기로 줄어들 수 있게 허용
          (이 속성 없이는 overflow가 작동하지 않을 수 있음)
      */}
      {open && (
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0", minHeight: 0 }}>
          {/* 메시지가 없을 때 안내 문구 */}
          {messages.length === 0 && (
            <div style={{ padding: "8px 12px", fontSize: "11px", color: "#4e4e4e" }}>
              <span style={{ color: "#6a9955" }}>{"// no messages yet"}</span>
            </div>
          )}

          {/* 메시지 목록 렌더링 */}
          {messages.map((m, i) => {
            // 내가 보낸 메시지인지 확인 (닉네임으로 판별)
            const isMe = m.nickname === myNickname;

            // timestamp(밀리초) → "HH:MM" 형식 시각으로 변환
            // toLocaleTimeString: 로컬 시간대에 맞게 자동 변환
            const time = new Date(m.timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            });

            // ── 그룹핑 판단 ──
            const prev = messages[i - 1];
            const prevTime = prev
              ? new Date(prev.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            // 이전 메시지와 같은 사람 + 같은 분이면 헤더 숨김
            const isGrouped = !!prev && prev.nickname === m.nickname && prevTime === time;

            // ── 다음 메시지와도 같은 그룹인지 (시각 표시 위치 조정용) ──
            const next = messages[i + 1];
            const nextTime = next
              ? new Date(next.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            const isLastInGroup = !next || next.nickname !== m.nickname || nextTime !== time;

            return (
              <div
                key={i}
                style={{
                  width: "100%",
                  padding: isGrouped ? "2px 10px" : "6px 10px 1px",
                  fontSize: "12px",
                  lineHeight: "1.6",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                }}
              >
                {/* 닉네임 + 아바타: 그룹 첫 메시지에만 표시 */}
                {!isGrouped && (
                  <span
                    style={{
                      color: isMe ? "#4ec9b0" : "#9cdcfe",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      marginBottom: "2px",
                      flexDirection: isMe ? "row-reverse" : "row",
                    }}
                  >
                    {renderAvatar(m.emoji || (isMe ? myEmoji : ""))}
                    {m.nickname}
                  </span>
                )}

                {/* 말풍선 + 시각 */}
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: isMe ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    gap: "4px",
                    // 그룹 연속 메시지는 왼쪽/오른쪽 여백으로 아바타 너비만큼 들여쓰기
                    ...(isGrouped && {
                      [isMe ? "marginRight" : "marginLeft"]: "0px",
                    }),
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      background: isMe ? "rgba(78,201,176,0.15)" : "rgba(156,220,254,0.1)",
                      border: `1px solid ${isMe ? "rgba(78,201,176,0.25)" : "rgba(156,220,254,0.15)"}`,
                      padding: "5px 10px",
                      borderRadius: isMe
                        ? isGrouped
                          ? "12px 2px 12px 12px"
                          : "12px 2px 12px 12px"
                        : isGrouped
                          ? "2px 12px 12px 12px"
                          : "2px 12px 12px 12px",
                      wordBreak: "break-word",
                    }}
                  >
                    <span style={{ color: "#d4d4d4" }}>{m.text}</span>
                  </div>

                  {/* 시각: 그룹의 마지막 메시지에만 표시 */}
                  {isLastInGroup && (
                    <span style={{ color: "#4e4e4e", fontSize: "10px", whiteSpace: "nowrap" }}>{time}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* 자동 스크롤 앵커: 이 div가 화면에 보이도록 스크롤됩니다 */}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── 입력창 ── */}
      {open && (
        <div style={{ flexShrink: 0 }}>
          {/* 투명도 슬라이더 (토글) */}
          {showOpacity && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 10px",
                borderTop: "1px solid #3e3e42",
                background: "#252526",
              }}
            >
              <span style={{ color: "#6a9955", fontSize: "10px", whiteSpace: "nowrap" }}>opacity</span>
              <input
                type="range"
                min={20}
                max={100}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setChatOpacity(v);
                  localStorage.setItem('study.chatOpacity', String(v)); // 20~100 정수로 저장
                }}
                value={chatOpacity}
                style={{ flex: 1, accentColor: "#4ec9b0", cursor: "pointer" }}
              />
              <span style={{ color: "#858585", fontSize: "10px", width: "28px", textAlign: "right" }}>{chatOpacity}%</span>
            </div>
          )}

          {/* 입력창 */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "6px 8px",
              borderTop: "1px solid #3e3e42",
            }}
          >
            {/* + 버튼 → 슬라이더 토글 */}
            <button
              onClick={() => setShowOpacity((o) => !o)}
              style={{
                background: showOpacity ? "rgba(78,201,176,0.2)" : "transparent",
                border: showOpacity ? "1px solid #4ec9b0" : "1px solid transparent",
                color: showOpacity ? "#4ec9b0" : "#6a9955",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: "1",
                padding: "0 4px",
                borderRadius: "3px",
                flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              +
            </button>

            <input
              style={{ flex: 1, fontSize: "12px", padding: "4px 6px" }}
              placeholder="type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              maxLength={200}
            />

            <button
              className="btn-primary"
              style={{ fontSize: "11px", padding: "4px 10px", flexShrink: 0 }}
              onClick={handleSend}
            >
              send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
