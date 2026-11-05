import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ChatAttachment, ChatMessage, ChatWarningColor, ChatWarnings } from '../types';

interface UsLobbyChatOptions {
  onMessage: (msg: ChatMessage) => void;
  onHistory?: (messages: ChatMessage[], clearedThrough: number) => void;
  onWarnings?: (warnings: ChatWarnings) => void;
  onClear?: (clearedThrough: number) => void;
}

export function useLobbyChat({ onMessage, onHistory, onWarnings, onClear }: UsLobbyChatOptions) {
  const clientRef    = useRef<Client | null>(null);
  const onMsgRef     = useRef(onMessage);
  const onHistoryRef = useRef(onHistory);
  const onWarningsRef = useRef(onWarnings);
  const onClearRef = useRef(onClear);
  const [connected, setConnected] = useState(false);

  useEffect(() => { onMsgRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onHistoryRef.current = onHistory; }, [onHistory]);
  useEffect(() => { onWarningsRef.current = onWarnings; }, [onWarnings]);
  useEffect(() => { onClearRef.current = onClear; }, [onClear]);

  useEffect(() => {
    fetch('/api/chat/lobby/warnings')
      .then((res) => (res.ok ? res.json() : {}))
      .then((warnings: ChatWarnings) => onWarningsRef.current?.(warnings))
      .catch(() => onWarningsRef.current?.({}));

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe('/topic/lobby/chat', (m: IMessage) => {
          onMsgRef.current(JSON.parse(m.body));
        });
        client.subscribe('/topic/lobby/chat-warnings', (m: IMessage) => {
          onWarningsRef.current?.(JSON.parse(m.body));
        });
        client.subscribe('/topic/lobby/chat-cleared', (m: IMessage) => {
          try {
            const event = JSON.parse(m.body) as { clearedThrough: number };
            if (Number.isSafeInteger(event.clearedThrough)) onClearRef.current?.(event.clearedThrough);
          } catch { console.error('[WS] Invalid chat clear event'); }
        });
        fetch('/api/chat/lobby/history/state')
          .then((res) => { if (!res.ok) throw new Error('Chat history unavailable'); return res.json(); })
          .then((state: { messages: ChatMessage[]; clearedThrough: number }) => onHistoryRef.current?.(state.messages, state.clearedThrough))
          .catch(() => {});
      },
      onDisconnect: () => setConnected(false),
    });
    client.activate();
    clientRef.current = client;
    return () => { client.deactivate(); };
  }, []);

  const changeWarnings = useCallback(async (
    moderatorNickname: string, targetNickname: string, color: ChatWarningColor, action: 'add' | 'remove' | 'clear',
  ) => {
    const response = await fetch(action === 'clear' ? '/api/chat/lobby/warnings/all' : '/api/chat/lobby/warnings', {
      method: action === 'add' ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moderatorNickname, targetNickname, color }),
    });
    if (!response.ok) throw new Error(await response.text() || 'Failed to update warning cards.');
    const warnings = await response.json() as ChatWarnings;
    onWarningsRef.current?.(warnings);
  }, []);

  const clearLobbyHistory = useCallback(async () => {
    const response = await fetch('/api/chat/lobby/history', { method: 'DELETE' });
    if (!response.ok) throw new Error('채팅 초기화에 실패했습니다.');
    const event = await response.json() as { clearedThrough: number };
    if (!Number.isSafeInteger(event.clearedThrough)) throw new Error('채팅 초기화 응답을 확인할 수 없습니다.');
    onClearRef.current?.(event.clearedThrough);
  }, []);

  const sendChat = useCallback((
    text: string, nickname: string, emoji: string, sessionId: string,
    attachment?: ChatAttachment, replyToId?: number,
  ) => {
    const c = clientRef.current;
    if (!c?.connected) return;
    c.publish({
      destination: '/app/study/lobby/chat',
      body: JSON.stringify({
        moveType: 'CHAT',
        data: text.trim(),
        nickname,
        emoji,
        sessionId,
        replyToId,
        ...(attachment ?? { type: 'TEXT' }),
      }),
    });
  }, []);

  return { connected, sendChat, changeWarnings, clearLobbyHistory };
}
