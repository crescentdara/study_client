import { useState, useEffect, useCallback } from 'react';

export interface ToastItem {
  id: number;
  senderEmoji: string;
  senderNickname: string;
  message: string;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 5000;

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20,
      zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // mount animation
    const show = setTimeout(() => setVisible(true), 10);
    // auto-dismiss
    const hide = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, AUTO_DISMISS_MS);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [toast.id, onDismiss]);

  return (
    <div
      onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 300); }}
      style={{
        pointerEvents: 'auto',
        background: '#1e1e1e',
        border: '1px solid #569cd6',
        borderLeft: '4px solid #569cd6',
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 260, maxWidth: 340,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        cursor: 'pointer',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{toast.senderEmoji || '💬'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#569cd6', fontSize: 12, fontWeight: 700, marginBottom: 3 }}>
            📣 {toast.senderNickname}
          </div>
          <div style={{
            color: '#d4d4d4', fontSize: 13,
            wordBreak: 'break-word', lineHeight: 1.4,
          }}>
            {toast.message}
          </div>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{
        marginTop: 8, height: 2,
        background: '#3e3e42', borderRadius: 1, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: '#569cd6',
          animation: `toastProgress ${AUTO_DISMISS_MS}ms linear forwards`,
        }} />
      </div>
    </div>
  );
}

// Voice notification. Only runs for explicit /voice mentions.
let _lastVoiceAt = 0;

function playMentionSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.connect(ctx.destination);

    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.1);
    });
  } catch {
    // Audio can be blocked before user interaction.
  }
}

function speakMention(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    const now = Date.now();
    if (now - _lastVoiceAt < 3000) return;
    _lastVoiceAt = now;
    window.speechSynthesis.cancel();
    const safeText = text.trim().slice(0, 80);
    if (!safeText) return;
    const utterance = new SpeechSynthesisUtterance(safeText);
    utterance.lang = 'ko-KR';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis can be blocked before user interaction.
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

let _nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((senderEmoji: string, senderNickname: string, message: string, voiceText?: string) => {
    const id = _nextId++;
    const inlineVoiceText = message.startsWith('/voice') ? message.slice('/voice'.length).trim() : '';
    const spokenText = voiceText || inlineVoiceText;
    const displayMessage = inlineVoiceText ? inlineVoiceText : message;
    setToasts(prev => [...prev, { id, senderEmoji, senderNickname, message: displayMessage }].slice(-5));
    if (spokenText) {
      speakMention(spokenText);
    } else {
      playMentionSound();
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, dismiss };
}
