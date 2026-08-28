import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceMode } from '../workspace/WorkspaceModeSwitch';
import ribbonPigSprite from '../../assets/stairs-ribbon-pig.png';
import boarSprite from '../../assets/stairs-boar.png';
import turtleSprite from '../../assets/stairs-turtle.png';

type Direction = 'left' | 'right';
type GameState = 'ready' | 'playing' | 'over';
type CharacterId = 'pig' | 'boar' | 'turtle';

interface Step {
    direction: Direction;
    lane: number;
}

interface Props {
    nickname: string;
    workspaceMode: WorkspaceMode;
    onClose: () => void;
}

const makeSteps = (count: number, startLane = 0, initialDirection?: Direction): Step[] => {
    let lane = startLane;
    let direction: Direction = initialDirection ?? (Math.random() > 0.5 ? 'right' : 'left');
    let straightCount = 2 + Math.floor(Math.random() * 4);
    return Array.from({ length: count }, () => {
        lane += direction === 'right' ? 1 : -1;
        const step = { direction, lane };
        straightCount -= 1;
        if (straightCount === 0) {
            direction = direction === 'right' ? 'left' : 'right';
            straightCount = 2 + Math.floor(Math.random() * 4);
        }
        return step;
    });
};

const makeRound = (): Step[] => {
    const first: Step = { direction: 'right', lane: 1 };
    return [first, ...makeSteps(48, first.lane, first.direction)];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const CHARACTERS: { id: CharacterId; label: string; sprite: string; accent: string }[] = [
    { id: 'pig', label: '리본돼지', sprite: ribbonPigSprite, accent: '#e55b76' },
    { id: 'boar', label: '멧돼지', sprite: boarSprite, accent: '#a27455' },
    { id: 'turtle', label: '거북이', sprite: turtleSprite, accent: '#3eaa79' },
];

export default function InfiniteStairs({ nickname, workspaceMode, onClose }: Props) {
    const [steps, setSteps] = useState<Step[]>(makeRound);
    const [progress, setProgress] = useState(0);
    const [facing, setFacing] = useState<Direction>('right');
    const [characterId, setCharacterId] = useState<CharacterId>(() => {
        const saved = localStorage.getItem('study.stairs.character');
        return saved === 'boar' || saved === 'turtle' || saved === 'pig' ? saved : 'pig';
    });
    const [state, setState] = useState<GameState>('ready');
    const [remaining, setRemaining] = useState(1);
    const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
    const [best, setBest] = useState(() => Number(localStorage.getItem(`study.stairs.best.${nickname || 'guest'}`) ?? 0));

    const stateRef = useRef<GameState>('ready');
    const progressRef = useRef(0);
    const deadlineRef = useRef(0);
    const frameRef = useRef(0);
    const flashTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

    const isExcel = workspaceMode === 'excel';
    const palette = isExcel
        ? { bg: '#f5f8f5', ink: '#20342a', accent: '#217346', hot: '#e99b32', tile: '#cce4d2', edge: '#8ab899', panel: '#ffffff' }
        : { bg: '#151a22', ink: '#e8edf4', accent: '#4ec9b0', hot: '#ffb86c', tile: '#273a51', edge: '#41617e', panel: '#1d2530' };

    const stepLimit = useCallback((score: number) => Math.max(500, 1500 - score * 15), []);

    const reset = useCallback(() => {
        const initial = makeRound();
        setSteps(initial);
        setProgress(0);
        progressRef.current = 0;
        setFacing('right');
        setRemaining(1);
        setFlash(null);
        stateRef.current = 'ready';
        setState('ready');
    }, []);

    const end = useCallback(() => {
        if (stateRef.current !== 'playing') return;
        stateRef.current = 'over';
        setState('over');
        setFlash('bad');
        const score = progressRef.current;
        if (score > 0 && nickname.trim()) {
            void fetch('/api/infinite-stairs/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: nickname.trim(), score }),
            });
        }
        if (score > best) {
            setBest(score);
            localStorage.setItem(`study.stairs.best.${nickname || 'guest'}`, String(score));
        }
    }, [best, nickname]);

    const climb = useCallback(() => {
        if (stateRef.current === 'over') return;
        // 첫 '올라가기' 입력이 게임과 타이머를 시작한다.
        if (stateRef.current === 'ready') {
            const first: Step = { direction: facing, lane: facing === 'right' ? 1 : -1 };
            setSteps([first, ...makeSteps(48, first.lane, first.direction)]);
            progressRef.current = 1;
            setProgress(1);
            stateRef.current = 'playing';
            setState('playing');
            deadlineRef.current = performance.now() + stepLimit(1);
            setFlash('good');
            if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
            flashTimerRef.current = window.setTimeout(() => setFlash(null), 180);
            return;
        }
        if (stateRef.current !== 'playing') return;

        const score = progressRef.current;
        const expected = steps[score]?.direction;
        if (expected !== facing) {
            end();
            return;
        }

        const next = score + 1;
        progressRef.current = next;
        setProgress(next);
        setFlash('good');
        if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => setFlash(null), 180);
        deadlineRef.current = performance.now() + stepLimit(next);
        if (steps.length - next < 18) {
            setSteps((current) => {
                const last = current[current.length - 1];
                return [...current, ...makeSteps(32, last?.lane ?? 0, last?.direction)];
            });
        }
    }, [end, facing, stepLimit, steps]);

    const turn = useCallback(() => {
        if (stateRef.current === 'over') return;
        setFacing((current) => current === 'left' ? 'right' : 'left');
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w' || event.key === ' ') {
                event.preventDefault();
                if (!event.repeat) climb();
            }
            if (event.key.toLowerCase() === 'x') {
                event.preventDefault();
                if (!event.repeat) turn();
            }
            if (event.key === 'Enter' && stateRef.current === 'over') {
                event.preventDefault();
                reset();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [climb, reset, turn]);

    useEffect(() => {
        const animate = (now: number) => {
            if (stateRef.current === 'playing') {
                const limit = stepLimit(progressRef.current);
                const next = clamp((deadlineRef.current - now) / limit, 0, 1);
                setRemaining((previous) => Math.abs(previous - next) > 0.008 ? next : previous);
                if (next <= 0) end();
            }
            frameRef.current = requestAnimationFrame(animate);
        };
        frameRef.current = requestAnimationFrame(animate);
        return () => {
            cancelAnimationFrame(frameRef.current);
            if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
        };
    }, [end, stepLimit]);

    const visibleSteps = useMemo(() => {
        // 플레이어가 화면 중간쯤에 닿을 때까지는 캐릭터만 위로 움직이고,
        // 그 뒤부터는 계단이 아래로 흘러가는 카메라(러닝머신) 방식으로 전환한다.
        const cameraProgress = Math.max(0, progress - 5);
        const first = Math.max(0, cameraProgress - 1);
        return steps.slice(first, cameraProgress + 14).map((step, index) => {
            const absolute = first + index;
            return { ...step, absolute, relative: absolute - cameraProgress };
        });
    }, [progress, steps]);

    const cameraProgress = Math.max(0, progress - 5);
    const playerLane = progress === 0 ? 0 : steps[progress - 1]?.lane ?? 0;
    const playerY = 86 - (Math.max(0, progress - 1) - cameraProgress) * 7.4 - 1.5;
    const character = CHARACTERS.find((item) => item.id === characterId) ?? CHARACTERS[0];

    const selectCharacter = (id: CharacterId) => {
        setCharacterId(id);
        localStorage.setItem('study.stairs.character', id);
    };

    return (
        <section style={{ minHeight: '100%', boxSizing: 'border-box', padding: 'clamp(16px, 3vw, 38px)', color: palette.ink, background: palette.bg, fontFamily: isExcel ? 'Arial, sans-serif' : 'Consolas, "Courier New", monospace', overflow: 'hidden' }}>
            <style>{`
                @keyframes stairs-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
                @keyframes stairs-pop { from { transform: scale(.86); opacity: .2 } to { transform: scale(1); opacity: 1 } }
            `}</style>
            <header style={{ maxWidth: 820, margin: '0 auto 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 11, color: palette.accent, letterSpacing: '0.14em', fontWeight: 700 }}>{isExcel ? 'PERSONAL PRODUCTIVITY' : '// ARCADE MODULE'}</div>
                    <h1 style={{ margin: '3px 0 0', fontSize: 'clamp(21px, 3vw, 30px)', letterSpacing: '-0.04em' }}>끝없는 계단</h1>
                </div>
                <button type="button" onClick={onClose} style={{ border: `1px solid ${palette.edge}`, color: palette.ink, background: 'transparent', padding: '8px 11px', borderRadius: 6, cursor: 'pointer' }}>나가기 ×</button>
            </header>

            <div style={{ maxWidth: 820, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(120px,180px)', gap: 14 }}>
                <div style={{ position: 'relative', height: 'min(66vh, 620px)', minHeight: 440, overflow: 'hidden', borderRadius: 14, background: `linear-gradient(150deg, ${palette.panel}, ${palette.bg})`, border: `1px solid ${palette.edge}`, boxShadow: flash === 'bad' ? `0 0 0 3px #e95454, 0 20px 55px rgba(0,0,0,.25)` : `0 20px 55px rgba(0,0,0,.18)`, transition: 'box-shadow .12s' }}>
                    <div style={{ position: 'absolute', inset: 0, opacity: .28, backgroundImage: `linear-gradient(${palette.edge}22 1px, transparent 1px), linear-gradient(90deg, ${palette.edge}22 1px, transparent 1px)`, backgroundSize: '28px 28px' }} />
                    <div style={{ position: 'absolute', top: 18, left: 20, zIndex: 2, display: 'flex', gap: 12, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11, opacity: .62 }}>SCORE</span><strong style={{ fontSize: 28 }}>{progress}</strong>
                        {progress >= best && progress > 0 && <span style={{ color: palette.hot, fontSize: 11 }}>NEW BEST</span>}
                    </div>
                    <div style={{ position: 'absolute', top: 23, right: 20, width: 118, height: 7, borderRadius: 10, overflow: 'hidden', background: `${palette.edge}77` }}>
                        <div style={{ height: '100%', width: `${remaining * 100}%`, background: remaining < .28 ? '#e95454' : palette.hot, transition: 'width .03s linear' }} />
                    </div>

                    {visibleSteps.map((step) => {
                        const x = 50 + (step.lane - playerLane) * 13;
                        const y = 86 - step.relative * 7.4;
                        return <div key={step.absolute} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 'clamp(58px, 11vw, 84px)', height: 'clamp(23px, 3.8vw, 29px)', transform: 'translate(-50%, -50%) skewX(-18deg)', borderRadius: 4, background: palette.tile, border: `2px solid ${palette.edge}`, boxShadow: `0 6px 0 ${palette.edge}, 0 10px 16px rgba(0,0,0,.18)`, transition: 'top .15s ease, left .15s ease', zIndex: 1 + step.relative }} />;
                    })}
                    <div style={{ position: 'absolute', left: '50%', top: `${playerY}%`, width: 'clamp(42px, 5.5vw, 58px)', transform: `translate(-50%, -100%) ${flash === 'good' ? 'translateY(-7px) rotate(-2deg) scale(1.05)' : 'translateY(0)'} scaleX(${facing === 'right' ? 1 : -1})`, zIndex: 30, transition: 'transform .1s cubic-bezier(.22,.9,.38,1.25), top .16s ease' }} aria-label={`현재 계단 위의 ${character.label}`}>
                        <img src={character.sprite} alt="" draggable={false} style={{ display: 'block', width: '100%', height: 'auto', filter: 'drop-shadow(0 4px 3px rgba(0,0,0,.32))', userSelect: 'none' }} />
                    </div>

                    {state === 'ready' && <div style={{ position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%, -50%)', zIndex: 20, textAlign: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: 11, color: palette.accent, letterSpacing: '.12em', fontWeight: 700 }}>PRESS ↑ TO START</div>
                        <strong style={{ display: 'block', marginTop: 7, fontSize: 20 }}>올라가기 키를 누르면 시작합니다</strong>
                    </div>}
                    {state === 'over' && <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(12,16,21,.38)' }}>
                        <div style={{ animation: 'stairs-pop .25s ease-out', textAlign: 'center', padding: 24, maxWidth: 320, borderRadius: 13, background: `${palette.panel}eF`, border: `1px solid ${palette.edge}`, boxShadow: '0 16px 35px rgba(0,0,0,.22)' }}>
                            <div style={{ fontSize: 12, color: palette.accent, letterSpacing: '.12em', fontWeight: 700 }}>RUN ENDED</div>
                            <strong style={{ display: 'block', margin: '7px 0 9px', fontSize: 24 }}>{progress} 계단까지 올라왔어요</strong>
                            <p style={{ margin: '0 0 17px', fontSize: 13, opacity: .72 }}>최고 기록 {best} · 다시 준비한 뒤 방향키로 출발하세요.</p>
                            <button type="button" onClick={reset} style={{ width: '100%', border: 0, borderRadius: 7, background: palette.accent, color: isExcel ? '#fff' : '#10221f', padding: '11px 14px', cursor: 'pointer', fontWeight: 800 }}>다시 준비</button>
                        </div>
                    </div>}
                </div>

                <aside style={{ border: `1px solid ${palette.edge}`, borderRadius: 12, padding: 16, background: palette.panel, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div><div style={{ fontSize: 10, opacity: .62 }}>BEST · {nickname || 'guest'}</div><strong style={{ fontSize: 28 }}>{best}</strong></div>
                    <div style={{ fontSize: 12, lineHeight: 1.65, opacity: .78 }}>↑ / W / Space는 올라가기, X는 방향 전환입니다. 한 번 오를 때마다 제한 시간이 짧아집니다.</div>
                    <div style={{ border: `1px solid ${palette.edge}`, borderRadius: 8, padding: '9px 10px', fontSize: 12 }}><span style={{ opacity: .64 }}>현재 방향</span><strong style={{ float: 'right', color: palette.accent, fontSize: 18 }}>{facing === 'right' ? '↗' : '↖'}</strong></div>
                    <div>
                        <div style={{ fontSize: 10, opacity: .62, marginBottom: 6 }}>CHARACTER</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                            {CHARACTERS.map((item) => <button key={item.id} type="button" aria-label={`${item.label} 선택`} onClick={() => selectCharacter(item.id)} style={{ minWidth: 0, padding: '5px 2px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${characterId === item.id ? item.accent : palette.edge}`, background: characterId === item.id ? `${item.accent}22` : 'transparent', color: palette.ink }}>
                                <img src={item.sprite} alt="" draggable={false} style={{ display: 'block', width: 29, height: 34, objectFit: 'contain', margin: '0 auto 3px' }} />
                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9 }}>{item.label}</span>
                            </button>)}
                        </div>
                    </div>
                    <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                        <button type="button" aria-label="올라가기" onPointerDown={(event) => { event.preventDefault(); climb(); }} style={{ minHeight: 64, border: 0, borderRadius: 9, cursor: 'pointer', color: isExcel ? '#fff' : '#10221f', background: palette.accent, fontWeight: 800, fontSize: 15 }}>↑ 올라가기</button>
                        <button type="button" aria-label="방향 전환" onPointerDown={(event) => { event.preventDefault(); turn(); }} style={{ minHeight: 58, border: `1px solid ${palette.edge}`, borderRadius: 9, cursor: 'pointer', color: palette.ink, background: 'transparent', fontWeight: 700, fontSize: 14 }}>↻ 방향 전환</button>
                    </div>
                </aside>
            </div>
        </section>
    );
}
