import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { ChatAttachment, ChatMessage } from "../types";
import imgCh1 from '../assets/images/ch1.png';
import imgCh2 from '../assets/images/ch2.png';
import imgCh3 from '../assets/images/ch3.png';
import imgCh4 from '../assets/images/ch4.png';
import imgCh5 from '../assets/images/ch5.png';
import imgCh6 from '../assets/images/ch6.png';
import imgCh7 from '../assets/images/ch7.png';
import imgDalbit from '../assets/images/dalbit.png';
import imgGgobuk from '../assets/images/ggobuk.png';

interface ChatProps {
  messages: ChatMessage[];
  myNickname: string;
  myEmoji: string;
  sessionId: string;
  onSend: (text: string, sessionId: string, attachment?: ChatAttachment, replyToId?: number) => void;
  onClearMessages?: () => void;
  playerNames?: string[];
}

const CHAT_RENDER_LIMIT = 80;

const PLAYER_AVATARS: { id: string; src: string | null; label: string }[] = [
  { id: "ch1", src: imgCh1, label: "😀" },
  { id: "ch2", src: imgCh2, label: "😁" },
  { id: "ch3", src: imgCh3, label: "👻" },
  { id: "pig", src: imgDalbit, label: "🐷" },
  { id: "ggobuk", src: imgGgobuk, label: "🐢" },
  { id: "ch4", src: imgCh4, label: "👽" },
  { id: "ch5", src: imgCh5, label: "🎉" },
  { id: "ch6", src: imgCh6, label: "😊" },
  { id: "ch7", src: imgCh7, label: "💖" },
];

const renderAvatar = (emojiId: string, size = 16) => {
  const avatar = PLAYER_AVATARS.find((a) => a.id === emojiId);
  if (!avatar) return <span>{emojiId}</span>;
  return avatar.src ? (
    <img
      src={avatar.src}
      alt={avatar.label}
      style={{ width: size, height: size, objectFit: "contain", verticalAlign: "middle" }}
    />
  ) : (
    <span style={{ fontSize: size }}>{avatar.label}</span>
  );
};

