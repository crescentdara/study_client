import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ChatAttachment, ChatMessage, ChatWarningColor, ChatWarnings } from '../types';

interface UsLobbyChatOptions {
  onMessage: (msg: ChatMessage) => void;
  onHistory?: (messages: ChatMessage[]) => void;
  onWarnings?: (warnings: ChatWarnings) => void;
}

export function useLobbyChat({ onMessage, onHistory, onWarnings }: UsLobbyChatOptions) {
  const clientRef    = useRef<Client | null>(null);
  const onMsgRef     = useRef(onMessage);
  const onHistoryRef = useRef(onHistory);
  const onWarningsRef = useRef(onWarnings);
  const [connected, setConnected] = useState(false);

  useEffect(() => { onMsgRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onHistoryRef.current = onHistory; }, [onHistory]);
  useEffect(() => { onWarningsRef.current = onWarnings; }, [onWarnings]);

  useEffect(() => {
    fetch('/api/chat/lobby/history')
      .then((res) => (res.ok ? res.json() : []))
      .then((messages: ChatMessage[]) => onHistoryRef.current?.(messages))
      .catch(() => onHistoryRef.current?.([]));
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

  return { connected, sendChat, changeWarnings };
}
