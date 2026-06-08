import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { StudyStateResponse, StudyMoveRequest, ChatMessage } from '../types';

interface UseWebSocketOptions {
  roomId: string;
  onStudyState: (state: StudyStateResponse) => void;
  onChat: (msg: ChatMessage) => void;
}

export function useWebSocket({ roomId, onStudyState, onChat }: UseWebSocketOptions) {
  const clientRef       = useRef<Client | null>(null);
  const onStudyStateRef = useRef(onStudyState);
  const onChatRef       = useRef(onChat);
  const [connected, setConnected] = useState(false);

  useEffect(() => { onStudyStateRef.current = onStudyState; }, [onStudyState]);
  useEffect(() => { onChatRef.current = onChat; }, [onChat]);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,

      onConnect: () => {
        console.log('[WS] Connected, subscribing to room:', roomId);
        setConnected(true);

        // 게임 상태 구독
        client.subscribe(`/topic/study/${roomId}`, (m: IMessage) => {
          onStudyStateRef.current(JSON.parse(m.body));
        });

        // 채팅 구독 — 이 채널로 서버가 chat 메시지를 브로드캐스트
        client.subscribe(`/topic/chat/${roomId}`, (m: IMessage) => {
          console.log('[WS] Chat received:', m.body);
          onChatRef.current(JSON.parse(m.body));
        });

        // 방 입장 알림
        const sessionId = sessionStorage.getItem('sessionId') ?? '';
        client.publish({
          destination: `/app/study/${roomId}/enter`,
          body: JSON.stringify({ sessionId, moveType: 'ENTER', data: '' }),
        });
      },

      onStompError:  (f) => { console.error('[WS] STOMP error:', f.headers['message']); setConnected(false); },
      onDisconnect:  ()  => { console.log('[WS] Disconnected'); setConnected(false); },
    });

    client.activate();
    clientRef.current = client;
    return () => { client.deactivate(); };
  }, [roomId]);

  const sendMove = useCallback((req: StudyMoveRequest) => {
    const c = clientRef.current;
    if (!c?.connected) { console.warn('[WS] sendMove: not connected'); return; }
    c.publish({ destination: `/app/study/${roomId}/move`, body: JSON.stringify(req) });
  }, [roomId]);

  /**
   * 채팅 전송
   * — `connected` 상태(React state)가 true여야 전송
   * — 서버: @MessageMapping("/study/{roomId}/chat") → /topic/chat/{roomId} 브로드캐스트
   */
  const sendChat = useCallback((text: string, sessionId: string) => {
    const c = clientRef.current;
    if (!c?.connected) {
      console.warn('[WS] sendChat: not connected yet');
      return;
    }
    const body = JSON.stringify({ moveType: 'CHAT', data: text.trim(), sessionId });
    console.log('[WS] sendChat →', body);
    c.publish({ destination: `/app/study/${roomId}/chat`, body });
  }, [roomId]);

  return { connected, sendMove, sendChat };
}