// Render text with @mention highlighted
function renderWithMentions(text: string, myNickname: string) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const name = part.slice(1);
      const isMe = name === myNickname;
      return (
        <span key={i} style={{
          color: isMe ? "#ff9e3b" : "#569cd6",
          fontWeight: 700,
          background: isMe ? "rgba(255,158,59,0.12)" : "rgba(86,156,214,0.12)",
          borderRadius: 3, padding: "0 2px",
        }}>{part}</span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function Chat({ messages, myNickname, myEmoji, sessionId, onSend, onClearMessages, playerNames = [] }: ChatProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(true);
  const [showOpacity, setShowOpacity] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [previewImage, setPreviewImage] = useState<{ url: string; fileName?: string } | null>(null);
  const [nicknameMenu, setNicknameMenu] = useState<{ nickname: string; x: number; y: number } | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [chatOpacity, setChatOpacity] = useState<number>(() => {
    const raw = parseFloat(localStorage.getItem("study.chatOpacity") ?? "100");
    const value = raw <= 1 ? Math.round(raw * 100) : raw;
    return Math.max(20, Math.min(100, value));
  });
  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAt, setMentionAt] = useState(0); // index of '@' in input
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickToBottomRef = useRef(true);
  const previousLatestMessageKeyRef = useRef("");

  const allMessages = useMemo(() => [...messages, ...localMessages], [messages, localMessages]);
  const visibleMessages = useMemo(() => allMessages.slice(-CHAT_RENDER_LIMIT), [allMessages]);
  const latestMessageKey = useMemo(() => {
    const latest = allMessages[allMessages.length - 1];
    return latest ? `${latest.timestamp}-${latest.nickname}-${latest.text}-${latest.imageUrl ?? ""}` : "";
  }, [allMessages]);
  const mentionCandidates = useMemo(() => (
    mentionQuery !== null
      ? playerNames.filter(n => n !== myNickname && n.toLowerCase().startsWith(mentionQuery.toLowerCase()))
      : []
  ), [mentionQuery, myNickname, playerNames]);
  const voiceMatch = input.match(/(^|\s)(\/v(?:o(?:i(?:c(?:e)?)?)?)?)$/i);
  const voiceCompletion = voiceMatch && "/voice".startsWith(voiceMatch[2].toLowerCase())
    ? "/voice".slice(voiceMatch[2].length)
    : "";

  useEffect(() => {
    const hasNewLatest = latestMessageKey !== "" && latestMessageKey !== previousLatestMessageKeyRef.current;
    previousLatestMessageKeyRef.current = latestMessageKey;

    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    } else if (hasNewLatest) {
      setUnreadCount((count) => count + 1);
    }
  }, [latestMessageKey, visibleMessages.length]);

  const updateStickToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (stickToBottomRef.current) setUnreadCount(0);
  };

  const scrollToBottom = () => {
    stickToBottomRef.current = true;
    setUnreadCount(0);
    bottomRef.current?.scrollIntoView({ block: "end" });
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    if (handleCommand(text)) {
      setInput("");
      setMentionQuery(null);
      return;
    }
    onSend(text, sessionId, undefined, replyTarget?.id);
    setInput("");
    setMentionQuery(null);
    setReplyTarget(null);
  };

  const cancelReply = () => setReplyTarget(null);

  const addSystemMessage = (text: string) => {
    const message: ChatMessage = {
      nickname: "system",
      text,
      timestamp: Date.now(),
      emoji: "",
      type: "TEXT",
    };
    setLocalMessages((prev) => [...prev, message].slice(-20));
  };

  const handleCommand = (text: string) => {
    if (!text.startsWith("/")) return false;
    const lower = text.toLowerCase();
    if (lower === "/help") {
      addSystemMessage("commands: /help, /clear, /opacity, /voice @nickname message");
      return true;
    }
    if (lower === "/clear") {
      onClearMessages?.();
      setLocalMessages([]);
      window.setTimeout(() => addSystemMessage("chat cleared locally"), 0);
      return true;
    }
    if (lower === "/opacity") {
      setShowOpacity(true);
      addSystemMessage("opacity control opened");
      return true;
    }
    if (lower.startsWith("/voice")) {
      if (!/^\/voice\s+@\S+\s+.+/i.test(text)) {
        addSystemMessage("usage: /voice @nickname message");
        return true;
      }
      return false;
    }
    addSystemMessage(`unknown command: ${text}`);
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    // detect @mention typing
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@(\S*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionAt(before.lastIndexOf("@"));
    } else {
      setMentionQuery(null);
    }
  };

  const applyMention = (name: string) => {
    const before = input.slice(0, mentionAt);
    const after = input.slice(mentionAt + 1 + (mentionQuery?.length ?? 0));
    const newVal = `${before}@${name} ${after}`;
    setInput(newVal);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const applyVoiceCompletion = () => {
    const match = input.match(/(^|\s)(\/v(?:o(?:i(?:c(?:e)?)?)?)?)$/i);
    if (!match || !"/voice".startsWith(match[2].toLowerCase())) return false;
    const start = input.slice(0, input.length - match[2].length);
    setInput(`${start}/voice `);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
    return true;
  };

  const insertInputPrefix = (prefix: string) => {
    setInput(prefix);
    setMentionQuery(null);
    setNicknameMenu(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const nicknameActions = useMemo(() => [
    {
      id: "voice",
      label: "voice mention",
      run: (nickname: string) => insertInputPrefix(`/voice @${nickname} `),
    },
  ], []);

  const uploadAndSendImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files can be uploaded.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be 10MB or smaller.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/uploads/images", { method: "POST", body: form });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to upload image.");
      }
      const uploaded = (await response.json()) as Omit<ChatAttachment, "type">;
      onSend("", sessionId, { type: "IMAGE", ...uploaded }, replyTarget?.id);
      setReplyTarget(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith("image/"));
    if (!item) return;

    const file = item.getAsFile();
    if (!file) return;

    event.preventDefault();
    const ext = file.type.split("/")[1] || "png";
    const namedFile = file.name ? file : new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type });
    void uploadAndSendImage(namedFile);
  };

  return (
    <div
      onPaste={handlePaste}
      onClick={() => setNicknameMenu(null)}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#1e1e1e",
        border: "1px solid #3e3e42",
        height: "100%",
        minHeight: "200px",
        opacity: chatOpacity / 100,
        transition: "opacity 0.2s",
        position: "relative",
      }}
    >
      <div
        style={{
          padding: "4px 10px",
          background: "#252526",
          borderBottom: "1px solid #3e3e42",
          fontSize: "11px",
          color: "#858585",
          letterSpacing: "1px",
          textTransform: "uppercase",
          flexShrink: 0,
          justifyContent: "space-between",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span>
          <span style={{ color: "#569cd6" }}>// </span>CHAT
        </span>
        <button
          onClick={() => setOpen((value) => !value)}
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

      {open && (
        <div
          ref={scrollRef}
          onScroll={updateStickToBottom}
          style={{ flex: 1, overflowY: "auto", padding: "6px 0 18px", minHeight: 0, scrollPaddingBottom: 18 }}
        >
          {allMessages.length === 0 && (
            <div style={{ padding: "8px 12px", fontSize: "11px", color: "#4e4e4e" }}>
              <span style={{ color: "#6a9955" }}>{"// no messages yet"}</span>
            </div>
          )}

          {visibleMessages.map((message, index) => (
            <ChatMessageItem
              key={`${message.timestamp}-${message.nickname}-${message.text}-${message.imageUrl ?? ""}-${index}`}
              message={message}
              prev={visibleMessages[index - 1]}
              next={visibleMessages[index + 1]}
              myNickname={myNickname}
              myEmoji={myEmoji}
              onPreview={setPreviewImage}
              onReply={setReplyTarget}
              onNicknameClick={(nickname, event) => {
                event.stopPropagation();
                setNicknameMenu({ nickname, x: event.clientX, y: event.clientY });
              }}
            />
          ))}
          {false && visibleMessages.map((message, index) => {
            const isMe = message.nickname === myNickname;
            const time = new Date(message.timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            });
            const prev = visibleMessages[index - 1];
            const prevTime = prev
              ? new Date(prev.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            const isGrouped = !!prev && prev.nickname === message.nickname && prevTime === time;
            const mentionsMe = message.mentionedNickname === myNickname;
            const next = visibleMessages[index + 1];
            const nextTime = next
              ? new Date(next.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            const isLastInGroup = !next || next.nickname !== message.nickname || nextTime !== time;

            return (
              <div
                key={`${message.timestamp}-${message.nickname}-${message.text}-${message.imageUrl ?? ""}-${index}`}
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
                    {renderAvatar(message.emoji || (isMe ? myEmoji : ""))}
                    {message.nickname}
                  </span>
                )}

                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: isMe ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      background: mentionsMe
                        ? "rgba(255,158,59,0.12)"
                        : isMe ? "rgba(78,201,176,0.15)" : "rgba(156,220,254,0.1)",
                      border: `1px solid ${mentionsMe ? "rgba(255,158,59,0.5)" : isMe ? "rgba(78,201,176,0.25)" : "rgba(156,220,254,0.15)"}`,
                      padding: "5px 10px",
                      borderRadius: isMe ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
                      wordBreak: "break-word",
                    }}
                  >
                    {mentionsMe && (
                      <div style={{ color: "#ff9e3b", fontSize: "9px", marginBottom: 2, fontWeight: 700 }}>
                        📣 나를 멘션
                      </div>
                    )}
                    {message.type === "IMAGE" && message.imageUrl ? (
                      <a href={message.imageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                        <img
                          src={message.imageUrl}
                          alt={message.fileName || "uploaded image"}
                          style={{
                            display: "block",
                            maxWidth: "100%",
                            maxHeight: "220px",
                            borderRadius: "3px",
                            objectFit: "contain",
                          }}
                        />
                        {message.fileName && (
                          <span style={{ display: "block", marginTop: "4px", color: "#858585", fontSize: "10px" }}>
                            {message.fileName}
                          </span>
                        )}
                      </a>
                    ) : (
                      <span style={{ color: "#d4d4d4" }}>
                        {renderWithMentions(message.text, myNickname)}
                      </span>
                    )}
                  </div>

                  {isLastInGroup && (
                    <span style={{ color: "#4e4e4e", fontSize: "10px", whiteSpace: "nowrap" }}>{time}</span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} style={{ height: 8 }} />
        </div>
      )}

      {open && unreadCount > 0 && (
        <button
          onClick={scrollToBottom}
          style={{
            position: "absolute",
            right: 12,
            bottom: 48,
            zIndex: 3,
            border: "1px solid rgba(78,201,176,0.45)",
            borderRadius: 999,
            background: "#1f3a35",
            color: "#b7fff1",
            fontSize: 11,
            padding: "4px 10px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
        >
          {unreadCount} new messages
        </button>
      )}
      {nicknameMenu && (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: nicknameMenu.x,
            top: nicknameMenu.y + 6,
            zIndex: 2100,
            minWidth: 150,
            border: "1px solid #3e3e42",
            background: "#252526",
            boxShadow: "0 8px 20px rgba(0,0,0,0.45)",
            padding: 4,
            fontSize: 12,
          }}
        >
          <div style={{ padding: "5px 8px", color: "#858585", borderBottom: "1px solid #3e3e42", marginBottom: 3 }}>
            @{nicknameMenu.nickname}
          </div>
          {nicknameActions.map((action) => (
            <button
              key={action.id}
              onClick={() => action.run(nicknameMenu.nickname)}
              style={{
                width: "100%",
                display: "block",
                textAlign: "left",
                border: 0,
                background: "transparent",
                color: "#d4d4d4",
                padding: "6px 8px",
                cursor: "pointer",
                fontSize: 12,
              }}
              onMouseEnter={(event) => { event.currentTarget.style.background = "#37373d"; }}
              onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div style={{ flexShrink: 0 }}>
          {replyTarget && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 10px",
                borderTop: "1px solid #3e3e42",
                background: "#252526",
              }}
            >
              <span style={{ color: "#569cd6", fontSize: "11px", flexShrink: 0 }}>↩</span>
              <span style={{ color: "#9cdcfe", fontSize: "11px", flexShrink: 0 }}>{replyTarget.nickname}</span>
              <span
                style={{
                  color: "#858585",
                  fontSize: "11px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {replyTarget.type === "IMAGE" ? "사진" : replyTarget.text}
              </span>
              <button
                onClick={cancelReply}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#858585",
                  cursor: "pointer",
                  fontSize: "13px",
                  padding: "0 3px",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          )}

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
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setChatOpacity(value);
                  localStorage.setItem("study.chatOpacity", String(value));
                }}
                value={chatOpacity}
                style={{ flex: 1, accentColor: "#4ec9b0", cursor: "pointer" }}
              />
              <span style={{ color: "#858585", fontSize: "10px", width: "28px", textAlign: "right" }}>
                {chatOpacity}%
              </span>
            </div>
          )}

          {uploadError && (
            <div style={{ padding: "4px 10px", borderTop: "1px solid #3e3e42", color: "#f14c4c", fontSize: "10px" }}>
              {uploadError}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "6px 8px",
              borderTop: "1px solid #3e3e42",
            }}
          >
            <button
              onClick={() => setShowOpacity((value) => !value)}
              style={{
                background: showOpacity ? "rgba(78,201,176,0.2)" : "transparent",
                border: showOpacity ? "1px solid #4ec9b0" : "1px solid transparent",
                color: showOpacity ? "#4ec9b0" : "#6a9955",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: "1",
                padding: "0 3px",
                borderRadius: "3px",
                flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              <svg style={{ width: "16px", fill: "#888" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                <path d="M96 128C78.3 128 64 142.3 64 160C64 177.7 78.3 192 96 192L182.7 192C195 220.3 223.2 240 256 240C288.8 240 317 220.3 329.3 192L544 192C561.7 192 576 177.7 576 160C576 142.3 561.7 128 544 128L329.3 128C317 99.7 288.8 80 256 80C223.2 80 195 99.7 182.7 128L96 128zM96 288C78.3 288 64 302.3 64 320C64 337.7 78.3 352 96 352L342.7 352C355 380.3 383.2 400 416 400C448.8 400 477 380.3 489.3 352L544 352C561.7 352 576 337.7 576 320C576 302.3 561.7 288 544 288L489.3 288C477 259.7 448.8 240 416 240C383.2 240 355 259.7 342.7 288L96 288zM96 448C78.3 448 64 462.3 64 480C64 497.7 78.3 512 96 512L150.7 512C163 540.3 191.2 560 224 560C256.8 560 285 540.3 297.3 512L544 512C561.7 512 576 497.7 576 480C576 462.3 561.7 448 544 448L297.3 448C285 419.7 256.8 400 224 400C191.2 400 163 419.7 150.7 448L96 448z" />
              </svg>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload image or paste with Ctrl+V"
              style={{
                background: uploading ? "rgba(86,156,214,0.18)" : "transparent",
                border: "1px solid transparent",
                color: uploading ? "#569cd6" : "#9cdcfe",
                cursor: uploading ? "default" : "pointer",
                fontSize: "11px",
                padding: "0 3px",
                borderRadius: "3px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {uploading ? (
                "..."
              ) : (
                <svg style={{ width: "16px", fill: "#888" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                  <path d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96zM224 176C250.5 176 272 197.5 272 224C272 250.5 250.5 272 224 272C197.5 272 176 250.5 176 224C176 197.5 197.5 176 224 176zM368 288C376.4 288 384.1 292.4 388.5 299.5L476.5 443.5C481 450.9 481.2 460.2 477 467.8C472.8 475.4 464.7 480 456 480L184 480C175.1 480 166.8 475 162.7 467.1C158.6 459.2 159.2 449.6 164.3 442.3L220.3 362.3C224.8 355.9 232.1 352.1 240 352.1C247.9 352.1 255.2 355.9 259.7 362.3L286.1 400.1L347.5 299.6C351.9 292.5 359.6 288.1 368 288.1z" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadAndSendImage(file);
              }}
            />

            <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
              {mentionCandidates.length > 0 && (
                <div style={{
                  position: "absolute", bottom: "100%", left: 0, right: 0,
                  background: "#252526", border: "1px solid #569cd6",
                  borderRadius: 6, marginBottom: 4, zIndex: 100,
                  boxShadow: "0 -4px 12px rgba(0,0,0,0.4)",
                  overflow: "hidden",
                }}>
                  {mentionCandidates.map(name => (
                    <div
                      key={name}
                      onMouseDown={e => { e.preventDefault(); applyMention(name); }}
                      style={{
                        padding: "6px 12px", cursor: "pointer",
                        color: "#9cdcfe", fontSize: 12,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#1e2533")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      📣 @{name}
                    </div>
                  ))}
                </div>
              )}
              {voiceCompletion && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    padding: "4px 6px",
                    boxSizing: "border-box",
                    fontSize: "12px",
                    color: "transparent",
                    pointerEvents: "none",
                    whiteSpace: "pre",
                    overflow: "hidden",
                  }}
                >
                  <span>{input}</span>
                  <span style={{ color: "#6a6a6a" }}>{voiceCompletion}</span>
                </div>
              )}
              <input
                ref={inputRef}
                style={{ width: "100%", fontSize: "12px", padding: "4px 6px", boxSizing: "border-box", position: "relative", background: "transparent" }}
                placeholder={uploading ? "uploading image..." : "@닉네임 메시지 또는 일반 채팅..."}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(event) => {
                  if (event.key === "Escape") { setMentionQuery(null); return; }
                  if (event.key === "Tab" && applyVoiceCompletion()) { event.preventDefault(); return; }
                  if (event.key === "Enter") handleSend();
                }}
                maxLength={200}
                disabled={uploading}
              />
            </div>

            <button
              className="btn-primary"
              style={{ fontSize: "11px", padding: "4px 10px", flexShrink: 0 }}
              onClick={handleSend}
              disabled={uploading}
            >
              send
            </button>
          </div>
        </div>
      )}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(0,0,0,0.72)",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: "88vw",
              maxHeight: "88vh",
              border: "1px solid #3e3e42",
              background: "#1e1e1e",
              boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 10px", borderBottom: "1px solid #3e3e42", color: "#858585", fontSize: 11 }}>
              <span style={{ color: "#569cd6" }}>image.preview</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewImage.fileName || "uploaded image"}</span>
              <button className="btn-secondary" style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px" }} onClick={() => setPreviewImage(null)}>close</button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.fileName || "uploaded image"}
              style={{ display: "block", maxWidth: "88vw", maxHeight: "calc(88vh - 34px)", objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const ChatMessageItem = memo(function ChatMessageItem({
  message,
  prev,
  next,
  myNickname,
  myEmoji,
  onPreview,
  onReply,
  onNicknameClick,
}: {
  message: ChatMessage;
  prev?: ChatMessage;
  next?: ChatMessage;
  myNickname: string;
  myEmoji: string;
  onPreview: (image: { url: string; fileName?: string }) => void;
  onReply: (message: ChatMessage) => void;
  onNicknameClick: (nickname: string, event: ReactMouseEvent<HTMLElement>) => void;
}) {
  const isMe = message.nickname === myNickname;
  const time = new Date(message.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const prevTime = prev
    ? new Date(prev.timestamp).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const nextTime = next
    ? new Date(next.timestamp).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const isGrouped = !!prev && prev.nickname === message.nickname && prevTime === time;
  const mentionsMe = message.mentionedNickname === myNickname;
  const isLastInGroup = !next || next.nickname !== message.nickname || nextTime !== time;
  const accentColor = mentionsMe ? "#ff9e3b" : isMe ? "#4ec9b0" : "#9cdcfe";

  if (message.nickname === "system") {
    return (
      <div style={{ padding: "4px 10px", fontSize: "11px", color: "#858585", lineHeight: 1.5 }}>
        <span style={{ color: "#6a9955" }}>// </span>{message.text}
      </div>
    );
  }

  return (
    <div
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
      {!isGrouped && (
        <span
          onClick={(event) => {
            if (message.nickname !== "system") onNicknameClick(message.nickname, event);
          }}
          style={{
            color: isMe ? "#4ec9b0" : "#9cdcfe",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            marginBottom: "2px",
            flexDirection: isMe ? "row-reverse" : "row",
            cursor: message.nickname === "system" ? "default" : "pointer",
          }}
        >
          {renderAvatar(message.emoji || (isMe ? myEmoji : ""))}
          {message.nickname}
        </span>
      )}

      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: isMe ? "row-reverse" : "row",
          alignItems: "flex-end",
          gap: "4px",
        }}
      >
        <div
          onClick={(event) => {
            event.stopPropagation();
            if (message.id != null) onReply(message);
          }}
          title={message.id != null ? "클릭하여 답글 달기" : undefined}
          style={{
            maxWidth: "80%",
            background: mentionsMe
              ? "rgba(255,158,59,0.12)"
              : isMe ? "rgba(78,201,176,0.15)" : "rgba(156,220,254,0.1)",
            border: `1px solid ${mentionsMe ? "rgba(255,158,59,0.5)" : isMe ? "rgba(78,201,176,0.25)" : "rgba(156,220,254,0.15)"}`,
            padding: "5px 10px",
            borderRadius: isMe ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
            wordBreak: "break-word",
            cursor: message.id != null ? "pointer" : "default",
          }}
        >
          {message.replyToId != null && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1px",
                padding: "3px 7px",
                marginBottom: "4px",
                borderLeft: `2px solid ${accentColor}`,
                background: "rgba(0,0,0,0.18)",
                borderRadius: "4px",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, color: accentColor }}>
                {message.replyToNickname ?? "알 수 없음"}
              </span>
              <span
                style={{
                  fontSize: "10.5px",
                  color: "#a8a8a8",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "220px",
                }}
              >
                {message.replyToText ?? "삭제되었거나 찾을 수 없는 메시지"}
              </span>
            </div>
          )}
          {mentionsMe && (
            <div style={{ color: "#ff9e3b", fontSize: "9px", marginBottom: 2, fontWeight: 700 }}>
              Mentioned you
            </div>
          )}
          {message.type === "IMAGE" && message.imageUrl ? (
            <a
              href={message.imageUrl}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onPreview({ url: message.imageUrl || "", fileName: message.fileName });
              }}
              style={{ textDecoration: "none", cursor: "zoom-in" }}
            >
              <img
                src={message.imageUrl}
                alt={message.fileName || "uploaded image"}
                loading="lazy"
                decoding="async"
                style={{
                  display: "block",
                  maxWidth: "100%",
                  maxHeight: "220px",
                  borderRadius: "3px",
                  objectFit: "contain",
                }}
              />
              {message.fileName && (
                <span style={{ display: "block", marginTop: "4px", color: "#858585", fontSize: "10px" }}>
                  {message.fileName}
                </span>
              )}
            </a>
          ) : (
            <span style={{ color: "#d4d4d4" }}>
              {renderWithMentions(message.text, myNickname)}
            </span>
          )}
        </div>

        {isLastInGroup && (
          <span style={{ color: "#4e4e4e", fontSize: "10px", whiteSpace: "nowrap" }}>{time}</span>
        )}
      </div>
    </div>
  );
});

export default memo(Chat);
