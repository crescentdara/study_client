import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { isOverDeskTrash, signalTrashDrop, signalTrashHover } from './DeskTrashBin';

type DrinkCode = 'MIX_COFFEE' | 'HOT_CHOCOLATE' | 'YULMU_TEA' | 'MILK';

interface VendingEvent {
    eventId: string;
    sessionId: string;
    nickname: string;
    drink: DrinkCode;
    x: number;
    y: number;
    timestamp: number;
}

interface VendingMessage {
    type: 'SNAPSHOT' | 'DISPENSE' | 'MOVE' | 'REMOVE';
    eventId?: string;
    cup?: VendingEvent;
    cups?: VendingEvent[];
}

interface DispensedCup extends VendingEvent {
    createdAt: number;
    x: number;
    y: number;
}

interface VendingMachineWidgetProps {
    nickname: string;
    sessionId: string;
    machineVisible: boolean;
    opacity: number;
}

const DRINKS: Array<{ code: DrinkCode; label: string; short: string; price: string }> = [
    { code: 'MIX_COFFEE', label: '믹스커피', short: 'COFFEE', price: '300' },
    { code: 'HOT_CHOCOLATE', label: '핫초코', short: 'CHOCO', price: '400' },
    { code: 'YULMU_TEA', label: '율무차', short: 'YULMU', price: '400' },
    { code: 'MILK', label: '우유', short: 'MILK', price: '300' },
];

function loadPosition() {
    try {
        const stored = JSON.parse(localStorage.getItem('study.vendingPosition') ?? 'null') as { x?: number; y?: number } | null;
        if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
            return { x: Math.max(.07, Math.min(.93, stored.x!)), y: Math.max(.12, Math.min(.88, stored.y!)) };
        }
    } catch {
        // Restore the default when the preference is malformed.
    }
    return { x: .13, y: .57 };
}

