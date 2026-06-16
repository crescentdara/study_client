import { useState, useEffect, useRef, useCallback } from 'react';
import { StudyStateResponse, StudyMoveRequest, WordChainGameData } from '../../types';

interface Props {
    studyState: StudyStateResponse | null;
    myPlayerIndex: number;
    sessionId: string;
    sendMove: (req: StudyMoveRequest) => void;
}

const DUEUM_MAP: Record<string, string> = {
    '라':'나','락':'낙','란':'난','람':'남','랑':'낭','래':'내','량':'양','려':'여','력':'역','련':'연',
    '렬':'열','렵':'엽','령':'영','례':'예','로':'노','록':'녹','론':'논','롱':'농','뢰':'뇌','료':'요',
    '룡':'용','루':'누','류':'유','륙':'육','륜':'윤','률':'율','륭':'융','릉':'능','리':'이','린':'인',
    '림':'임','립':'입','냐':'야','녀':'여','뇨':'요','뉴':'유','니':'이',
};

function dueumHint(lastWord: string): string {
    if (!lastWord) return '';
    const syl = lastWord[lastWord.length - 1];
    const mapped = DUEUM_MAP[syl];
    const reverse = Object.entries(DUEUM_MAP).find(([, v]) => v === syl)?.[0];
    const variants = Array.from(new Set([syl, mapped, reverse].filter(Boolean))) as string[];
    return variants.length > 1
        ? `다음: '${variants.join("' / '")}'로 시작`
        : `다음: '${syl}'로 시작`;
}

const P_COLORS = ['#569cd6', '#4ec9b0', '#ce9178', '#c586c0', '#dcdcaa', '#9cdcfe'];

