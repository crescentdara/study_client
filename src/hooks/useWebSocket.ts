import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { StudyStateResponse, StudyMoveRequest } from '../types';

interface UseWebSocketOptions {
  roomId: string;
  onStudyState: (state: StudyStateResponse) => void;
  onSecretState?: (state: StudyStateResponse) => void;
}

export function useWebSocket({ roomId, onStudyState, onSecretState }: UseWebSocketOptions) {
  const clientRef       = useRef<Client | null>(null);
  const onStudyStateRef = useRef(onStudyState);
  const onSecretStateRef = useRef(onSecretState);
  const [connected, setConnected] = useState(false);

  useEffect(() => { onStudyStateRef.current = onStudyState; }, [onStudyState]);
  useEffect(() => { onSecretStateRef.current = onSecretState; }, [onSecretState]);

  useEffect(() => {
    const parseMessage = (message: IMessage, label: string) => {
      try {
        return JSON.parse(message.body) as StudyStateResponse;
      } catch (error) {
        console.error(`[WS] Failed to parse ${label} message:`, error, message.body);
        return null;
      }
    };

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        console.log('[WS] Connected, subscribing to room:', roomId);
        setConnected(true);

        client.subscribe(`/topic/study/${roomId}`, (m: IMessage) => {
          const state = parseMessage(m, 'study');
          if (state) onStudyStateRef.current(state);
        });

        const sessionId = sessionStorage.getItem('sessionId') ?? '';
        if (sessionId) {
          client.subscribe(`/topic/study/${roomId}/secret/${sessionId}`, (m: IMessage) => {
            const state = parseMessage(m, 'secret');
            if (state) onSecretStateRef.current?.(state);
          });
        }
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
  return { connected, sendMove };
}
