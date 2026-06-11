import { useEffect, useRef, useState } from "react";
import { ChatAttachment, ChatMessage } from "../types";

interface ChatProps {
  messages: ChatMessage[];
  myNickname: string;
  myEmoji: string;
  sessionId: string;
  onSend: (text: string, sessionId: string, attachment?: ChatAttachment) => void;
}

const PLAYER_AVATARS: { id: string; src: string | null; label: string }[] = [
  { id: "😀", src: null, label: "😀" },
  { id: "😁", src: null, label: "😁" },
  { id: "👻", src: null, label: "👻" },
  { id: "👽", src: null, label: "👽" },
  { id: "🐷", src: null, label: "🐷" },
  { id: "🐢", src: null, label: "🐢" },
  { id: "ch1", src: "/src/assets/images/ch1.png", label: "😀" },
  { id: "ch2", src: "/src/assets/images/ch2.png", label: "😁" },
  { id: "ch3", src: "/src/assets/images/ch3.png", label: "👻" },
  { id: "ch4", src: "/src/assets/images/ch4.png", label: "👽" },
  { id: "pig", src: "/src/assets/images/dalbit.png", label: "🐷" },
  { id: "ggobuk", src: "/src/assets/images/ggobuk.png", label: "🐢" },
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

export default function Chat({ messages, myNickname, myEmoji, sessionId, onSend }: ChatProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(true);
  const [showOpacity, setShowOpacity] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [chatOpacity, setChatOpacity] = useState<number>(() => {
    const raw = parseFloat(localStorage.getItem("study.chatOpacity") ?? "100");
    const value = raw <= 1 ? Math.round(raw * 100) : raw;
    return Math.max(20, Math.min(100, value));
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text, sessionId);
    setInput("");
  };

  const uploadAndSendImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files can be uploaded.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be 5MB or smaller.");
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
      onSend("", sessionId, { type: "IMAGE", ...uploaded });
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
    const namedFile = file.name
      ? file
      : new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type });
    void uploadAndSendImage(namedFile);
  };

  return (
    <div
      onPaste={handlePaste}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#1e1e1e",
        border: "1px solid #3e3e42",
        height: "100%",
        minHeight: "200px",
        opacity: chatOpacity / 100,
        transition: "opacity 0.2s",
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
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0", minHeight: 0 }}>
          {messages.length === 0 && (
            <div style={{ padding: "8px 12px", fontSize: "11px", color: "#4e4e4e" }}>
              <span style={{ color: "#6a9955" }}>{"// no messages yet"}</span>
            </div>
          )}

          {messages.map((message, index) => {
            const isMe = message.nickname === myNickname;
            const time = new Date(message.timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            });
            const prev = messages[index - 1];
            const prevTime = prev
              ? new Date(prev.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            const isGrouped = !!prev && prev.nickname === message.nickname && prevTime === time;
            const next = messages[index + 1];
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
                key={index}
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
                      background: isMe ? "rgba(78,201,176,0.15)" : "rgba(156,220,254,0.1)",
                      border: `1px solid ${isMe ? "rgba(78,201,176,0.25)" : "rgba(156,220,254,0.15)"}`,
                      padding: "5px 10px",
                      borderRadius: isMe ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
                      wordBreak: "break-word",
                    }}
                  >
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
                      <span style={{ color: "#d4d4d4" }}>{message.text}</span>
                    )}
                  </div>

                  {isLastInGroup && (
                    <span style={{ color: "#4e4e4e", fontSize: "10px", whiteSpace: "nowrap" }}>{time}</span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {open && (
        <div style={{ flexShrink: 0 }}>
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
                padding: "0 4px",
                borderRadius: "3px",
                flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              +
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
              {uploading ? "..." : <svg style={{width: "16px", fill: "#888"}}  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96zM224 176C250.5 176 272 197.5 272 224C272 250.5 250.5 272 224 272C197.5 272 176 250.5 176 224C176 197.5 197.5 176 224 176zM368 288C376.4 288 384.1 292.4 388.5 299.5L476.5 443.5C481 450.9 481.2 460.2 477 467.8C472.8 475.4 464.7 480 456 480L184 480C175.1 480 166.8 475 162.7 467.1C158.6 459.2 159.2 449.6 164.3 442.3L220.3 362.3C224.8 355.9 232.1 352.1 240 352.1C247.9 352.1 255.2 355.9 259.7 362.3L286.1 400.1L347.5 299.6C351.9 292.5 359.6 288.1 368 288.1z"/></svg>}
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

            <input
              style={{ flex: 1, fontSize: "12px", padding: "4px 6px", minWidth: 0 }}
              placeholder={uploading ? "uploading image..." : "type a message..."}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSend()}
              maxLength={200}
              disabled={uploading}
            />

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
    </div>
  );
}
