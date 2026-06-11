import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { StudyStateResponse, StudyMoveRequest, ChatAttachment, ChatMessage } from '../types';

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

        client.subscribe(`/topic/study/${roomId}`, (m: IMessage) => {
          onStudyStateRef.current(JSON.parse(m.body));
        });
        client.subscribe(`/topic/chat/${roomId}`, (m: IMessage) => {
          console.log('[WS] Chat received:', m.body);
          onChatRef.current(JSON.parse(m.body));
        });

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

  /** 게임 액션 전송 */
  const sendMove = useCallback((req: StudyMoveRequest) => {
    const c = clientRef.current;
    if (!c?.connected) { console.warn('[WS] sendMove: not connected'); return; }
    c.publish({ destination: `/app/study/${roomId}/move`, body: JSON.stringify(req) });
  }, [roomId]);

  /**
   * 채팅 전송
   * @param text      메시지 내용
   * @param sessionId 발신자 세션 ID
   * @param emoji     발신자가 선택한 이모지 (서버가 ChatMessage에 포함해 브로드캐스트)
   */
  const sendChat = useCallback((text: string, sessionId: string, emoji = '', attachment?: ChatAttachment) => {
    const c = clientRef.current;
    if (!c?.connected) { console.warn('[WS] sendChat: not connected'); return; }
    const body = JSON.stringify({
      moveType: 'CHAT',
      data: text.trim(),
      sessionId,
      emoji,
      ...(attachment ?? { type: 'TEXT' }),
    });
    console.log('[WS] sendChat →', body);
    c.publish({ destination: `/app/study/${roomId}/chat`, body });
  }, [roomId]);

  return { connected, sendMove, sendChat };
}
