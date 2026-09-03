import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

type DrawingTool = 'PEN' | 'ERASER';

interface DrawingPoint {
    x: number;
    y: number;
}

interface DrawingStroke {
    strokeId: string;
    sessionId: string;
    nickname: string;
    tool: DrawingTool;
    color: string;
    width: number;
    points: DrawingPoint[];
    timestamp: number;
}

interface DrawingMessage {
    type: 'SNAPSHOT' | 'STROKE' | 'LOCK_STATE';
    strokeId?: string;
    stroke?: DrawingStroke;
    strokes?: DrawingStroke[];
    locked?: boolean;
}

export interface DrawingCommand {
    type: 'LOCK' | 'UNLOCK';
    id: number;
}

interface LobbyDrawingLayerProps {
    nickname: string;
    sessionId: string;
    editing: boolean;
    locked: boolean;
    command: DrawingCommand | null;
    onEditingChange: (editing: boolean) => void;
    onLockedChange: (locked: boolean) => void;
    onNotice: (message: string) => void;
}

const MAX_LOCAL_POINTS = 400;
const ERASER_WIDTH = 24;

function applyStrokeStyle(ctx: CanvasRenderingContext2D, stroke: DrawingStroke) {
    ctx.globalCompositeOperation = stroke.tool === 'ERASER' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke, width: number, height: number) {
    if (stroke.points.length < 2) return;
    ctx.save();
    applyStrokeStyle(ctx, stroke);
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
    for (let index = 1; index < stroke.points.length; index += 1) {
        ctx.lineTo(stroke.points[index].x * width, stroke.points[index].y * height);
    }
    ctx.stroke();
    ctx.restore();
}

function drawSegment(
    ctx: CanvasRenderingContext2D,
    stroke: DrawingStroke,
    from: DrawingPoint,
    to: DrawingPoint,
    width: number,
    height: number,
) {
    ctx.save();
    applyStrokeStyle(ctx, stroke);
    ctx.beginPath();
    ctx.moveTo(from.x * width, from.y * height);
    ctx.lineTo(to.x * width, to.y * height);
    ctx.stroke();
    ctx.restore();
}

