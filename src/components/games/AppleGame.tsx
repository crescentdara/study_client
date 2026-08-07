import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppleBoxGameData, AppleBoxRecord, StudyMoveRequest, StudyStateResponse } from '../../types';
import type { WorkspaceMode } from '../workspace/WorkspaceModeSwitch';

interface Props {
    studyState: StudyStateResponse | null;
    sessionId: string;
    myPlayerIndex: number;
    sendMove: (move: StudyMoveRequest) => void;
    workspaceMode?: WorkspaceMode;
    onCellSelect?: (address: string, value: string) => void;
    /** 혼자 하기에서 새 판을 시작한다 (없으면 버튼을 그리지 않는다) */
    onRestart?: () => void;
    onClose?: () => void;
    restarting?: boolean;
}

/* ── 사과게임(APPLE_BOX) ─────────────────────────────────────────────────────
 * 10행 × 17열 = 170칸, 각 칸에 1~9. 드래그로 사각 범위를 선택하고
 * 그 안 숫자의 합이 정확히 10이면 해당 칸이 사라진다. 사라진 칸은 내려오지 않는다.
 *
 * 방에 있는 모든 사람이 '같은 보드'를 받아 제한 시간 안에 더 많이 없앤 사람이 이긴다.
 * 보드·남은 시간·점수는 서버(AppleBoxService)가 관리하고, 여기서는 드래그한
 * 범위만 APPLE_CLEAR로 보낸다. 서버가 합이 10인지 다시 검증한다.
 *
 * 원작처럼 드래그 중에는 합계도, 성공/실패 색도 보여주지 않는다.
 * 판정은 손을 뗀 순간의 연출로만 알려준다.
 *
 * 화면은 업무 위장용 두 가지 스킨(엑셀 워크시트 / VS Code 숫자 매트릭스)으로 렌더한다.
 * ──────────────────────────────────────────────────────────────────────── */

interface Pop {
    id: number;
    x: number;
    y: number;
    amount: number;
}

/**
 * 정리 성공 연출용 사과 한 알
 *
 * 튀어오르는 높이·좌우로 흩어지는 거리·회전을 알마다 조금씩 달리해서, 같은 자리를
 * 여러 번 맞춰도 똑같은 그림이 반복되지 않게 한다.
 */
interface Fruit {
    id: number;
    x: number;
    y: number;
    drift: number;
    lift: number;
    spin: number;
    delay: number;
}

/* ── 업무 위장 배경 ──────────────────────────────────────────────────────────
 * 게임 영역만 덩그러니 떠 있으면 옆에서 봤을 때 바로 눈에 띈다. 보드 위아래로
 * 실제 작업 중인 문서처럼 보이는 내용을 깔아 화면 전체가 '검토 중인 시트' 또는
 * '열어 둔 소스 파일'로 읽히게 한다. 실제 데이터가 아니고 조작 대상도 아니다.
 * ──────────────────────────────────────────────────────────────────────── */
const DESK_SHEET_HEAD = ['자재코드', '품목명', '전기 재고', '실사 수량', '차이', '확인'];

const DESK_SHEET_ROWS: string[][] = [
    ['SM-1042', '스테인리스 밸브 3/4"', '1,240', '1,238', '-2', '재실사'],
    ['BR-2207', '황동 니플 1/2"', '3,180', '3,180', '0', '완료'],
    ['PK-0918', '내열 개스킷 KIT-A', '742', '739', '-3', '재실사'],
    ['MT-5531', '감속 모터 0.4kW', '96', '96', '0', '완료'],
    ['CB-7714', '제어 케이블 4C x 2.5', '1,905', '1,906', '+1', '확인 중'],
    ['FT-3320', '유량계 DN50', '58', '57', '-1', '재실사'],
    ['SW-1180', '리밋 스위치 LS-22', '412', '412', '0', '완료'],
    ['HS-6602', '고압 호스 SAE100', '867', '866', '-1', '확인 중'],
    ['BT-4409', '앵커 볼트 M12', '5,340', '5,340', '0', '완료'],
    ['OR-2255', 'O링 NBR 세트', '2,118', '2,116', '-2', '재실사'],
];

