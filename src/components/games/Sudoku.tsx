import { useState, useEffect, useCallback, useRef } from 'react';

interface Props {
    onClose: () => void;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'master';
type Board = number[][];
type Notes = Set<number>[][];

const DIFFICULTY_CLUES: Record<Difficulty, number> = { easy: 36, medium: 28, hard: 22, master: 17 };

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function isValidPlacement(board: Board, row: number, col: number, num: number): boolean {
    for (let c = 0; c < 9; c++) if (board[row][c] === num) return false;
    for (let r = 0; r < 9; r++) if (board[r][col] === num) return false;
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++)
        for (let c = bc; c < bc + 3; c++)
            if (board[r][c] === num) return false;
    return true;
}

function fillBoard(board: Board): boolean {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
                    if (isValidPlacement(board, r, c, n)) {
                        board[r][c] = n;
                        if (fillBoard(board)) return true;
                        board[r][c] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function countSolutions(board: Board): number {
    let count = 0;
    function solve(b: Board): void {
        if (count >= 2) return;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (b[r][c] === 0) {
                    for (let n = 1; n <= 9; n++) {
                        if (isValidPlacement(b, r, c, n)) {
                            b[r][c] = n;
                            solve(b);
                            b[r][c] = 0;
                            if (count >= 2) return;
                        }
                    }
                    return;
                }
            }
        }
        count++;
    }
    solve(board.map(r => [...r]));
    return count;
}

function generatePuzzle(difficulty: Difficulty): { puzzle: Board; solution: Board } {
    const solution: Board = Array.from({ length: 9 }, () => Array(9).fill(0));
    fillBoard(solution);

    const puzzle = solution.map(r => [...r]);
    const cells = shuffle(
        Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9] as [number, number])
    );

    const target = DIFFICULTY_CLUES[difficulty];
    let clues = 81;
    for (const [r, c] of cells) {
        if (clues <= target) break;
        const backup = puzzle[r][c];
        puzzle[r][c] = 0;
        if (countSolutions(puzzle) === 1) {
            clues--;
        } else {
            puzzle[r][c] = backup;
        }
    }

    return { puzzle, solution };
}

function emptyNotes(): Notes {
    return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>()));
}

