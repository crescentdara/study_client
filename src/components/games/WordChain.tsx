import { useState, useEffect, useRef, useCallback } from 'react';

interface Props { onClose: () => void; }

const DUEUM_MAP: Record<string, string> = {
    '라':'나','락':'낙','란':'난','람':'남','랑':'낭','래':'내','량':'양','려':'여','력':'역','련':'연',
    '렬':'열','렵':'엽','령':'영','례':'예','로':'노','록':'녹','론':'논','롱':'농','뢰':'뇌','료':'요',
    '룡':'용','루':'누','류':'유','륙':'육','륜':'윤','률':'율','륭':'융','릉':'능','리':'이','린':'인',
    '림':'임','립':'입','냐':'야','녀':'여','뇨':'요','뉴':'유','니':'이',
};

function dueumVariants(syl: string): string[] {
    const s = new Set([syl]);
    if (DUEUM_MAP[syl]) s.add(DUEUM_MAP[syl]);
    for (const [k, v] of Object.entries(DUEUM_MAP)) { if (v === syl) s.add(k); }
    return Array.from(s);
}

function isValidStart(word: string, prev: string): boolean {
    if (!prev) return true;
    return dueumVariants(prev[prev.length - 1]).includes(word[0]);
}

interface Player { name: string; eliminated: boolean; }

const P_COLORS = ['#569cd6', '#4ec9b0', '#ce9178', '#c586c0'];

