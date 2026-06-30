import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ChatAttachment, ChatMessage } from '../types';

interface UsLobbyChatOptions {
  onMessage: (msg: ChatMessage) => void;
  onHistory?: (messages: ChatMessage[]) => void;
  roomId?: string | null;
}

export function useLobbyChat({ onMessage, onHistory, roomId }: UsLobbyChatOptions) {
  const clientRef    = useRef<Client | null>(null);
  const onMsgRef     = useRef(onMessage);
  const onHistoryRef = useRef(onHistory);
  const [connected, setConnected] = useState(false);

  useEffect(() => { onMsgRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onHistoryRef.current = onHistory; }, [onHistory]);

  useEffect(() => {
    const historyUrl = roomId ? `/api/chat/rooms/${roomId}/history` : '/api/chat/lobby/history';
    fetch(historyUrl)
      .then((res) => (res.ok ? res.json() : []))
      .then((messages: ChatMessage[]) => onHistoryRef.current?.(messages))
      .catch(() => onHistoryRef.current?.([]));

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(roomId ? `/topic/chat/${roomId}` : '/topic/lobby/chat', (m: IMessage) => {
          onMsgRef.current(JSON.parse(m.body));
        });
      },
      onDisconnect: () => setConnected(false),
    });
    client.activate();
    clientRef.current = client;
    return () => { client.deactivate(); };
  }, [roomId]);

  const sendChat = useCallback((text: string, nickname: string, emoji: string, sessionId: string, attachment?: ChatAttachment) => {
    const c = clientRef.current;
    if (!c?.connected) return;
    c.publish({
      destination: roomId ? `/app/study/${roomId}/chat` : '/app/study/lobby/chat',
      body: JSON.stringify({
        moveType: 'CHAT',
        data: text.trim(),
        nickname,
        emoji,
        sessionId,
        ...(attachment ?? { type: 'TEXT' }),
      }),
    });
  }, [roomId]);

  return { connected, sendChat };
}