function LobbyDrawingLayer({ nickname, sessionId, editing, locked, command, onEditingChange, onLockedChange, onNotice }: LobbyDrawingLayerProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const toolbarRef = useRef<HTMLDivElement | null>(null);
    const clientRef = useRef<Client | null>(null);
    const strokesRef = useRef<DrawingStroke[]>([]);
    const hiddenStrokeIdsRef = useRef<Set<string>>(new Set());
    const draftRef = useRef<{ pointerId: number; stroke: DrawingStroke } | null>(null);
    const toolbarDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
    const lockedRef = useRef(locked);
    const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
    const [connected, setConnected] = useState(false);
    const [color, setColor] = useState('#60a5fa');
    const [lineWidth, setLineWidth] = useState(6);
    const [tool, setTool] = useState<DrawingTool>('PEN');
    const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
    const ownerSessionId = sessionId.trim().slice(0, 80);

    useEffect(() => {
        lockedRef.current = locked;
        if (locked) onEditingChange(false);
    }, [locked, onEditingChange]);

    const redraw = useCallback((nextStrokes: DrawingStroke[] = strokesRef.current) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
        const targetWidth = Math.max(1, Math.round(width * pixelRatio));
        const targetHeight = Math.max(1, Math.round(height * pixelRatio));
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
        }
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        nextStrokes.forEach(stroke => drawStroke(ctx, stroke, width, height));
    }, []);

    const replaceStrokes = useCallback((next: DrawingStroke[]) => {
        strokesRef.current = next;
        setStrokes(next);
    }, []);

    useEffect(() => {
        redraw(strokes);
    }, [redraw, strokes]);

    useEffect(() => {
        const handleResize = () => redraw();
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [redraw]);

    useEffect(() => {
        if (!editing) draftRef.current = null;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (editing && event.key === 'Escape') onEditingChange(false);
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [editing, onEditingChange]);

    useEffect(() => {
        if (!sessionId) return;
        const client = new Client({
            webSocketFactory: () => new SockJS('/ws'),
            reconnectDelay: 5000,
            onConnect: () => {
                setConnected(true);
                client.subscribe('/topic/lobby/drawing', (message: IMessage) => {
                    try {
                        const incoming = JSON.parse(message.body) as DrawingMessage;
                        if (incoming.type === 'SNAPSHOT') {
                            lockedRef.current = Boolean(incoming.locked);
                            onLockedChange(lockedRef.current);
                            replaceStrokes((incoming.strokes ?? [])
                                .filter(stroke => !hiddenStrokeIdsRef.current.has(stroke.strokeId))
                                .slice(-600));
                        } else if (incoming.type === 'STROKE' && incoming.stroke) {
                            const nextStroke = incoming.stroke;
                            if (hiddenStrokeIdsRef.current.has(nextStroke.strokeId)) return;
                            if (strokesRef.current.some(stroke => stroke.strokeId === nextStroke.strokeId)) return;
                            replaceStrokes([...strokesRef.current, nextStroke].slice(-600));
                        } else if (incoming.type === 'LOCK_STATE') {
                            lockedRef.current = Boolean(incoming.locked);
                            onLockedChange(lockedRef.current);
                            onNotice(lockedRef.current ? '펜이 압수되었습니다.' : '펜 압수가 해제되었습니다.');
                        }
                    } catch (error) {
                        console.warn('[drawing] invalid message', error);
                    }
                });
                client.publish({
                    destination: '/app/study/lobby/drawing',
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
    }, [nickname, onLockedChange, onNotice, replaceStrokes, sessionId]);

    useEffect(() => {
        if (!command || !sessionId) return;
        const client = clientRef.current;
        if (!client?.connected) return;
        client.publish({
            destination: '/app/study/lobby/drawing',
            body: JSON.stringify({ type: command.type, sessionId, nickname }),
        });
    }, [command, nickname, sessionId]);

    const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): DrawingPoint => {
        const rect = event.currentTarget.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        };
    };

    const startStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!editing || lockedRef.current) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const now = Date.now();
        draftRef.current = {
            pointerId: event.pointerId,
            stroke: {
                strokeId: `${ownerSessionId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
                sessionId: ownerSessionId,
                nickname: nickname.trim() || 'anonymous',
                tool,
                color,
                width: tool === 'ERASER' ? ERASER_WIDTH : lineWidth,
                points: [pointFromEvent(event)],
                timestamp: now,
            },
        };
    };

    const moveStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const draft = draftRef.current;
        if (!editing || lockedRef.current || !draft || draft.pointerId !== event.pointerId) return;
        const nextPoint = pointFromEvent(event);
        const previousPoint = draft.stroke.points[draft.stroke.points.length - 1];
        const canvas = event.currentTarget;
        const distance = Math.hypot(
            (nextPoint.x - previousPoint.x) * canvas.clientWidth,
            (nextPoint.y - previousPoint.y) * canvas.clientHeight,
        );
        if (distance < 1.5 || draft.stroke.points.length >= MAX_LOCAL_POINTS) return;
        draft.stroke.points.push(nextPoint);
        const ctx = canvas.getContext('2d');
        if (ctx) drawSegment(ctx, draft.stroke, previousPoint, nextPoint, canvas.clientWidth, canvas.clientHeight);
    };

    const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const draft = draftRef.current;
        if (lockedRef.current || !draft || draft.pointerId !== event.pointerId) return;
        draftRef.current = null;
        if (draft.stroke.tool === 'ERASER') setTool('PEN');
        if (draft.stroke.points.length < 2) return;
        replaceStrokes([...strokesRef.current, draft.stroke].slice(-600));
        const client = clientRef.current;
        if (!client?.connected) return;
        client.publish({
            destination: '/app/study/lobby/drawing',
            body: JSON.stringify({ type: 'STROKE', ...draft.stroke }),
        });
    };

    const publishAction = useCallback((type: 'UNDO' | 'CLEAR_MINE') => {
        if (type === 'UNDO') {
            let ownedIndex = -1;
            for (let index = strokesRef.current.length - 1; index >= 0; index -= 1) {
                if (strokesRef.current[index].sessionId === ownerSessionId) {
                    ownedIndex = index;
                    break;
                }
            }
            if (ownedIndex >= 0) {
                hiddenStrokeIdsRef.current.add(strokesRef.current[ownedIndex].strokeId);
                replaceStrokes(strokesRef.current.filter((_, index) => index !== ownedIndex));
            }
        } else {
            const ownedPenStrokes = strokesRef.current.filter(
                stroke => stroke.sessionId === ownerSessionId && stroke.tool === 'PEN',
            );
            ownedPenStrokes.forEach(stroke => hiddenStrokeIdsRef.current.add(stroke.strokeId));
            replaceStrokes(strokesRef.current.filter(
                stroke => stroke.sessionId !== ownerSessionId || stroke.tool !== 'PEN',
            ));
        }

        const client = clientRef.current;
        if (!client?.connected) return;
        client.publish({
            destination: '/app/study/lobby/drawing',
            body: JSON.stringify({ type, sessionId: ownerSessionId, nickname }),
        });
    }, [nickname, ownerSessionId, replaceStrokes]);

    useEffect(() => {
        if (!editing) return;
        const undoOnShortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                publishAction('UNDO');
            }
        };
        window.addEventListener('keydown', undoOnShortcut);
        return () => window.removeEventListener('keydown', undoOnShortcut);
    }, [editing, publishAction]);

    const startToolbarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest('button, input, label')) return;
        const toolbar = toolbarRef.current;
        if (!toolbar) return;
        const rect = toolbar.getBoundingClientRect();
        toolbarDragRef.current = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setToolbarPosition({ x: rect.left, y: rect.top });
    };

    const moveToolbar = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = toolbarDragRef.current;
        const toolbar = toolbarRef.current;
        if (!drag || drag.pointerId !== event.pointerId || !toolbar) return;
        const maxX = Math.max(0, window.innerWidth - toolbar.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - toolbar.offsetHeight);
        setToolbarPosition({
            x: Math.max(0, Math.min(maxX, event.clientX - drag.offsetX)),
            y: Math.max(0, Math.min(maxY, event.clientY - drag.offsetY)),
        });
    };

    const finishToolbarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (toolbarDragRef.current?.pointerId !== event.pointerId) return;
        toolbarDragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    return (
        <div className={`lobby-drawing-layer ${editing ? 'editing' : ''}`} aria-label="공유 그림 레이어">
            <canvas
                ref={canvasRef}
                className="lobby-drawing-canvas"
                onPointerDown={startStroke}
                onPointerMove={moveStroke}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
            />
            {editing && (
                <div
                    ref={toolbarRef}
                    className="lobby-drawing-toolbar"
                    style={toolbarPosition ? { left: toolbarPosition.x, top: toolbarPosition.y, right: 'auto' } : undefined}
                    onPointerDown={event => {
                        event.stopPropagation();
                        startToolbarDrag(event);
                    }}
                    onPointerMove={moveToolbar}
                    onPointerUp={finishToolbarDrag}
                    onPointerCancel={finishToolbarDrag}
                >
                    <div className="drawing-toolbar-status" title="드래그해서 이동">
                        <strong>공유 그림</strong>
                        <span className={connected ? 'connected' : ''}>{connected ? '공유 중' : '연결 중'}</span>
                    </div>
                    <label className="drawing-color-picker" title="펜 색상 선택">
                        <span>색상</span>
                        <input
                            type="color"
                            value={color}
                            aria-label="펜 색상 선택"
                            onChange={event => {
                                setColor(event.target.value);
                                setTool('PEN');
                            }}
                        />
                    </label>
                    <label className="drawing-width-control">
                        <span>펜 굵기</span>
                        <input type="range" min="2" max="18" value={lineWidth} onChange={event => setLineWidth(Number(event.target.value))} />
                    </label>
                    <button type="button" className={tool === 'ERASER' ? 'selected' : ''} onClick={() => setTool(value => value === 'ERASER' ? 'PEN' : 'ERASER')}>지우개</button>
                    <button type="button" title="내 펜 선만 지웁니다" onClick={() => publishAction('CLEAR_MINE')}>내 그림 지우기</button>
                    <button type="button" className="drawing-done-button" onClick={() => onEditingChange(false)}>완료</button>
                </div>
            )}
        </div>
    );
}

export default LobbyDrawingLayer;