const DESK_CODE_TOP = [
    'import { openSheet, Range } from "@work/sheet"',
    'import { reconcile } from "./reconcile"',
    '',
    '/** 상반기 재고 실사 대조 — 전기 마감 대비 차이 검출 */',
    'const sheet = await openSheet("inventory/2026H1.xlsx")',
    'const range: Range = sheet.range("A1:Q10")',
];

const DESK_CODE_BOTTOM = [
    '',
    'const diff = reconcile(range, { unit: "EA", tolerance: 0 })',
    'const flagged = diff.filter((row) => row.gap !== 0)',
    '',
    'for (const row of flagged) {',
    '  logger.warn("[재고차이]", row.code, row.gap)',
    '}',
    '',
    'await sheet.save({ status: "검토 중", reviewer: "플랫폼개발팀" })',
    'export default { diff, flagged }',
];

const columnLabel = (index: number) => {
    // 0 → A … 25 → Z … 26 → AA
    let label = '';
    let value = index;
    do {
        label = String.fromCharCode(65 + (value % 26)) + label;
        value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    return label;
};

const formatClock = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export default function AppleGame({
    studyState,
    sessionId,
    myPlayerIndex,
    sendMove,
    workspaceMode = 'vscode',
    onCellSelect,
    onRestart,
    onClose,
    restarting = false,
}: Props) {
    const excel = workspaceMode === 'excel';
    const data = (studyState?.gameData ?? null) as AppleBoxGameData | null;

    const [anchor, setAnchor] = useState<number | null>(null);
    const [cursor, setCursor] = useState<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const [pending, setPending] = useState<Set<number>>(new Set());
    const [hit, setHit] = useState<Set<number>>(new Set());
    const [pops, setPops] = useState<Pop[]>([]);
    const [fruits, setFruits] = useState<Fruit[]>([]);
    const [scoreBump, setScoreBump] = useState(0);
    const [tick, setTick] = useState(0);
    const [opacity, setOpacity] = useState(() => {
        const raw = Number(localStorage.getItem('study.appleOpacity') ?? '100');
        return raw >= 20 && raw <= 100 ? raw : 100;
    });
    const [showOpacity, setShowOpacity] = useState(false);

    const boardRef = useRef<HTMLDivElement | null>(null);
    const deadlineRef = useRef(0);
    const finishSentRef = useRef('');
    const popSeedRef = useRef(0);
    const hitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const rows = data?.rows ?? 10;
    const cols = data?.cols ?? 17;
    const target = data?.target ?? 10;
    const cellCount = rows * cols;
    const board = data?.board ?? [];
    const finished = studyState?.status === 'FINISHED';
    /** 방장이 시작을 누른 뒤에만 시계가 흐르고 정리가 반영된다 */
    const playing = studyState?.status === 'PLAYING';

    const myState = data?.playerStates?.[String(myPlayerIndex)];
    const serverCleared = myState?.cleared ?? [];

    /** 서버가 확인한 칸 + 아직 응답 전인 내 정리분 */
    const myCleared = useMemo(() => {
        const set = new Set<number>(serverCleared);
        pending.forEach((index) => set.add(index));
        return set;
    }, [serverCleared, pending]);

    const score = myCleared.size;
    const remainingCells = cellCount - score;

    // 서버가 확인해 준 칸은 낙관적 목록에서 지운다
    useEffect(() => {
        if (pending.size === 0) return;
        const confirmed = new Set(serverCleared);
        setPending((previous) => {
            const next = new Set([...previous].filter((index) => !confirmed.has(index)));
            return next.size === previous.size ? previous : next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverCleared.length]);

    // ── 남은 시간 — 서버가 보낸 remainingSeconds로 매번 재보정한다 ────────────
    useEffect(() => {
        if (!data) return;
        deadlineRef.current = Date.now() + data.remainingSeconds * 1000;
    }, [data?.remainingSeconds, data?.instanceId]);

    useEffect(() => {
        if (finished || !playing) return;
        const id = setInterval(() => setTick((value) => value + 1), 200);
        return () => clearInterval(id);
    }, [finished, playing]);

    const duration = data?.durationSeconds ?? 120;
    // 시작 전에는 제한 시간이 그대로 멈춰 있고, 시작한 뒤에만 줄어든다
    const msLeft = finished ? 0 : playing ? Math.max(0, deadlineRef.current - Date.now()) : duration * 1000;
    const secondsLeft = Math.ceil(msLeft / 1000);
    const gaugeRatio = Math.max(0, Math.min(1, msLeft / (duration * 1000)));
    void tick; // 게이지를 부드럽게 갱신하기 위한 리렌더 트리거

    // 내 시간이 끝나면 서버에 알린다 (모두 끝나면 서버가 순위를 확정)
    useEffect(() => {
        if (!data || finished || !playing || myPlayerIndex < 0) return;
        if (secondsLeft > 0) return;
        if (finishSentRef.current === data.instanceId) return;
        finishSentRef.current = data.instanceId;
        sendMove({ moveType: 'APPLE_FINISH', data: '', sessionId });
    }, [secondsLeft, finished, data, myPlayerIndex, sendMove, sessionId]);

    // 새 판이 시작되면 낙관적 상태를 비운다
    useEffect(() => {
        setPending(new Set());
        setHit(new Set());
        setPops([]);
        setFruits([]);
        setAnchor(null);
        setCursor(null);
        setDragging(false);
    }, [data?.instanceId]);

    useEffect(() => () => { if (hitTimerRef.current) clearTimeout(hitTimerRef.current); }, []);

    // ── 선택 범위 ───────────────────────────────────────────────────────────
    const bounds = useMemo(() => {
        if (anchor === null || cursor === null) return null;
        const ar = Math.floor(anchor / cols), ac = anchor % cols;
        const cr = Math.floor(cursor / cols), cc = cursor % cols;
        return {
            top: Math.min(ar, cr),
            bottom: Math.max(ar, cr),
            left: Math.min(ac, cc),
            right: Math.max(ac, cc),
        };
    }, [anchor, cursor, cols]);

    const selection = useMemo(() => {
        if (!bounds) return { sum: 0, indexes: [] as number[] };
        const indexes: number[] = [];
        let sum = 0;
        for (let row = bounds.top; row <= bounds.bottom; row += 1) {
            for (let column = bounds.left; column <= bounds.right; column += 1) {
                const index = row * cols + column;
                if (myCleared.has(index)) continue;
                indexes.push(index);
                sum += board[index] ?? 0;
            }
        }
        return { sum, indexes };
    }, [bounds, myCleared, board, cols]);

    /** 정리된 칸들의 화면상 중심 — "+N" 효과를 띄울 위치 */
    const popPosition = useCallback((indexes: number[]) => {
        const container = boardRef.current;
        if (!container || indexes.length === 0) return null;
        const base = container.getBoundingClientRect();
        let sumX = 0, sumY = 0, count = 0;
        indexes.forEach((index) => {
            const cell = container.querySelector<HTMLElement>(`[data-cell="${index}"]`);
            if (!cell) return;
            const rect = cell.getBoundingClientRect();
            sumX += rect.left + rect.width / 2 - base.left;
            sumY += rect.top + rect.height / 2 - base.top;
            count += 1;
        });
        return count === 0 ? null : { x: sumX / count, y: sumY / count };
    }, []);

    const playable = playing && !finished && secondsLeft > 0 && myPlayerIndex >= 0 && !!data;

    const beginDrag = (index: number) => {
        if (!playable || myCleared.has(index)) return;
        setAnchor(index);
        setCursor(index);
        setDragging(true);
    };

    const commitRef = useRef<() => void>(() => {});
    commitRef.current = () => {
        if (!dragging) return;
        setDragging(false);
        setAnchor(null);
        setCursor(null);
        if (!playable || !bounds) return;
        if (selection.sum !== target || selection.indexes.length === 0) return;

        const cleared = selection.indexes;
        const position = popPosition(cleared);

        setPending((previous) => {
            const next = new Set(previous);
            cleared.forEach((index) => next.add(index));
            return next;
        });
        setHit(new Set(cleared));
        setScoreBump((value) => value + 1);
        if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
        hitTimerRef.current = setTimeout(() => setHit(new Set()), 420);

        if (position) {
            const id = (popSeedRef.current += 1);
            setPops((previous) => [...previous, { id, x: position.x, y: position.y, amount: cleared.length }]);
            setTimeout(() => setPops((previous) => previous.filter((pop) => pop.id !== id)), 760);

            // 맞춘 자리에서 사과 두세 개가 좌우 사선으로 벌어지며 떨어진다.
            // lanes는 좌/우 방향과 벌어지는 정도(-1 ~ +1) — 위로만 솟는 알이 없도록
            // 가운데(0)는 쓰지 않고 항상 옆으로 튼다.
            const count = Math.min(3, Math.max(2, Math.floor(cleared.length / 2)));
            const lanes = count === 2
                ? [-1, 1]
                : [-1, 1, Math.random() < 0.5 ? -0.45 : 0.45];
            const spawned: Fruit[] = lanes.slice(0, count).map((lane, order) => {
                const side = lane * (0.85 + Math.random() * 0.3);
                return {
                    id: (popSeedRef.current += 1),
                    x: position.x + lane * 6,
                    y: position.y,
                    drift: Math.round(side * 210),
                    lift: 32 + Math.round(Math.random() * 22),
                    // 튼 방향으로 굴러가듯 회전 방향을 맞춘다
                    spin: Math.round(side * (240 + Math.random() * 160)),
                    delay: order * 22,
                };
            });
            setFruits((previous) => [...previous, ...spawned]);
            const spawnedIds = new Set(spawned.map((fruit) => fruit.id));
            setTimeout(
                () => setFruits((previous) => previous.filter((fruit) => !spawnedIds.has(fruit.id))),
                1500,
            );
        }

        sendMove({
            moveType: 'APPLE_CLEAR',
            data: '',
            sessionId,
            payload: { r1: bounds.top, c1: bounds.left, r2: bounds.bottom, c2: bounds.right },
        });
    };

    useEffect(() => {
        const finish = () => commitRef.current();
        window.addEventListener('mouseup', finish);
        window.addEventListener('blur', finish);
        return () => {
            window.removeEventListener('mouseup', finish);
            window.removeEventListener('blur', finish);
        };
    }, []);

    const reportCell = (index: number) => {
        if (!excel || !onCellSelect) return;
        const address = `${columnLabel(index % cols)}${Math.floor(index / cols) + 1}`;
        onCellSelect(address, String(board[index] ?? ''));
    };

    // ── 참가자별 점수 ───────────────────────────────────────────────────────
    const playerNames = studyState?.playerNames ?? [];
    const scoreboard = useMemo(() => {
        const states = data?.playerStates ?? {};
        return playerNames
            .map((nickname, index) => {
                const state = states[String(index)];
                const isMine = index === myPlayerIndex;
                return {
                    index,
                    nickname,
                    isMine,
                    // 내 점수는 낙관적 반영분까지 즉시 보여준다
                    score: isMine ? Math.max(score, state?.score ?? 0) : state?.score ?? 0,
                    finished: state?.finished ?? false,
                };
            })
            .sort((left, right) => right.score - left.score || left.index - right.index);
    }, [data?.playerStates, playerNames, myPlayerIndex, score]);

    // 게임 화면에서는 이번 주 순위를 보여준다 (누적 순위는 로비에서 볼 수 있다)
    const leaderboard: AppleBoxRecord[] = data?.weeklyLeaderboard ?? [];
    const finalRanking = data?.finalRanking ?? [];

    // ── 셀 클래스 ───────────────────────────────────────────────────────────
    const cellClass = (index: number) => {
        const classes = ['apple-cell'];
        if (myCleared.has(index)) classes.push('apple-cell--empty');
        if (hit.has(index)) classes.push('apple-cell--hit');
        if (bounds) {
            const row = Math.floor(index / cols), column = index % cols;
            const inside = row >= bounds.top && row <= bounds.bottom && column >= bounds.left && column <= bounds.right;
            if (inside) {
                // 합계가 맞았는지는 손을 뗄 때까지 알려주지 않는다 — 선택 색은 항상 동일
                classes.push('apple-cell--sel');
                if (row === bounds.top) classes.push('apple-cell--edge-t');
                if (row === bounds.bottom) classes.push('apple-cell--edge-b');
                if (column === bounds.left) classes.push('apple-cell--edge-l');
                if (column === bounds.right) classes.push('apple-cell--edge-r');
            }
        }
        return classes.join(' ');
    };

    const rowSelected = (row: number) => !!bounds && row >= bounds.top && row <= bounds.bottom;
    const columnSelected = (column: number) => !!bounds && column >= bounds.left && column <= bounds.right;

    if (!data) {
        return (
            <div className={`apple-game apple-game--${workspaceMode}`}>
                <div className="apple-stage">
                    <div className="apple-hint">
                        {excel ? '대조표를 불러오는 중입니다…' : '// loading board...'}
                    </div>
                </div>
            </div>
        );
    }

    const gaugeTone = secondsLeft <= 10 ? ' is-danger' : secondsLeft <= 30 ? ' is-warn' : '';

    return (
        <div
            className={`apple-game apple-game--${workspaceMode}`}
            style={{ opacity: opacity / 100, ['--apple-cols' as string]: cols } as React.CSSProperties}
        >
            {/* ── 상단 밴드 ─────────────────────────────────────────────── */}
            <div className="apple-band">
                {excel ? (
                    <>
                        <span className="apple-band__title">▣ 상반기 재고 실사 대조표</span>
                        <span className="apple-band__meta">
                            범위 {columnLabel(0)}1:{columnLabel(cols - 1)}{rows} · 참가 {playerNames.length}명
                        </span>
                    </>
                ) : (
                    <>
                        <span className="apple-band__title">APPLE-BOX</span>
                        <span className="apple-band__meta">{`sum === ${target} → splice()  ·  ${playerNames.length}p`}</span>
                    </>
                )}
                <span className="apple-band__spacer" />
                {onRestart && (
                    <button
                        type="button"
                        className="apple-btn"
                        onClick={onRestart}
                        disabled={restarting}
                    >
                        {restarting
                            ? (excel ? '준비 중…' : 'starting...')
                            : (excel ? '새 대조 시작' : 'new round')}
                    </button>
                )}
                <button
                    type="button"
                    className={`apple-btn${showOpacity ? ' is-on' : ''}`}
                    onClick={() => setShowOpacity((value) => !value)}
                    title="불투명도"
                >
                    {excel ? '표시' : '+'}
                </button>
                {onClose && (
                    <button type="button" className="apple-btn" onClick={onClose}>
                        {excel ? '닫기' : 'exit'}
                    </button>
                )}
            </div>

            {showOpacity && (
                <div className="apple-opacity">
                    <span>{excel ? '창 투명도' : 'opacity'}</span>
                    <input
                        type="range"
                        min={20}
                        max={100}
                        value={opacity}
                        onChange={(event) => {
                            const value = Number(event.target.value);
                            setOpacity(value);
                            localStorage.setItem('study.appleOpacity', String(value));
                        }}
                    />
                    <small>{opacity}%</small>
                </div>
            )}

            <div className="apple-stage">
                <div className="apple-desk">
                    {/* ── 위쪽 업무 배경 ───────────────────────────────────── */}
                    {excel ? (
                        <div className="apple-desk__doc" aria-hidden="true">
                            <div className="apple-desk__docrow">
                                <b>상반기 재고 실사 대조</b>
                                <span>작성일 2026-08-06</span>
                                <span>담당 플랫폼개발팀</span>
                                <span>문서 상태 검토 중</span>
                            </div>
                            <div className="apple-desk__docrow apple-desk__docrow--sub">
                                <span>대조 기준 전기 마감 재고 · 단위 EA</span>
                                <span>검증 범위 {columnLabel(0)}1:{columnLabel(cols - 1)}{rows}</span>
                                <span>승인 대기 3건</span>
                            </div>
                        </div>
                    ) : (
                        <div className="apple-desk__code" aria-hidden="true">
                            {DESK_CODE_TOP.map((line, index) => (
                                <div className="apple-desk__line" key={`top-${index}`}>
                                    <span className="apple-desk__ln">{index + 1}</span>
                                    <code>{line}</code>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="apple-layout">
                        <div className="apple-main">
                            {/* ── 남은 시간 게이지 — 엑셀 조건부 서식의 데이터 표시줄처럼 ── */}
                            <div className={`apple-gauge${gaugeTone}`}>
                                <span className="apple-gauge__caption">{excel ? '검증 진행 시간' : 'time'}</span>
                                <span className="apple-gauge__track">
                                    <i style={{ width: `${gaugeRatio * 100}%` }} />
                                </span>
                                <b className="apple-gauge__value">{formatClock(secondsLeft)}</b>
                            </div>

                            {/* ── 보드 ─────────────────────────────────────────── */}
                            <div className="apple-board" ref={boardRef}>
                                <div className="apple-sheet" role="grid" aria-label="재고 실사 대조 범위">
                                    <div className="apple-sheet__corner" aria-hidden="true" />
                                    {Array.from({ length: cols }, (_, column) => (
                                        <div
                                            key={`col-${column}`}
                                            className={`apple-sheet__colhead${columnSelected(column) ? ' is-selected' : ''}`}
                                        >
                                            {excel ? columnLabel(column) : column + 1}
                                        </div>
                                    ))}
                                    {Array.from({ length: rows }, (_, row) => (
                                        <div key={`row-${row}`} style={{ display: 'contents' }}>
                                            <div className={`apple-sheet__rowhead${rowSelected(row) ? ' is-selected' : ''}`}>
                                                {row + 1}
                                            </div>
                                            {Array.from({ length: cols }, (_, column) => {
                                                const index = row * cols + column;
                                                const cleared = myCleared.has(index);
                                                return (
                                                    <div
                                                        key={index}
                                                        role="gridcell"
                                                        data-cell={index}
                                                        className={cellClass(index)}
                                                        onMouseDown={(event) => {
                                                            if (event.button !== 0) return;
                                                            event.preventDefault();
                                                            beginDrag(index);
                                                            reportCell(index);
                                                        }}
                                                        onMouseEnter={() => {
                                                            if (dragging) {
                                                                setCursor(index);
                                                                reportCell(index);
                                                            }
                                                        }}
                                                    >
                                                        {cleared ? '' : board[index]}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                {/* 정리 성공 연출 — 없앤 칸 수가 위로 떠오른다 */}
                                {pops.map((pop) => (
                                    <span key={pop.id} className="apple-pop" style={{ left: pop.x, top: pop.y }}>
                                        +{pop.amount}
                                    </span>
                                ))}

                                {/* 정리 성공 연출 — 사과가 튀어올랐다가 아래로 떨어진다.
                                    떨어지는 사과가 스크롤 영역을 늘리지 않도록 보드 안에서 잘라낸다. */}
                                {fruits.length > 0 && (
                                    <div className="apple-fruit-layer" aria-hidden="true">
                                        {fruits.map((fruit) => (
                                            <span
                                                key={fruit.id}
                                                className="apple-fruit"
                                                style={{
                                                    left: fruit.x,
                                                    top: fruit.y,
                                                    animationDelay: `${fruit.delay}ms`,
                                                    ['--apple-drift' as string]: `${fruit.drift}px`,
                                                    ['--apple-lift' as string]: `${fruit.lift}px`,
                                                    ['--apple-spin' as string]: `${fruit.spin}deg`,
                                                } as React.CSSProperties}
                                            >
                                                🍎
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* ── 결과 ─────────────────────────────────────── */}
                                {finished && (
                                    <div className="apple-overlay">
                                        <div className="apple-dialog">
                                            <strong>
                                                {excel ? '실사 대조 종료' : 'match finished'}
                                            </strong>
                                            <ol className="apple-result-list">
                                                {(finalRanking.length > 0
                                                    ? finalRanking
                                                    : scoreboard.map((entry) => entry.index)
                                                ).map((playerIndex, position) => {
                                                    const entry = scoreboard.find((item) => item.index === playerIndex);
                                                    if (!entry) return null;
                                                    return (
                                                        <li key={playerIndex} className={entry.isMine ? 'is-mine' : ''}>
                                                            <span className="apple-result-rank">{position + 1}</span>
                                                            <span className="apple-result-name">
                                                                {entry.nickname}
                                                                {entry.isMine && <em> (나)</em>}
                                                            </span>
                                                            <b>{entry.score}</b>
                                                        </li>
                                                    );
                                                })}
                                            </ol>
                                            {onRestart && (
                                                <button
                                                    type="button"
                                                    className="apple-btn apple-dialog__again"
                                                    onClick={onRestart}
                                                    disabled={restarting}
                                                >
                                                    {restarting
                                                        ? (excel ? '준비 중…' : 'starting...')
                                                        : (excel ? '다시 대조하기' : 'play again')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── 참가자별 처리 현황 ───────────────────────────── */}
                            <div className="apple-scores">
                                <div className="apple-scores__head">
                                    {excel ? '참가자별 처리 현황' : '// scores'}
                                </div>
                                {scoreboard.map((entry, position) => (
                                    <div
                                        key={entry.index}
                                        className={`apple-scores__row${entry.isMine ? ' is-mine' : ''}`}
                                    >
                                        <span className="apple-scores__rank">{position + 1}</span>
                                        <span className="apple-scores__name">
                                            {entry.nickname}
                                            {entry.isMine && <em> (나)</em>}
                                        </span>
                                        <span className="apple-scores__bar">
                                            <i style={{ width: `${(entry.score / cellCount) * 100}%` }} />
                                        </span>
                                        <b className={`apple-scores__score${entry.isMine && scoreBump ? ' is-bump' : ''}`}>
                                            {entry.score}
                                        </b>
                                        <small>{entry.finished ? (excel ? '완료' : 'done') : ''}</small>
                                    </div>
                                ))}
                                <div className="apple-scores__foot">
                                    {excel
                                        ? `잔여 ${remainingCells}건 · 셀 범위를 드래그해 합계 ${target}을 맞추면 정리됩니다`
                                        : `remaining ${remainingCells} · drag a rect, sum must equal ${target}`}
                                </div>
                            </div>
                        </div>

                        {/* ── 이번 주 최고 점수 순위 — 항상 옆에 띄워 둔다 ───── */}
                        <aside className="apple-ranking">
                            <div className="apple-ranking__head">
                                {excel ? '주간 실적 순위' : '// top scores (this week)'}
                            </div>
                            <div className="apple-ranking__note">
                                {excel ? '매주 월요일 집계 초기화' : '// resets every monday'}
                            </div>
                            {leaderboard.length === 0 ? (
                                <div className="apple-ranking__empty">
                                    {excel ? '이번 주 기록이 없습니다.' : '// no records this week'}
                                </div>
                            ) : (
                                leaderboard.map((record) => (
                                    <div
                                        key={record.nickname}
                                        className={`apple-ranking__row${
                                            record.nickname === playerNames[myPlayerIndex] ? ' is-mine' : ''
                                        }`}
                                    >
                                        <span className="apple-ranking__rank">{record.rank}</span>
                                        <span className="apple-ranking__name">{record.nickname}</span>
                                        <b>{record.best}</b>
                                    </div>
                                ))
                            )}
                        </aside>
                    </div>

                    {/* ── 아래쪽 업무 배경 ─────────────────────────────────── */}
                    {excel ? (
                        <div className="apple-desk__sheet" aria-hidden="true">
                            <div className="apple-desk__row is-head">
                                {DESK_SHEET_HEAD.map((cell) => <span key={cell}>{cell}</span>)}
                            </div>
                            {DESK_SHEET_ROWS.map((row) => (
                                <div className="apple-desk__row" key={row[0]}>
                                    {row.map((cell, index) => <span key={`${row[0]}-${index}`}>{cell}</span>)}
                                </div>
                            ))}
                            <div className="apple-desk__row is-foot">
                                <span>합계</span>
                                <span>차이 6건 · 확인 필요 2건</span>
                                <span>15,918</span>
                                <span>15,910</span>
                                <span>-8</span>
                                <span>진행</span>
                            </div>
                        </div>
                    ) : (
                        <div className="apple-desk__code" aria-hidden="true">
                            {DESK_CODE_BOTTOM.map((line, index) => (
                                <div className="apple-desk__line" key={`bottom-${index}`}>
                                    <span className="apple-desk__ln">
                                        {DESK_CODE_TOP.length + rows + index + 1}
                                    </span>
                                    <code>{line}</code>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