export default function Sudoku({ onClose }: Props) {
    const [difficulty, setDifficulty] = useState<Difficulty>('easy');
    const [puzzle, setPuzzle] = useState<Board>([]);
    const [solution, setSolution] = useState<Board>([]);
    const [userBoard, setUserBoard] = useState<Board>([]);
    const [notes, setNotes] = useState<Notes>(emptyNotes());
    const [selected, setSelected] = useState<[number, number] | null>(null);
    const [noteMode, setNoteMode] = useState(false);
    const [time, setTime] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [generating, setGenerating] = useState(true);
    const [opacity, setOpacity] = useState<number>(() => {
        const raw = parseFloat(localStorage.getItem('study.sudokuOpacity') ?? '100');
        return Math.max(20, Math.min(100, raw <= 1 ? Math.round(raw * 100) : raw));
    });
    const [showOpacity, setShowOpacity] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startNew = useCallback((diff: Difficulty) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setGenerating(true);
        setIsComplete(false);
        setSelected(null);
        setNoteMode(false);
        setTime(0);
        setTimeout(() => {
            const { puzzle: p, solution: s } = generatePuzzle(diff);
            setPuzzle(p);
            setSolution(s);
            setUserBoard(p.map(r => [...r]));
            setNotes(emptyNotes());
            setGenerating(false);
        }, 20);
    }, []);

    useEffect(() => { startNew('easy'); }, []);

    // Timer
    useEffect(() => {
        if (isComplete || generating || puzzle.length === 0) return;
        timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isComplete, generating, puzzle.length]);

    // Completion check
    useEffect(() => {
        if (puzzle.length === 0 || isComplete || generating) return;
        const complete = userBoard.length > 0 && userBoard.every((row, r) =>
            row.every((v, c) => v !== 0 && v === solution[r][c])
        );
        if (complete) setIsComplete(true);
    }, [userBoard, solution, puzzle, isComplete, generating]);

    const placeNumber = useCallback((num: number) => {
        if (!selected || isComplete) return;
        const [r, c] = selected;
        if (puzzle[r]?.[c] !== 0) return;

        if (noteMode) {
            setNotes(prev => {
                const next = prev.map(row => row.map(cell => new Set(cell)));
                if (num === 0) next[r][c].clear();
                else if (next[r][c].has(num)) next[r][c].delete(num);
                else next[r][c].add(num);
                return next;
            });
        } else {
            if (num !== 0) {
                setNotes(prev => {
                    const next = prev.map(row => row.map(cell => new Set(cell)));
                    next[r][c].clear();
                    return next;
                });
            }
            setUserBoard(prev => {
                const next = prev.map(row => [...row]);
                next[r][c] = num;
                return next;
            });
        }
    }, [selected, puzzle, noteMode, isComplete]);

    // Keyboard
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key >= '1' && e.key <= '9') { placeNumber(parseInt(e.key)); return; }
            if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { placeNumber(0); return; }
            if (e.key === 'n' || e.key === 'N') { setNoteMode(v => !v); return; }
            setSelected(prev => {
                if (!prev) return prev;
                const [r, c] = prev;
                if (e.key === 'ArrowUp')    return r > 0 ? [r - 1, c] : prev;
                if (e.key === 'ArrowDown')  return r < 8 ? [r + 1, c] : prev;
                if (e.key === 'ArrowLeft')  return c > 0 ? [r, c - 1] : prev;
                if (e.key === 'ArrowRight') return c < 8 ? [r, c + 1] : prev;
                return prev;
            });
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [placeNumber]);

    const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const [selR, selC] = selected ?? [-1, -1];
    const selVal = selected ? userBoard[selR]?.[selC] ?? 0 : 0;
    const selBoxR = selected ? Math.floor(selR / 3) : -1;
    const selBoxC = selected ? Math.floor(selC / 3) : -1;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e', overflow: 'hidden', userSelect: 'none', opacity: opacity / 100, transition: 'opacity 0.2s' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderBottom: '1px solid #3e3e42', flexShrink: 0 }}>
                <span style={{ color: '#569cd6', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>SUDOKU</span>
                {(['easy', 'medium', 'hard', 'master'] as Difficulty[]).map(d => (
                    <button key={d} onClick={() => { setDifficulty(d); startNew(d); }}
                        style={{ background: difficulty === d ? 'rgba(86,156,214,0.18)' : 'transparent', border: `1px solid ${difficulty === d ? '#569cd6' : '#3e3e42'}`, color: difficulty === d ? '#569cd6' : '#858585', borderRadius: '3px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.12s' }}>
                        {d}
                    </button>
                ))}
                <span style={{ color: '#4ec9b0', fontSize: '12px', fontFamily: 'monospace', marginLeft: 'auto' }}>{fmt(time)}</span>
                <button onClick={() => startNew(difficulty)}
                    style={{ background: 'transparent', border: '1px solid #3e3e42', color: '#9cdcfe', borderRadius: '3px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>
                    new
                </button>
                <button onClick={() => setShowOpacity(v => !v)}
                    style={{ background: showOpacity ? 'rgba(78,201,176,0.2)' : 'transparent', border: showOpacity ? '1px solid #4ec9b0' : '1px solid transparent', color: showOpacity ? '#4ec9b0' : '#6a9955', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 4px', borderRadius: '3px', transition: 'all 0.15s' }}>
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
                        onChange={e => { const v = Number(e.target.value); setOpacity(v); localStorage.setItem('study.sudokuOpacity', String(v)); }}
                        style={{ flex: 1, accentColor: '#4ec9b0', cursor: 'pointer' }} />
                    <span style={{ color: '#858585', fontSize: '10px', width: '28px', textAlign: 'right' }}>{opacity}%</span>
                </div>
            )}

            {/* Content */}
            {generating ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4e4e4e', fontSize: '12px' }}>
                    <span style={{ color: '#6a9955' }}>// </span>&nbsp;generating puzzle...
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '12px', overflow: 'auto' }}>
                    {isComplete && (
                        <div style={{ color: '#4ec9b0', fontSize: '13px', fontWeight: 700, padding: '5px 16px', border: '1px solid #4ec9b0', borderRadius: '4px', background: 'rgba(78,201,176,0.1)', letterSpacing: '0.03em' }}>
                            ✓ &nbsp;Solved! &nbsp;{fmt(time)}
                        </div>
                    )}

                    {/* Grid */}
                    <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(9, 40px)', gridTemplateRows: 'repeat(9, 40px)', border: '2px solid #569cd6', borderRadius: '2px', flexShrink: 0 }}>
                        {Array.from({ length: 9 }, (_, r) =>
                            Array.from({ length: 9 }, (_, c) => {
                                const given = puzzle[r][c] !== 0;
                                const val = userBoard[r]?.[c] ?? 0;
                                const isSelected = r === selR && c === selC;
                                const isSameBox = Math.floor(r / 3) === selBoxR && Math.floor(c / 3) === selBoxC;
                                const isSameRowCol = r === selR || c === selC;
                                const isSameNum = selVal !== 0 && val === selVal && !isSelected;
                                const isWrong = val !== 0 && !given && val !== solution[r][c];
                                const cellNotes = notes[r][c];

                                let bg = 'transparent';
                                if (isSelected) bg = 'rgba(86,156,214,0.3)';
                                else if (isSameNum) bg = 'rgba(86,156,214,0.18)';
                                else if (isSameRowCol || isSameBox) bg = 'rgba(255,255,255,0.04)';

                                const bRight = c === 8 ? 'none' : (c + 1) % 3 === 0 ? '2px solid #569cd6' : '1px solid #3e3e42';
                                const bBottom = r === 8 ? 'none' : (r + 1) % 3 === 0 ? '2px solid #569cd6' : '1px solid #3e3e42';

                                return (
                                    <div key={`${r}-${c}`} onClick={() => setSelected([r, c])}
                                        style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: bg, borderRight: bRight, borderBottom: bBottom, position: 'relative', transition: 'background 0.08s' }}>
                                        {val !== 0 ? (
                                            <span style={{ fontSize: '17px', fontWeight: given ? 700 : 400, color: isWrong ? '#f14c4c' : given ? '#d4d4d4' : '#9cdcfe', lineHeight: 1 }}>
                                                {val}
                                            </span>
                                        ) : cellNotes.size > 0 ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', width: '100%', height: '100%', padding: '2px', boxSizing: 'border-box' }}>
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                                    <span key={n} style={{ fontSize: '8px', color: cellNotes.has(n) ? '#6a9955' : 'transparent', textAlign: 'center', lineHeight: '1.4' }}>{n}</span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Numpad */}
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                            <button key={n} onClick={() => placeNumber(n)}
                                style={{ width: '34px', height: '34px', background: 'transparent', border: '1px solid #3e3e42', color: '#d4d4d4', borderRadius: '4px', fontSize: '15px', cursor: 'pointer', fontWeight: 500, transition: 'border-color 0.1s' }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = '#569cd6')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = '#3e3e42')}>
                                {n}
                            </button>
                        ))}
                        <button onClick={() => placeNumber(0)}
                            style={{ width: '34px', height: '34px', background: 'transparent', border: '1px solid #3e3e42', color: '#858585', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                            ✕
                        </button>
                        <button onClick={() => setNoteMode(v => !v)}
                            style={{ height: '34px', padding: '0 10px', background: noteMode ? 'rgba(106,153,85,0.18)' : 'transparent', border: `1px solid ${noteMode ? '#6a9955' : '#3e3e42'}`, color: noteMode ? '#6a9955' : '#858585', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.12s' }}>
                            ✏ notes
                        </button>
                    </div>

                    {/* Hint */}
                    <div style={{ color: '#4e4e4e', fontSize: '10px' }}>
                        arrow keys to move &nbsp;·&nbsp; [n] toggle notes mode
                    </div>
                </div>
            )}
        </div>
    );
}