export default function WordChain({ onClose }: Props) {
    // ── setup ──────────────────────────────────────────────────────────────────
    const [phase, setPhase] = useState<'setup' | 'game'>('setup');
    const [playerCount, setPlayerCount] = useState(4);
    const [nameInputs, setNameInputs] = useState(['플레이어 1', '플레이어 2', '플레이어 3', '플레이어 4']);
    const [timeLimitSetting, setTimeLimitSetting] = useState(7);

    // ── game display state ─────────────────────────────────────────────────────
    const [players, setPlayers] = useState<Player[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(7);
    const [lastWord, setLastWord] = useState('');
    const [chainHint, setChainHint] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [feedback, setFeedback] = useState('');
    const [input, setInput] = useState('');
    const [gameOver, setGameOver] = useState(false);
    const [goTitle, setGoTitle] = useState('');
    const [goSub, setGoSub] = useState('');

    // ── opacity ────────────────────────────────────────────────────────────────
    const [opacity, setOpacity] = useState<number>(() => {
        const raw = parseFloat(localStorage.getItem('study.wordchainOpacity') ?? '100');
        return Math.max(20, Math.min(100, raw <= 1 ? Math.round(raw * 100) : raw));
    });
    const [showOpacity, setShowOpacity] = useState(false);

    // ── refs for timer callback (avoid stale closure) ──────────────────────────
    const activeRef = useRef(false);
    const curIdxRef = useRef(0);
    const playersRef = useRef<Player[]>([]);
    const timeLimitRef = useRef(7);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const historyRef = useRef<HTMLDivElement>(null);
    // game logic refs
    const lastWordRef = useRef('');
    const usedWordsRef = useRef(new Set<string>());

    const syncCurIdx = (i: number) => { curIdxRef.current = i; setCurrentIdx(i); };
    const syncPlayers = (p: Player[]) => { playersRef.current = p; setPlayers(p); };

    const stopTimer = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    const handleTimeout = useCallback(() => {
        if (!activeRef.current) return;
        activeRef.current = false;
        stopTimer();
        const idx = curIdxRef.current;
        const ps = playersRef.current.map((p, i) => i === idx ? { ...p, eliminated: true } : p);
        syncPlayers(ps);
        setGameOver(true);
        setGoTitle('게임 종료');
        setGoSub(`${playersRef.current[idx]?.name ?? ''}님이 시간 안에 답하지 못했습니다`);
    }, []);

    const startTimer = useCallback((limit: number) => {
        stopTimer();
        setTimeLeft(limit);
        let rem = limit;
        timerRef.current = setInterval(() => {
            rem -= 0.05;
            if (rem <= 0) {
                clearInterval(timerRef.current!); timerRef.current = null;
                setTimeLeft(0);
                handleTimeout();
            } else {
                setTimeLeft(rem);
            }
        }, 50);
    }, [handleTimeout]);

    const nextTurn = useCallback((psCurrent: Player[], nextI: number, limit: number) => {
        // skip eliminated
        let i = nextI;
        let loops = 0;
        while (psCurrent[i]?.eliminated && loops < psCurrent.length) { i = (i + 1) % psCurrent.length; loops++; }
        syncCurIdx(i);
        startTimer(limit);
        setTimeout(() => inputRef.current?.focus(), 10);
    }, [startTimer]);

    const submitWord = useCallback(() => {
        if (!activeRef.current) return;
        const word = input.trim();
        if (!word) return;

        if (word.length < 2) { setFeedback('두 글자 이상 입력하세요'); return; }
        if (!isValidStart(word, lastWordRef.current)) {
            const variants = dueumVariants(lastWordRef.current[lastWordRef.current.length - 1]);
            setFeedback(`'${variants.join("' / '")}'로 시작하는 단어를 입력하세요`);
            return;
        }
        if (usedWordsRef.current.has(word)) { setFeedback('이미 사용된 단어입니다'); return; }

        usedWordsRef.current.add(word);
        lastWordRef.current = word;

        setLastWord(word);
        setHistory(prev => [...prev, word]);
        setFeedback('');
        setInput('');

        const lastSyl = word[word.length - 1];
        const variants = dueumVariants(lastSyl);
        setChainHint(variants.length > 1
            ? `다음: '${variants.join("' / '")}'로 시작`
            : `다음: '${lastSyl}'로 시작`);

        setTimeout(() => {
            if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }, 20);

        // count remaining active players
        const alive = playersRef.current.filter(p => !p.eliminated);
        if (alive.length === 1) {
            activeRef.current = false;
            stopTimer();
            setGameOver(true);
            setGoTitle(`${alive[0].name} 승리!`);
            setGoSub('끝까지 살아남았습니다 🎉');
            return;
        }

        let next = (curIdxRef.current + 1) % playersRef.current.length;
        while (playersRef.current[next]?.eliminated) next = (next + 1) % playersRef.current.length;
        nextTurn(playersRef.current, next, timeLimitRef.current);
    }, [input, nextTurn]);

    // Enter key
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') submitWord(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [submitWord]);

    const startGame = () => {
        const ps: Player[] = nameInputs.slice(0, playerCount).map((name, i) => ({
            name: name.trim() || `플레이어 ${i + 1}`,
            eliminated: false,
        }));
        timeLimitRef.current = timeLimitSetting;
        activeRef.current = true;
        lastWordRef.current = '';
        usedWordsRef.current = new Set();
        syncPlayers(ps);
        syncCurIdx(0);
        setLastWord('');
        setChainHint('');
        setHistory([]);
        setFeedback('');
        setInput('');
        setGameOver(false);
        setPhase('game');
        setTimeout(() => {
            startTimer(timeLimitSetting);
            inputRef.current?.focus();
        }, 50);
    };

    const restartSetup = () => {
        stopTimer();
        activeRef.current = false;
        setPhase('setup');
        setGameOver(false);
    };

    // cleanup on unmount
    useEffect(() => () => { stopTimer(); activeRef.current = false; }, []);

    const pct = Math.max(0, (timeLeft / timeLimitRef.current) * 100);
    const timerColor = pct > 50 ? '#4ec9b0' : pct > 20 ? '#ce9178' : '#f14c4c';

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e', overflow: 'hidden', opacity: opacity / 100, transition: 'opacity 0.2s' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderBottom: '1px solid #3e3e42', flexShrink: 0, background: '#252526' }}>
                <span style={{ color: '#569cd6', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>끝말잇기</span>
                <span style={{ color: '#6a9955', fontSize: '11px' }}>// 쿵쿵따</span>
                <button onClick={() => setShowOpacity(v => !v)}
                    style={{ marginLeft: 'auto', background: showOpacity ? 'rgba(78,201,176,0.2)' : 'transparent', border: showOpacity ? '1px solid #4ec9b0' : '1px solid transparent', color: showOpacity ? '#4ec9b0' : '#6a9955', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 4px', borderRadius: '3px', transition: 'all 0.15s' }}>
                    +
                </button>
                <button onClick={onClose}
                    style={{ background: 'transparent', border: 'none', color: '#858585', fontSize: '14px', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>
                    ✕
                </button>
            </div>
            {showOpacity && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderBottom: '1px solid #3e3e42', background: '#252526', flexShrink: 0 }}>
                    <span style={{ color: '#6a9955', fontSize: '10px', whiteSpace: 'nowrap' }}>opacity</span>
                    <input type="range" min={20} max={100} value={opacity}
                        onChange={e => { const v = Number(e.target.value); setOpacity(v); localStorage.setItem('study.wordchainOpacity', String(v)); }}
                        style={{ flex: 1, accentColor: '#4ec9b0', cursor: 'pointer' }} />
                    <span style={{ color: '#858585', fontSize: '10px', width: '28px', textAlign: 'right' }}>{opacity}%</span>
                </div>
            )}

            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                {phase === 'setup' ? (
                    /* ── SETUP ── */
                    <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* time limit */}
                        <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ color: '#858585', fontSize: '12px' }}>제한시간</span>
                                <span style={{ color: '#4ec9b0', fontSize: '14px', fontWeight: 600 }}>{timeLimitSetting}초</span>
                            </div>
                            <input type="range" min={3} max={20} step={1} value={timeLimitSetting}
                                onChange={e => setTimeLimitSetting(Number(e.target.value))}
                                style={{ width: '100%', accentColor: '#4ec9b0', cursor: 'pointer' }} />
                        </div>

                        {/* player count */}
                        <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '14px' }}>
                            <div style={{ color: '#858585', fontSize: '12px', marginBottom: '10px' }}>참가자 수</div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                                {[2, 3, 4].map(n => (
                                    <button key={n} onClick={() => setPlayerCount(n)}
                                        style={{ flex: 1, padding: '6px', fontSize: '13px', borderRadius: '3px', cursor: 'pointer', background: playerCount === n ? 'rgba(86,156,214,0.18)' : 'transparent', border: `1px solid ${playerCount === n ? '#569cd6' : '#3e3e42'}`, color: playerCount === n ? '#569cd6' : '#858585', transition: 'all 0.12s' }}>
                                        {n}명
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${playerCount}, 1fr)`, gap: '8px' }}>
                                {Array.from({ length: playerCount }, (_, i) => (
                                    <div key={i}>
                                        <div style={{ fontSize: '10px', color: P_COLORS[i], marginBottom: '4px', textAlign: 'center' }}>P{i + 1}</div>
                                        <input
                                            value={nameInputs[i]}
                                            onChange={e => setNameInputs(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                                            maxLength={8}
                                            style={{ width: '100%', textAlign: 'center', fontSize: '12px', padding: '5px 4px', background: '#1e1e1e', border: '1px solid #3e3e42', borderRadius: '3px', color: '#d4d4d4' }} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={startGame}
                            style={{ padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #569cd6', cursor: 'pointer', background: 'rgba(86,156,214,0.15)', color: '#569cd6', fontWeight: 600, transition: 'all 0.12s' }}>
                            게임 시작
                        </button>
                    </div>
                ) : (
                    /* ── GAME ── */
                    <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* players */}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${players.length}, 1fr)`, gap: '8px' }}>
                            {players.map((p, i) => (
                                <div key={i} style={{ background: '#252526', border: `1px solid ${i === currentIdx && !p.eliminated && !gameOver ? P_COLORS[i] : '#3e3e42'}`, borderRadius: '4px', padding: '8px 6px', textAlign: 'center', opacity: p.eliminated ? 0.35 : 1, transition: 'all 0.2s' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 500, color: p.eliminated ? '#858585' : P_COLORS[i], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                    <div style={{ fontSize: '10px', color: '#858585', marginTop: '2px' }}>
                                        {p.eliminated ? '탈락' : i === currentIdx && !gameOver ? '차례' : '대기'}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* timer */}
                        <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', color: '#858585' }}>제한시간</span>
                                <span style={{ fontSize: '28px', fontWeight: 600, color: timerColor, lineHeight: 1, fontFamily: 'monospace', transition: 'color 0.2s' }}>
                                    {Math.ceil(timeLeft)}
                                </span>
                            </div>
                            <div style={{ height: '5px', background: '#3e3e42', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: timerColor, borderRadius: '999px', transition: 'width 0.05s linear, background 0.2s' }} />
                            </div>
                        </div>

                        {/* word display */}
                        <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: '22px', fontWeight: 500, color: '#d4d4d4', marginBottom: '4px' }}>
                                {lastWord || '시작 단어를 입력하세요'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6a9955' }}>{chainHint}</div>
                        </div>

                        {/* input */}
                        {!gameOver && (
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => { setInput(e.target.value); setFeedback(''); }}
                                placeholder={`${players[currentIdx]?.name ?? ''} 차례 — 단어 입력 후 Enter`}
                                disabled={gameOver}
                                style={{ width: '100%', textAlign: 'center', fontSize: '16px', padding: '10px', background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', color: '#d4d4d4' }} />
                        )}

                        {feedback && (
                            <div style={{ fontSize: '12px', color: '#f14c4c', textAlign: 'center' }}>{feedback}</div>
                        )}

                        {/* game over overlay */}
                        {gameOver && (
                            <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '20px', textAlign: 'center' }}>
                                <div style={{ fontSize: '18px', fontWeight: 600, color: '#d4d4d4', marginBottom: '6px' }}>{goTitle}</div>
                                <div style={{ fontSize: '13px', color: '#858585', marginBottom: '16px' }}>{goSub}</div>
                                <button onClick={restartSetup}
                                    style={{ padding: '8px 24px', fontSize: '13px', borderRadius: '4px', border: '1px solid #569cd6', cursor: 'pointer', background: 'rgba(86,156,214,0.15)', color: '#569cd6' }}>
                                    다시 설정하기
                                </button>
                            </div>
                        )}

                        {/* history */}
                        {history.length > 0 && (
                            <div ref={historyRef} style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '80px', overflowY: 'auto' }}>
                                {history.map((w, i) => (
                                    <span key={i} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '3px', background: '#2d2d2d', color: '#858585', border: '1px solid #3e3e42' }}>{w}</span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
