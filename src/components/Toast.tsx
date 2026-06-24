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

// ── Tab title flash ───────────────────────────────────────────────────────

const ORIGINAL_TITLE = document.title;
let _flashInterval: ReturnType<typeof setInterval> | null = null;
let _unreadCount = 0;

function startTitleFlash(senderNickname: string) {
  _unreadCount++;
  updateFaviconBadge(_unreadCount);

  if (_flashInterval) return; // already flashing
  let toggle = false;
  _flashInterval = setInterval(() => {
    document.title = toggle
      ? `📣 ${senderNickname}의 멘션!`
      : `(${_unreadCount}) ${ORIGINAL_TITLE}`;
    toggle = !toggle;
  }, 1000);
}

function stopTitleFlash() {
  if (_flashInterval) { clearInterval(_flashInterval); _flashInterval = null; }
  document.title = ORIGINAL_TITLE;
  _unreadCount = 0;
  updateFaviconBadge(0);
}

// ── Favicon badge ─────────────────────────────────────────────────────────

let _faviconLink: HTMLLinkElement | null = null;

function getFaviconLink(): HTMLLinkElement {
  if (!_faviconLink) {
    _faviconLink = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
      ?? (() => {
        const el = document.createElement('link');
        el.rel = 'icon'; document.head.appendChild(el); return el;
      })();
  }
  return _faviconLink;
}

function updateFaviconBadge(count: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw base favicon letter
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#569cd6';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', 16, 17);

  if (count > 0) {
    // Red badge circle
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(24, 8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count > 9 ? '9+' : String(count), 24, 8);
  }

  getFaviconLink().href = canvas.toDataURL();
}

// ── Notification sound (no permission needed) ─────────────────────────────

function playMentionSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.connect(ctx.destination);

    // Two-tone ping
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.1);
    });
  } catch {
    // AudioContext might be blocked before user gesture — silently ignore
  }
}

// Stop flash when user returns to tab
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') stopTitleFlash();
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────

let _nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((senderEmoji: string, senderNickname: string, message: string) => {
    const id = _nextId++;
    setToasts(prev => [...prev, { id, senderEmoji, senderNickname, message }]);
    playMentionSound();
    if (document.visibilityState !== 'visible') {
      startTitleFlash(senderNickname);
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, dismiss };
}
