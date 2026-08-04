import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { isOverDeskTrash, signalTrashDrop, signalTrashHover } from './DeskTrashBin';

interface CigaretteState {
    sessionId: string;
    nickname: string;
    x: number;
    y: number;
    burn: number;
    lit: boolean;
    holding: boolean;
    actionId: string;
    updatedAt: number;
}

interface CigaretteMessage {
    type: 'SNAPSHOT' | 'UPSERT' | 'REMOVE';
    sessionId?: string;
    cigarette?: CigaretteState;
    cigarettes?: CigaretteState[];
}

interface AshDeposit {
    id: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
    size: number;
    rotation: number;
}

interface PuffEffect {
    id: string;
    x: number;
    y: number;
    burn: number;
    strength: number;
}

interface SmokingWidgetProps {
    nickname: string;
    sessionId: string;
    packVisible: boolean;
    opacity: {
        cigarette: number;
        pack: number;
    };
}

interface DeskLayout {
    pack: { x: number; y: number };
}

const DEFAULT_DESK_LAYOUT: DeskLayout = {
    pack: { x: .06, y: .86 },
};

function loadDeskLayout(): DeskLayout {
    try {
        const stored = JSON.parse(localStorage.getItem('study.smokingDeskLayout.v2') ?? 'null') as Partial<DeskLayout> | null;
        if (stored?.pack) {
            return {
                pack: { x: Number(stored.pack.x) || DEFAULT_DESK_LAYOUT.pack.x, y: Number(stored.pack.y) || DEFAULT_DESK_LAYOUT.pack.y },
            };
        }
    } catch {
        // Ignore malformed local preferences and restore the default layout.
    }
    return DEFAULT_DESK_LAYOUT;
}

const NORMAL_BURN_PER_MS = 1 / 240_000;
const FAST_BURN_PER_MS = 1 / 20_000;
const SEND_INTERVAL_MS = 75;
const PUFF_HOLD_DELAY_MS = 1_000;
const PUFF_CHARGE_MS = 1_800;

function currentBurn(cigarette: CigaretteState, now = Date.now()) {
    if (!cigarette.lit) return cigarette.burn;
    const elapsed = Math.max(0, now - cigarette.updatedAt);
    const rate = cigarette.holding ? FAST_BURN_PER_MS : NORMAL_BURN_PER_MS;
    return Math.min(1, cigarette.burn + elapsed * rate);
}

function withLocalClock(cigarette: CigaretteState): CigaretteState {
    return {
        ...cigarette,
        updatedAt: Date.now(),
    };
}