export default function WordChainRoom({ studyState, myPlayerIndex, sessionId, sendMove }: Props) {
    const game = studyState?.gameData as WordChainGameData | null;

    const [input, setInput] = useState('');
    const [localFeedback, setLocalFeedback] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const prevTurnRef = useRef<number>(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const historyRef = useRef<HTMLDivElement>(null);

    const isFinished = studyState?.status === 'FINISHED';
    const currentTurn = game?.currentTurn ?? studyState?.currentTurn ?? 0;
    const isMyTurn = currentTurn === myPlayerIndex && !isFinished;
    const timeLimit = game?.timeLimit ?? 7;

    // 턴이 바뀌면 타이머 리셋
    useEffect(() => {
        if (!game || isFinished) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        if (prevTurnRef.current === currentTurn) return;
        prevTurnRef.current = currentTurn;

        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(timeLimit);
        setLocalFeedback('');
        setInput('');

        let rem = timeLimit;
        timerRef.current = setInterval(() => {
            rem -= 0.05;
            if (rem <= 0) {
                clearInterval(timerRef.current!);
                timerRef.current = null;
                setTimeLeft(0);
                // 내 턴이면 타임아웃 전송
                if (currentTurn === myPlayerIndex) {
                    sendMove({ moveType: 'WORD_CHAIN_TIMEOUT', data: '', sessionId });
                }
            } else {
                setTimeLeft(rem);
            }
        }, 50);

        if (currentTurn === myPlayerIndex) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }

        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [currentTurn, game, isFinished, myPlayerIndex, sendMove, timeLimit]);

    useEffect(() => {
        if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }, [game?.usedWords?.length]);

    // 서버 에러 메시지 표시
    useEffect(() => {
        const msg = studyState?.message ?? '';
        if (msg.startsWith('ERROR:')) {
            setLocalFeedback(msg.replace('ERROR:', '').trim());
        } else if (msg && !msg.startsWith('ERROR:')) {
            setLocalFeedback('');
        }
    }, [studyState?.message]);

    const submit = useCallback(() => {
        const word = input.trim();
        if (!word || !isMyTurn) return;
        if (word.length < 2) { setLocalFeedback('두 글자 이상 입력하세요'); return; }
        setLocalFeedback('');
        sendMove({ moveType: 'WORD_CHAIN_SUBMIT', data: word, sessionId });
        setInput('');
    }, [input, isMyTurn, sendMove]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') submit(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [submit]);

    if (!game || !studyState) return null;

    const pct = Math.max(0, (timeLeft / timeLimit) * 100);
    const timerColor = pct > 50 ? '#4ec9b0' : pct > 20 ? '#ce9178' : '#f14c4c';
    const playerNames = studyState.playerNames ?? [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '440px', margin: '0 auto', padding: '16px', height: '100%', overflow: 'auto' }}>
            {/* 플레이어 상태 */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${playerNames.length}, 1fr)`, gap: '8px' }}>
                {playerNames.map((name, i) => {
                    const elim = game.eliminated?.[i] ?? false;
                    const active = i === currentTurn && !isFinished;
                    return (
                        <div key={i} style={{ background: '#252526', border: `1px solid ${active ? P_COLORS[i % P_COLORS.length] : '#3e3e42'}`, borderRadius: '4px', padding: '8px 6px', textAlign: 'center', opacity: elim ? 0.35 : 1, transition: 'all 0.2s' }}>
                            <div style={{ fontSize: '11px', fontWeight: 500, color: elim ? '#858585' : P_COLORS[i % P_COLORS.length], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {name}{i === myPlayerIndex ? ' 👤' : ''}
                            </div>
                            <div style={{ fontSize: '10px', color: '#858585', marginTop: '2px' }}>
                                {elim ? '탈락' : active ? '차례' : '대기'}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 타이머 */}
            {!isFinished && (
                <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#858585' }}>
                            {isMyTurn ? '⚡ 내 차례' : `${playerNames[currentTurn] ?? ''}의 차례`}
                        </span>
                        <span style={{ fontSize: '26px', fontWeight: 600, color: timerColor, lineHeight: 1, fontFamily: 'monospace', transition: 'color 0.2s' }}>
                            {Math.ceil(timeLeft)}
                        </span>
                    </div>
                    <div style={{ height: '4px', background: '#3e3e42', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: timerColor, borderRadius: '999px', transition: 'width 0.05s linear, background 0.2s' }} />
                    </div>
                </div>
            )}

            {/* 마지막 단어 */}
            <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 500, color: '#d4d4d4', marginBottom: '4px' }}>
                    {game.lastWord || '첫 단어를 입력하세요'}
                </div>
                <div style={{ fontSize: '12px', color: '#6a9955' }}>{dueumHint(game.lastWord)}</div>
            </div>

            {/* 게임 오버 */}
            {isFinished && (
                <div style={{ background: '#252526', border: '1px solid #4ec9b0', borderRadius: '4px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#4ec9b0', marginBottom: '4px' }}>
                        {game.winner >= 0 ? `🏆 ${playerNames[game.winner] ?? ''} 승리!` : '게임 종료'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#858585' }}>
                        {game.winner === myPlayerIndex ? '🎉 당신이 이겼습니다!' : '방장이 재시작할 수 있습니다.'}
                    </div>
                </div>
            )}

            {/* 입력창 */}
            {!isFinished && (
                <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={e => { setInput(e.target.value); setLocalFeedback(''); }}
                        placeholder={isMyTurn ? '단어 입력 후 Enter' : `${playerNames[currentTurn] ?? ''}의 차례...`}
                        disabled={!isMyTurn}
                        style={{ flex: 1, fontSize: '15px', padding: '8px 10px', background: '#252526', border: `1px solid ${isMyTurn ? '#569cd6' : '#3e3e42'}`, borderRadius: '4px', color: '#d4d4d4', transition: 'border-color 0.15s' }}
                    />
                    <button onClick={submit} disabled={!isMyTurn}
                        style={{ padding: '8px 14px', background: isMyTurn ? 'rgba(86,156,214,0.18)' : 'transparent', border: `1px solid ${isMyTurn ? '#569cd6' : '#3e3e42'}`, borderRadius: '4px', color: isMyTurn ? '#569cd6' : '#858585', cursor: isMyTurn ? 'pointer' : 'default', fontSize: '12px', transition: 'all 0.15s' }}>
                        전송
                    </button>
                </div>
            )}

            {localFeedback && (
                <div style={{ fontSize: '12px', color: '#f14c4c', textAlign: 'center' }}>{localFeedback}</div>
            )}

            {/* 단어 히스토리 */}
            {game.usedWords?.length > 0 && (
                <div ref={historyRef} style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '80px', overflowY: 'auto', padding: '2px' }}>
                    {game.usedWords.map((w, i) => (
                        <span key={i} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '3px', background: '#2d2d2d', color: '#858585', border: '1px solid #3e3e42' }}>{w}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
