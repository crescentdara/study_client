import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ChatAttachment, ChatMessage } from '../types';

interface UsLobbyChatOptions {
  onMessage: (msg: ChatMessage) => void;
  onHistory?: (messages: ChatMessage[]) => void;
}

export function useLobbyChat({ onMessage, onHistory }: UsLobbyChatOptions) {
  const clientRef    = useRef<Client | null>(null);
  const onMsgRef     = useRef(onMessage);
  const onHistoryRef = useRef(onHistory);
  const [connected, setConnected] = useState(false);

  useEffect(() => { onMsgRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onHistoryRef.current = onHistory; }, [onHistory]);

  useEffect(() => {
    fetch('/api/chat/lobby/history')
      .then((res) => (res.ok ? res.json() : []))
      .then((messages: ChatMessage[]) => onHistoryRef.current?.(messages))
      .catch(() => onHistoryRef.current?.([]));

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe('/topic/lobby/chat', (m: IMessage) => {
          onMsgRef.current(JSON.parse(m.body));
        });
      },
      onDisconnect: () => setConnected(false),
    });
    client.activate();
    clientRef.current = client;
    return () => { client.deactivate(); };
  }, []);

  const sendChat = useCallback((text: string, nickname: string, emoji: string, sessionId: string, attachment?: ChatAttachment) => {
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
        ...(attachment ?? { type: 'TEXT' }),
      }),
    });
  }, []);

  return { connected, sendChat };
}