function SmokingWidget({ nickname, sessionId, packVisible, opacity }: SmokingWidgetProps) {
    const layerRef = useRef<HTMLDivElement | null>(null);
    const clientRef = useRef<Client | null>(null);
    const statesRef = useRef<Record<string, CigaretteState>>({});
    const seenAshActionsRef = useRef(new Set<string>());
    const seenPuffActionsRef = useRef(new Set<string>());
    const ashCleanupTimersRef = useRef<number[]>([]);
    const ashResetBurnRef = useRef<Record<string, number>>({});
    const nextAutoAshBurnRef = useRef(.11 + Math.random() * .05);
    const lastPaperTapRef = useRef<Record<string, number>>({});
    const puffChargeRef = useRef<{ pointerId: number; sessionId: string; startedAt: number; frameId: number } | null>(null);
    const dragRef = useRef<{ pointerId: number; dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);
    const propDragRef = useRef<{ kind: keyof DeskLayout; pointerId: number; dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);
    const lastMoveSentRef = useRef(0);
    const [states, setStates] = useState<Record<string, CigaretteState>>({});
    const [ashDeposits, setAshDeposits] = useState<AshDeposit[]>([]);
    const [puffEffects, setPuffEffects] = useState<PuffEffect[]>([]);
    const [deskLayout, setDeskLayout] = useState<DeskLayout>(loadDeskLayout);
    const [packOpen, setPackOpen] = useState(false);
    const [takingCigarette, setTakingCigarette] = useState(false);
    const [selectedPackCigarette, setSelectedPackCigarette] = useState<number | null>(null);
    const deskLayoutRef = useRef(deskLayout);
    const [connected, setConnected] = useState(false);
    const [puffCharge, setPuffCharge] = useState(0);
    const [, setClock] = useState(0);

    useEffect(() => () => {
        if (puffChargeRef.current) window.cancelAnimationFrame(puffChargeRef.current.frameId);
        ashCleanupTimersRef.current.forEach(timer => window.clearTimeout(timer));
        ashCleanupTimersRef.current = [];
    }, []);

    const replaceStates = useCallback((next: Record<string, CigaretteState>) => {
        statesRef.current = next;
        setStates(next);
    }, []);

    const patchState = useCallback((next: CigaretteState) => {
        replaceStates({ ...statesRef.current, [next.sessionId]: next });
    }, [replaceStates]);

    const dropAsh = useCallback((cigarette: CigaretteState) => {
        if (!cigarette.actionId?.startsWith('flick-') || seenAshActionsRef.current.has(cigarette.actionId)) return;
        seenAshActionsRef.current.add(cigarette.actionId);
        const burn = currentBurn(cigarette);
        ashResetBurnRef.current[cigarette.sessionId] = burn;
        const burnOffset = burn * 85.5;
        const pieces: AshDeposit[] = Array.from({ length: 7 }, (_, index) => ({
            id: `${cigarette.actionId}-${index}`,
            x: cigarette.x,
            y: cigarette.y,
            dx: burnOffset - 8 + Math.random() * 24,
            dy: 38 + Math.random() * 52,
            size: 1.8 + Math.random() * 3.15,
            rotation: -80 + Math.random() * 240,
        }));
        setAshDeposits(previous => [...previous, ...pieces].slice(-160));
        const pieceIds = new Set(pieces.map(piece => piece.id));
        const timer = window.setTimeout(() => {
            setAshDeposits(previous => previous.filter(piece => !pieceIds.has(piece.id)));
            ashCleanupTimersRef.current = ashCleanupTimersRef.current.filter(item => item !== timer);
        }, 10_000);
        ashCleanupTimersRef.current.push(timer);
    }, []);

    const showPuff = useCallback((cigarette: CigaretteState) => {
        if (!cigarette.actionId?.startsWith('puff-') || seenPuffActionsRef.current.has(cigarette.actionId)) return;
        seenPuffActionsRef.current.add(cigarette.actionId);
        const strength = Math.max(.12, Math.min(1, Number(cigarette.actionId.split('-')[1]) / 100 || .12));
        const effect: PuffEffect = {
            id: cigarette.actionId,
            x: cigarette.x,
            y: cigarette.y,
            burn: currentBurn(cigarette),
            strength,
        };
        setPuffEffects(previous => [...previous, effect].slice(-18));
        window.setTimeout(() => {
            setPuffEffects(previous => previous.filter(item => item.id !== effect.id));
        }, 3_200);
    }, []);

    const publish = useCallback((type: string, cigarette?: CigaretteState, overrides: Partial<CigaretteState> = {}) => {
        const client = clientRef.current;
        if (!client?.connected || !sessionId) return;
        const base = cigarette ?? statesRef.current[sessionId];
        client.publish({
            destination: '/app/study/lobby/cigarette',
            body: JSON.stringify({
                type,
                sessionId,
                nickname: nickname.trim() || 'anonymous',
                x: overrides.x ?? base?.x ?? .72,
                y: overrides.y ?? base?.y ?? .67,
                burn: overrides.burn ?? (base ? currentBurn(base) : .02),
                lit: overrides.lit ?? base?.lit ?? true,
                holding: overrides.holding ?? base?.holding ?? false,
                actionId: overrides.actionId ?? base?.actionId ?? '',
            }),
        });
    }, [nickname, sessionId]);

    useEffect(() => {
        if (!sessionId) return;
        const client = new Client({
            webSocketFactory: () => new SockJS('/ws'),
            reconnectDelay: 5000,
            onConnect: () => {
                setConnected(true);
                client.subscribe('/topic/lobby/cigarette', (message: IMessage) => {
                    try {
                        const incoming = JSON.parse(message.body) as CigaretteMessage;
                        if (incoming.type === 'SNAPSHOT') {
                            const normalized = (incoming.cigarettes ?? []).map(withLocalClock);
                            normalized.forEach(dropAsh);
                            normalized.forEach(showPuff);
                            const next = Object.fromEntries(normalized.map(item => [item.sessionId, item]));
                            replaceStates(next);
                        } else if (incoming.type === 'UPSERT' && incoming.cigarette) {
                            const normalized = withLocalClock(incoming.cigarette);
                            dropAsh(normalized);
                            showPuff(normalized);
                            patchState(normalized);
                        } else if (incoming.type === 'REMOVE' && incoming.sessionId) {
                            const next = { ...statesRef.current };
                            delete next[incoming.sessionId];
                            replaceStates(next);
                        }
                    } catch (error) {
                        console.warn('[lobby-cigarette] invalid message', error);
                    }
                });
                client.publish({
                    destination: '/app/study/lobby/cigarette',
                    body: JSON.stringify({ type: 'ENTER', sessionId, nickname }),
                });
            },
            onDisconnect: () => setConnected(false),
            onStompError: () => setConnected(false),
        });
        clientRef.current = client;
        client.activate();
        return () => {
            if (client.connected && statesRef.current[sessionId]) {
                client.publish({
                    destination: '/app/study/lobby/cigarette',
                    body: JSON.stringify({ type: 'REMOVE', sessionId, nickname }),
                });
            }
            client.deactivate();
            clientRef.current = null;
        };
    }, [dropAsh, nickname, patchState, replaceStates, sessionId, showPuff]);

    useEffect(() => {
        const clock = window.setInterval(() => setClock(value => value + 1), 100);
        const heartbeat = window.setInterval(() => publish('HEARTBEAT'), 15_000);
        const sync = window.setInterval(() => {
            const own = statesRef.current[sessionId];
            if (!own?.lit) return;
            const burn = currentBurn(own);
            if (burn >= .985) {
                const finished = { ...own, burn: 1, lit: false, holding: false, updatedAt: Date.now() };
                patchState(finished);
                publish('UPDATE', finished, { burn: 1, lit: false, holding: false, actionId: `finished-${Date.now()}` });
            } else if (burn >= nextAutoAshBurnRef.current) {
                nextAutoAshBurnRef.current = burn + .09 + Math.random() * .07;
                publish('FLICK', own, {
                    burn,
                    actionId: `flick-auto-${sessionId}-${Date.now()}`,
                });
            } else {
                publish('UPDATE', own, { burn });
            }
        }, 1500);
        return () => {
            window.clearInterval(clock);
            window.clearInterval(heartbeat);
            window.clearInterval(sync);
        };
    }, [patchState, publish, sessionId]);

    const cigarettes = useMemo(() => Object.values(states), [states]);
    const own = states[sessionId];

    const spawn = () => {
        if (!connected || own) return;
        const pack = deskLayoutRef.current.pack;
        nextAutoAshBurnRef.current = .1 + Math.random() * .06;
        publish('SPAWN', undefined, {
            x: Math.max(.04, Math.min(.9, pack.x + .015)),
            y: Math.max(.08, pack.y - .075),
            burn: .02,
            lit: true,
            holding: false,
            actionId: `spawn-${Date.now()}`,
        });
    };

    const takeCigarette = (event: ReactPointerEvent<HTMLElement>, cigaretteIndex: number) => {
        event.preventDefault();
        event.stopPropagation();
        if (!packOpen || takingCigarette || !connected || own) return;
        setSelectedPackCigarette(cigaretteIndex);
        setTakingCigarette(true);
        window.setTimeout(() => spawn(), 360);
        window.setTimeout(() => {
            setTakingCigarette(false);
            setSelectedPackCigarette(null);
            setPackOpen(false);
        }, 620);
    };

    const startPropDrag = (kind: keyof DeskLayout, event: ReactPointerEvent<HTMLElement>) => {
        const bounds = layerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const position = deskLayoutRef.current[kind];
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        propDragRef.current = {
            kind,
            pointerId: event.pointerId,
            dx: event.clientX - (bounds.left + position.x * bounds.width),
            dy: event.clientY - (bounds.top + position.y * bounds.height),
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
        };
    };

    const movePropDrag = (event: ReactPointerEvent<HTMLElement>) => {
        const drag = propDragRef.current;
        const bounds = layerRef.current?.getBoundingClientRect();
        if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
        const x = Math.max(.04, Math.min(.96, (event.clientX - bounds.left - drag.dx) / bounds.width));
        const y = Math.max(.06, Math.min(.94, (event.clientY - bounds.top - drag.dy) / bounds.height));
        drag.moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4;
        const next = { ...deskLayoutRef.current, [drag.kind]: { x, y } };
        deskLayoutRef.current = next;
        setDeskLayout(next);
    };

    const endPropDrag = (event: ReactPointerEvent<HTMLElement>, cancelled = false) => {
        const drag = propDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        propDragRef.current = null;
        localStorage.setItem('study.smokingDeskLayout.v2', JSON.stringify(deskLayoutRef.current));
        if (!cancelled && drag.kind === 'pack' && !drag.moved) setPackOpen(open => !open);
    };

    const startDrag = (event: ReactPointerEvent<HTMLElement>, cigarette: CigaretteState) => {
        if (cigarette.sessionId !== sessionId) return;
        const bounds = layerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            pointerId: event.pointerId,
            dx: event.clientX - (bounds.left + cigarette.x * bounds.width),
            dy: event.clientY - (bounds.top + cigarette.y * bounds.height),
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
        };
    };

    const moveDrag = (event: ReactPointerEvent<HTMLElement>, cigarette: CigaretteState) => {
        const drag = dragRef.current;
        const bounds = layerRef.current?.getBoundingClientRect();
        if (!drag || drag.pointerId !== event.pointerId || !bounds || cigarette.sessionId !== sessionId) return;
        drag.moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4;
        const x = Math.max(.04, Math.min(.96, (event.clientX - bounds.left - drag.dx) / bounds.width));
        const y = Math.max(.08, Math.min(.92, (event.clientY - bounds.top - drag.dy) / bounds.height));
        const next = { ...cigarette, x, y, burn: currentBurn(cigarette), updatedAt: Date.now() };
        patchState(next);
        signalTrashHover(isOverDeskTrash(event.clientX, event.clientY));
        if (Date.now() - lastMoveSentRef.current >= SEND_INTERVAL_MS) {
            lastMoveSentRef.current = Date.now();
            publish('MOVE', next, { x, y, burn: next.burn });
        }
    };

    const endDrag = (event: ReactPointerEvent<HTMLElement>, cigarette: CigaretteState) => {
        if (dragRef.current?.pointerId !== event.pointerId || cigarette.sessionId !== sessionId) return false;
        const moved = dragRef.current.moved;
        dragRef.current = null;
        const latest = statesRef.current[sessionId] ?? cigarette;
        const discarded = isOverDeskTrash(event.clientX, event.clientY);
        signalTrashHover(false);
        if (discarded) {
            const next = { ...statesRef.current };
            delete next[sessionId];
            replaceStates(next);
            publish('REMOVE', latest, { burn: currentBurn(latest), lit: false, holding: false });
            signalTrashDrop();
            return true;
        }
        publish('MOVE', latest, { burn: currentBurn(latest) });
        return moved;
    };

    const setHolding = (event: ReactPointerEvent<HTMLElement>, cigarette: CigaretteState, holding: boolean) => {
        if (cigarette.sessionId !== sessionId) return;
        event.stopPropagation();
        event.preventDefault();
        const burn = currentBurn(cigarette);
        if (holding) event.currentTarget.setPointerCapture(event.pointerId);
        publish('HOLD', cigarette, { burn, holding, actionId: `hold-${holding}-${Date.now()}` });
    };

    const flickAsh = (cigarette: CigaretteState) => {
        if (cigarette.sessionId !== sessionId || !cigarette.lit) return;
        const burn = currentBurn(cigarette);
        nextAutoAshBurnRef.current = burn + .09 + Math.random() * .07;
        publish('FLICK', cigarette, {
            burn,
            actionId: `flick-${sessionId}-${Date.now()}`,
        });
    };

    const handlePaperTap = (cigarette: CigaretteState) => {
        const now = Date.now();
        const previous = lastPaperTapRef.current[cigarette.sessionId] ?? 0;
        if (now - previous <= 380) {
            lastPaperTapRef.current[cigarette.sessionId] = 0;
            flickAsh(cigarette);
        } else {
            lastPaperTapRef.current[cigarette.sessionId] = now;
        }
    };

    const stopPuffCharge = () => {
        const charge = puffChargeRef.current;
        if (charge) window.cancelAnimationFrame(charge.frameId);
        puffChargeRef.current = null;
        setPuffCharge(0);
    };

    const startPaperInteraction = (event: ReactPointerEvent<HTMLElement>, cigarette: CigaretteState) => {
        event.stopPropagation();
        event.preventDefault();
        startDrag(event, cigarette);
        if (cigarette.sessionId !== sessionId || !cigarette.lit) return;
        stopPuffCharge();
        const charge = { pointerId: event.pointerId, sessionId: cigarette.sessionId, startedAt: Date.now(), frameId: 0 };
        puffChargeRef.current = charge;
        const tick = () => {
            if (puffChargeRef.current !== charge) return;
            const chargingFor = Date.now() - charge.startedAt - PUFF_HOLD_DELAY_MS;
            setPuffCharge(Math.max(0, Math.min(1, chargingFor / PUFF_CHARGE_MS)));
            charge.frameId = window.requestAnimationFrame(tick);
        };
        charge.frameId = window.requestAnimationFrame(tick);
    };

    const movePaperInteraction = (event: ReactPointerEvent<HTMLElement>, cigarette: CigaretteState) => {
        event.stopPropagation();
        moveDrag(event, cigarette);
        if (dragRef.current?.moved && puffChargeRef.current?.pointerId === event.pointerId) stopPuffCharge();
    };

    const endPaperInteraction = (event: ReactPointerEvent<HTMLElement>, cigarette: CigaretteState, cancelled = false) => {
        event.stopPropagation();
        const charge = puffChargeRef.current?.pointerId === event.pointerId ? puffChargeRef.current : null;
        const heldFor = charge ? Date.now() - charge.startedAt : 0;
        const level = heldFor >= PUFF_HOLD_DELAY_MS
            ? Math.max(.12, Math.min(1, (heldFor - PUFF_HOLD_DELAY_MS) / PUFF_CHARGE_MS))
            : 0;
        const moved = endDrag(event, cigarette);
        stopPuffCharge();
        if (cancelled || moved) return;
        if (charge && level >= .12 && cigarette.lit) {
            const strength = Math.max(12, Math.round(level * 100));
            const burn = Math.min(1, currentBurn(cigarette) + level * .012);
            const actionId = `puff-${strength}-${sessionId}-${Date.now()}`;
            const puffed = { ...cigarette, burn, actionId, updatedAt: Date.now() };
            showPuff(puffed);
            patchState(puffed);
            publish('PUFF', puffed, { burn, actionId });
            return;
        }
        handlePaperTap(cigarette);
    };

    return (
        <div className="smoking-desk" ref={layerRef} aria-label="Shared lobby desk">
            {cigarettes.map(cigarette => {
                const burn = currentBurn(cigarette);
                const ashGrowth = Math.max(0, burn - (ashResetBurnRef.current[cigarette.sessionId] ?? 0));
                const ashWidth = 7 + Math.min(1, ashGrowth / .12) * 10;
                const mine = cigarette.sessionId === sessionId;
                return (
                    <div
                        className={`desk-cigarette ${mine ? 'mine' : 'remote'} ${cigarette.lit ? 'lit' : 'out'}`}
                        key={cigarette.sessionId}
                        style={{
                            left: `${cigarette.x * 100}%`,
                            top: `${cigarette.y * 100}%`,
                            opacity: opacity.cigarette,
                            '--burn-offset': `${burn * 95}px`,
                        } as React.CSSProperties}
                        onPointerDown={event => startDrag(event, cigarette)}
                        onPointerMove={event => moveDrag(event, cigarette)}
                        onPointerUp={event => endDrag(event, cigarette)}
                        onPointerCancel={event => endDrag(event, cigarette)}
                        title={mine ? '드래그해서 이동 · 흰 부분 길게 눌러 연기 링 · 더블클릭으로 재 털기' : `${cigarette.nickname}의 담배`}
                    >
                        <span className="cigarette-owner">{mine ? 'YOU' : cigarette.nickname}</span>
                        {cigarette.lit && (
                            <span className="cigarette-smoke" aria-hidden="true">
                                <i /><i /><i />
                            </span>
                        )}
                        {cigarette.actionId.startsWith('flick-') && (
                            <span className="cigarette-ash-burst" key={cigarette.actionId} aria-hidden="true">
                                <i /><i /><i /><i /><i />
                            </span>
                        )}
                        {mine && puffChargeRef.current?.sessionId === cigarette.sessionId && puffCharge > 0 && (
                            <span className="cigarette-puff-gauge">
                                <i style={{ width: `${puffCharge * 100}%` }} />
                                <b>{Math.round(puffCharge * 100)}%</b>
                            </span>
                        )}
                        <div className="cigarette-stick">
                            <span className="cigarette-ash" style={{ width: `${ashWidth}px` }} />
                            <span className="cigarette-ember" />
                            <span
                                className="cigarette-paper"
                                style={{ width: `${Math.max(2, (1 - burn) * 105)}px` }}
                                onPointerDown={event => startPaperInteraction(event, cigarette)}
                                onPointerMove={event => movePaperInteraction(event, cigarette)}
                                onPointerUp={event => endPaperInteraction(event, cigarette)}
                                onPointerCancel={event => endPaperInteraction(event, cigarette, true)}
                            >
                            </span>
                            <span
                                className={`cigarette-filter ${cigarette.holding ? 'pressed' : ''}`}
                                onPointerDown={event => setHolding(event, cigarette, true)}
                                onPointerUp={event => setHolding(event, cigarette, false)}
                                onPointerCancel={event => setHolding(event, cigarette, false)}
                            />
                        </div>
                    </div>
                );
            })}

            {puffEffects.map(effect => (
                <span
                    className="cigarette-smoke-rings standalone"
                    key={effect.id}
                    style={{
                        left: `calc(${effect.x * 100}% + ${-15 + effect.burn * 85.5}px)`,
                        top: `${effect.y * 100}%`,
                        '--puff-rise': `${-(58 + effect.strength * 46)}px`,
                    } as React.CSSProperties}
                    aria-hidden="true"
                >
                    {Array.from({ length: Math.max(1, Math.ceil(effect.strength * 5)) }, (_, index) => <i key={index} />)}
                </span>
            ))}

            <div className="screen-ash-layer" aria-hidden="true">
                {ashDeposits.map(piece => (
                    <i
                        key={piece.id}
                        className="screen-ash-piece"
                        style={{
                            left: `${piece.x * 100}%`,
                            top: `${piece.y * 100}%`,
                            width: `${piece.size}px`,
                            height: `${Math.max(2, piece.size * .65)}px`,
                            '--ash-dx': `${piece.dx}px`,
                            '--ash-dy': `${piece.dy}px`,
                            '--ash-rotation': `${piece.rotation}deg`,
                        } as React.CSSProperties}
                    />
                ))}
            </div>

            {packVisible && (
                <div
                    className={`cigarette-pack ${packOpen ? 'open' : ''} ${takingCigarette ? 'taking' : ''} ${own ? 'in-use' : ''}`}
                    style={{ left: `${deskLayout.pack.x * 100}%`, top: `${deskLayout.pack.y * 100}%`, opacity: opacity.pack }}
                    onPointerDown={event => startPropDrag('pack', event)}
                    onPointerMove={movePropDrag}
                    onPointerUp={event => endPropDrag(event)}
                    onPointerCancel={event => endPropDrag(event, true)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setPackOpen(open => !open); }}
                    role="button"
                    tabIndex={0}
                    title="드래그해서 이동 · 클릭해서 담뱃갑 열기/닫기"
                >
                    <span
                        className="pack-inner"
                        onPointerDown={event => event.stopPropagation()}
                        title={own ? '이미 꺼낸 담배가 있습니다' : '담배 한 개비를 선택하세요'}
                    >
                        {[0, 1, 2, 3].map(index => (
                            <i
                                className={selectedPackCigarette === index ? 'selected' : ''}
                                key={index}
                                onPointerDown={event => event.stopPropagation()}
                                onPointerUp={event => takeCigarette(event, index)}
                                title={`${index + 1}번 담배 꺼내기`}
                            />
                        ))}
                    </span>
                    <span className="pack-lid"><i>FILTER CIGARETTES</i></span>
                    <span className="pack-chevron" />
                    <span className="pack-crest">♛</span>
                    <b>Marlboro</b>
                    <small>{own ? 'IN USE' : packOpen ? 'PICK ONE' : 'RED LABEL'}</small>
                </div>
            )}
        </div>
    );
}

export default SmokingWidget;
