import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

type Address = { ip: string; nickname: string; connections: number };
type Arrival = { id: string; nickname: string };

const makeId = () => typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function usePresence(nickname: string) {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [connected, setConnected] = useState(false);
    const [ready, setReady] = useState(false);
    const [arrivals, setArrivals] = useState<Arrival[]>([]);
    const clientRef = useRef<Client | null>(null);
    const nicknameRef = useRef(nickname);
    const readyRef = useRef(false);
    const identityRef = useRef({ browserId: '', notificationId: '', visitId: '' });
    nicknameRef.current = nickname;

    useEffect(() => {
        const client = clientRef.current;
        if (client?.connected) client.publish({ destination: '/app/presence/register', body: JSON.stringify({ nickname, ...identityRef.current }) });
    }, [nickname]);

    useEffect(() => {
        let active = true;
        let browserId = localStorage.getItem('study.presence.browserId');
        if (!browserId) {
            browserId = makeId();
            localStorage.setItem('study.presence.browserId', browserId);
        }
        let visitId = sessionStorage.getItem('study.presence.visitId');
        if (!visitId) {
            visitId = makeId();
            sessionStorage.setItem('study.presence.visitId', visitId);
        }
        identityRef.current = { browserId, notificationId: makeId(), visitId };
        const register = () => client.publish({ destination: '/app/presence/register', body: JSON.stringify({ nickname: nicknameRef.current, ...identityRef.current }) });
        const refresh = () => {
            fetch('/api/presence/ips').then(response => {
                if (!response.ok) throw new Error('Presence unavailable');
                return response.json() as Promise<Address[]>;
            }).then(data => { if (active) setAddresses(data); }).catch(() => {});
        };
        const client = new Client({
            webSocketFactory: () => new SockJS('/ws'),
            reconnectDelay: 5000,
            onConnect: () => {
                setConnected(true);
                readyRef.current = false;
                setReady(false);
                client.subscribe('/topic/presence/ips', message => {
                    try { setAddresses(JSON.parse(message.body) as Address[]); } catch { refresh(); }
                });
                client.subscribe(`/topic/presence/arrivals/${identityRef.current.notificationId}`, message => {
                    try {
                        const arrival = JSON.parse(message.body) as { nickname: string };
                        if (active && typeof arrival.nickname === 'string') setArrivals(items => [...items, { id: makeId(), nickname: arrival.nickname }].slice(-5));
                    } catch { /* Ignore malformed notifications. */ }
                });
                client.subscribe(`/topic/presence/ready/${identityRef.current.notificationId}`, () => {
                    if (!active) return;
                    readyRef.current = true;
                    setReady(true);
                });
                register();
                refresh();
            },
            onWebSocketClose: () => { readyRef.current = false; setConnected(false); setReady(false); },
            onStompError: () => { readyRef.current = false; setConnected(false); setReady(false); },
        });
        clientRef.current = client;
        client.activate();
        const timer = window.setInterval(refresh, 5000);
        const heartbeat = window.setInterval(() => {
            if (client.connected) register();
        }, 30000);
        const readyRetry = window.setInterval(() => { if (client.connected && !readyRef.current) register(); }, 2000);
        return () => { active = false; clientRef.current = null; window.clearInterval(timer); window.clearInterval(heartbeat); window.clearInterval(readyRetry); void client.deactivate(); };
    }, []);

    return { addresses, connected, ready, arrivals, dismissArrival: (id: string) => setArrivals(items => items.filter(item => item.id !== id)) };
}

export default function PresencePanel({ addresses, connected }: { addresses: Address[]; connected: boolean }) {
    const [expanded, setExpanded] = useState(false);
    return <>
        <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
            style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '3px 10px',
                fontSize: 11, color: '#bbb', cursor: 'pointer', textAlign: 'left', border: 0,
                borderTop: '1px solid #3e3e42', background: 'transparent' }}>
            <span style={{ fontSize: 9, color: '#666', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
            <span>CONNECTED IPS</span>
            <span style={{ marginLeft: 'auto', color: connected ? '#555' : '#ce9178', fontSize: 10 }}>
                {connected ? addresses.length : '연결 중'}
            </span>
        </button>
        {expanded && <div style={{ padding: '2px 0 8px' }}>
            {addresses.length === 0 && <div style={{ padding: '3px 14px 3px 24px', fontSize: 11, color: '#858585' }}>// 접속자 없음</div>}
            {addresses.map(address => <div key={`${address.ip}:${address.nickname}`} style={{ padding: '3px 14px 3px 24px', fontSize: 11, color: '#9cdcfe', overflowWrap: 'anywhere' }}>
                {address.nickname || '이름 미설정'} · {address.ip}{address.connections > 1 ? ` (${address.connections}개 연결)` : ''}
            </div>)}
        </div>}
    </>;
}