function VendingMachineWidget({ nickname, sessionId, machineVisible, opacity }: VendingMachineWidgetProps) {
    const clientRef = useRef<Client | null>(null);
    const layerRef = useRef<HTMLDivElement | null>(null);
    const seenEventsRef = useRef(new Set<string>());
    const dragRef = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
    const cupDragRef = useRef<{ eventId: string; pointerId: number; dx: number; dy: number } | null>(null);
    const cooldownRef = useRef(0);
    const lastCupMoveSentRef = useRef(0);
    const [connected, setConnected] = useState(false);
    const [position, setPosition] = useState(loadPosition);
    const positionRef = useRef(position);
    const [cups, setCups] = useState<DispensedCup[]>([]);
    const cupsRef = useRef<DispensedCup[]>([]);
    const [activeEvent, setActiveEvent] = useState<VendingEvent | null>(null);

    const playDispense = useCallback((event: VendingEvent) => {
        if (!event.eventId || seenEventsRef.current.has(event.eventId)) return;
        seenEventsRef.current.add(event.eventId);
        setActiveEvent(event);
        setCups(previous => {
            const next = [...previous, { ...event, createdAt: Date.now() }].slice(-12);
            cupsRef.current = next;
            return next;
        });
        window.setTimeout(() => {
            setActiveEvent(current => current?.eventId === event.eventId ? null : current);
        }, 1900);
    }, []);

    useEffect(() => {
        if (!sessionId) return;
        const client = new Client({
            webSocketFactory: () => new SockJS('/ws'),
            reconnectDelay: 5000,
            onConnect: () => {
                setConnected(true);
                client.subscribe('/topic/lobby/vending', (message: IMessage) => {
                    try {
                        const incoming = JSON.parse(message.body) as VendingMessage;
                        if (incoming.type === 'SNAPSHOT') {
                            const next = (incoming.cups ?? []).map(cup => ({ ...cup, createdAt: cup.timestamp }));
                            next.forEach(cup => seenEventsRef.current.add(cup.eventId));
                            cupsRef.current = next;
                            setCups(next);
                        } else if (incoming.type === 'DISPENSE' && incoming.cup) {
                            playDispense(incoming.cup);
                        } else if (incoming.type === 'MOVE' && incoming.cup) {
                            const moved = incoming.cup;
                            setCups(previous => {
                                const next = previous.map(cup => cup.eventId === moved.eventId
                                    ? { ...cup, x: moved.x, y: moved.y, timestamp: moved.timestamp }
                                    : cup);
                                cupsRef.current = next;
                                return next;
                            });
                        } else if (incoming.type === 'REMOVE' && incoming.eventId) {
                            setCups(previous => {
                                const next = previous.filter(cup => cup.eventId !== incoming.eventId);
                                cupsRef.current = next;
                                return next;
                            });
                        }
                    } catch (error) {
                        console.warn('[vending] invalid message', error);
                    }
                });
                client.publish({
                    destination: '/app/study/lobby/vending',
                    body: JSON.stringify({ type: 'ENTER', sessionId, nickname }),
                });
            },
            onDisconnect: () => setConnected(false),
            onStompError: () => setConnected(false),
        });
        clientRef.current = client;
        client.activate();
        return () => {
            client.deactivate();
            clientRef.current = null;
        };
    }, [playDispense, sessionId]);

    const dispense = (drink: DrinkCode) => {
        const client = clientRef.current;
        const now = Date.now();
        if (!client?.connected || now < cooldownRef.current) return;
        cooldownRef.current = now + 900;
        const event: VendingEvent = {
            eventId: `${sessionId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
            sessionId,
            nickname: nickname.trim() || 'anonymous',
            drink,
            x: positionRef.current.x,
            y: Math.min(.94, positionRef.current.y + (layerRef.current ? 84 / layerRef.current.clientHeight : .12)),
            timestamp: now,
        };
        playDispense(event);
        client.publish({
            destination: '/app/study/lobby/vending',
            body: JSON.stringify({ type: 'DISPENSE', ...event }),
        });
    };

    const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        const bounds = layerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            pointerId: event.pointerId,
            dx: event.clientX - (bounds.left + positionRef.current.x * bounds.width),
            dy: event.clientY - (bounds.top + positionRef.current.y * bounds.height),
        };
    };

    const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        const bounds = layerRef.current?.getBoundingClientRect();
        if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
        const next = {
            x: Math.max(.07, Math.min(.93, (event.clientX - bounds.left - drag.dx) / bounds.width)),
            y: Math.max(.12, Math.min(.88, (event.clientY - bounds.top - drag.dy) / bounds.height)),
        };
        positionRef.current = next;
        setPosition(next);
    };

    const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        localStorage.setItem('study.vendingPosition', JSON.stringify(positionRef.current));
    };

    const startCupDrag = (event: ReactPointerEvent<HTMLSpanElement>, cup: DispensedCup) => {
        const bounds = layerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        cupDragRef.current = {
            eventId: cup.eventId,
            pointerId: event.pointerId,
            dx: event.clientX - (bounds.left + cup.x * bounds.width),
            dy: event.clientY - (bounds.top + cup.y * bounds.height),
        };
    };

    const moveCupDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
        const drag = cupDragRef.current;
        const bounds = layerRef.current?.getBoundingClientRect();
        if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
        const x = Math.max(.02, Math.min(.98, (event.clientX - bounds.left - drag.dx) / bounds.width));
        const y = Math.max(.05, Math.min(.95, (event.clientY - bounds.top - drag.dy) / bounds.height));
        setCups(previous => {
            const next = previous.map(cup => cup.eventId === drag.eventId ? { ...cup, x, y } : cup);
            cupsRef.current = next;
            return next;
        });
        const client = clientRef.current;
        if (client?.connected && Date.now() - lastCupMoveSentRef.current >= 75) {
            lastCupMoveSentRef.current = Date.now();
            client.publish({
                destination: '/app/study/lobby/vending',
                body: JSON.stringify({ type: 'MOVE', eventId: drag.eventId, sessionId, nickname, x, y }),
            });
        }
        signalTrashHover(isOverDeskTrash(event.clientX, event.clientY));
    };

    const endCupDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
        const drag = cupDragRef.current;
        if (drag?.pointerId !== event.pointerId) return;
        cupDragRef.current = null;
        const discarded = isOverDeskTrash(event.clientX, event.clientY);
        signalTrashHover(false);
        if (discarded) {
            setCups(previous => {
                const next = previous.filter(cup => cup.eventId !== drag.eventId);
                cupsRef.current = next;
                return next;
            });
            clientRef.current?.publish({
                destination: '/app/study/lobby/vending',
                body: JSON.stringify({ type: 'REMOVE', eventId: drag.eventId, sessionId, nickname }),
            });
            signalTrashDrop();
            return;
        }
        const cup = cupsRef.current.find(item => item.eventId === drag.eventId);
        if (cup && clientRef.current?.connected) {
            clientRef.current.publish({
                destination: '/app/study/lobby/vending',
                body: JSON.stringify({ type: 'MOVE', eventId: cup.eventId, sessionId, nickname, x: cup.x, y: cup.y }),
            });
        }
    };

    const activeDrink = activeEvent ? DRINKS.find(drink => drink.code === activeEvent.drink) : null;

    return (
        <div className="vending-layer" ref={layerRef} aria-label="Shared vending machine">
            {machineVisible && (
                <div
                    className={`office-vending ${activeEvent ? 'dispensing' : ''}`}
                    style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%`, opacity }}
                >
                <div
                    className="vending-handle"
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    title="드래그해서 자판기 이동"
                >
                    <b>SAMSUNG</b>
                    <span>HOT &amp; COLD DRINKS</span>
                    <i className={connected ? 'online' : ''} />
                </div>
                <div className="vending-showcase">
                    <i className="vending-flower flower-one" />
                    <i className="vending-flower flower-two" />
                    <i className="vending-flower flower-three" />
                    <div className="vending-paper-sign"><b>커 피</b><small>200원</small></div>
                </div>
                <div className="vending-console">
                    <div className="vending-display">
                        <span>{activeDrink ? `${activeDrink.label} 제조중` : connected ? '음료 선택' : '연결중'}</span>
                        <small>{activeEvent ? activeEvent.nickname : 'READY'}</small>
                        <i className="vending-coin-slot"><em>100원</em></i>
                    </div>
                    <div className="vending-buttons">
                        {DRINKS.map(drink => (
                            <button
                                className={`vending-drink drink-${drink.code.toLowerCase().replace('_', '-')}`}
                                key={drink.code}
                                onClick={() => dispense(drink.code)}
                                disabled={!connected}
                            >
                                <i />
                                <b>{drink.label}</b>
                                <small>{drink.price}원</small>
                            </button>
                        ))}
                    </div>
                    <div className="vending-progress"><i /></div>
                </div>
                <div className="vending-lower-body">
                    <div className="vending-outlet">
                        <span className="outlet-label">PUSH</span>
                    </div>
                    <div className="vending-service"><i /><span>온수 정상</span></div>
                </div>
                </div>
            )}
            {cups.map(cup => (
                <span
                    className={`vending-cup free-vending-cup cup-${cup.drink.toLowerCase().replace('_', '-')}`}
                    key={cup.eventId}
                    style={{ left: `${cup.x * 100}%`, top: `${cup.y * 100}%`, opacity }}
                    onPointerDown={event => startCupDrag(event, cup)}
                    onPointerMove={moveCupDrag}
                    onPointerUp={endCupDrag}
                    onPointerCancel={endCupDrag}
                    title={`${cup.nickname}의 ${DRINKS.find(drink => drink.code === cup.drink)?.label} · 드래그해서 이동`}
                >
                    <i className="cup-steam"><em /><em /></i>
                    <b>{DRINKS.find(drink => drink.code === cup.drink)?.short}</b>
                    <small>{cup.nickname}</small>
                </span>
            ))}
        </div>
    );
}

export default VendingMachineWidget;
