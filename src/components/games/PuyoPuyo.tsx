import { useEffect, useRef, useState } from 'react';

const COLS = 6, ROWS = 12, CELL = 32;
const COLORS = ['#E24B4A', '#378ADD', '#639922', '#D4537E', '#BA7517'];
const EMPTY = 0;

interface Props {
    onClose: () => void;
}

export default function PuyoPuyo({ onClose }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const nextCanvasRef = useRef<HTMLCanvasElement>(null);
    const restartRef = useRef<() => void>(() => {});

    const [score, setScore] = useState(0);
    const [level, setLevel] = useState(1);
    const [chain, setChain] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [chainFlash, setChainFlash] = useState('');

    useEffect(() => {
        const canvas = canvasRef.current!;
        const nextCanvas = nextCanvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const nCtx = nextCanvas.getContext('2d')!;

        // ── 게임 상태 ──
        let board: number[][];
        let cur: { c: number[]; rot: number; x: number; y: number };
        let nxt: { c: number[]; rot: number; x: number; y: number };
        let scoreVal = 0, levelVal = 1;
        let isGameOver = false;
        let dropInterval = 700;
        let dropTimer: ReturnType<typeof setInterval> | null = null;
        let chainResolving = false;
        let chainFlashTimer: ReturnType<typeof setTimeout> | null = null;
        let destroyed = false;

        // ── 헬퍼 ──
        const newBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
        const randColor = () => Math.floor(Math.random() * COLORS.length) + 1;
        const newPair = () => ({ c: [randColor(), randColor()], rot: 0, x: 2, y: -1 });
        const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

        function puyoPos(p: typeof cur) {
            const { c, rot, x, y } = p;
            if (rot === 0) return [{ x, y: y - 1, c: c[0] }, { x, y, c: c[1] }];
            if (rot === 1) return [{ x: x + 1, y, c: c[0] }, { x, y, c: c[1] }];
            if (rot === 2) return [{ x, y: y + 1, c: c[0] }, { x, y, c: c[1] }];
            return [{ x: x - 1, y, c: c[0] }, { x, y, c: c[1] }];
        }

        function valid(p: typeof cur, dx = 0, dy = 0, dr = 0) {
            const q = { ...p, x: p.x + dx, y: p.y + dy, rot: (p.rot + dr + 4) % 4 };
            return puyoPos(q).every(({ x, y }) =>
                x >= 0 && x < COLS && y < ROWS && (y < 0 || board[y][x] === EMPTY)
            );
        }

        function placePair() {
            for (const { x, y, c } of puyoPos(cur))
                if (y >= 0 && y < ROWS) board[y][x] = c;
        }

        function applyGravity() {
            for (let col = 0; col < COLS; col++) {
                let write = ROWS - 1;
                for (let row = ROWS - 1; row >= 0; row--) {
                    if (board[row][col] !== EMPTY) {
                        if (write !== row) { board[write][col] = board[row][col]; board[row][col] = EMPTY; }
                        write--;
                    }
                }
            }
        }

        function findGroups() {
            const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
            const groups: [number, number][][] = [];
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (board[r][c] !== EMPTY && !visited[r][c]) {
                        const color = board[r][c];
                        const group: [number, number][] = [];
                        const stack: [number, number][] = [[r, c]];
                        while (stack.length) {
                            const [cr, cc] = stack.pop()!;
                            if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) continue;
                            if (visited[cr][cc] || board[cr][cc] !== color) continue;
                            visited[cr][cc] = true;
                            group.push([cr, cc]);
                            stack.push([cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]);
                        }
                        if (group.length >= 4) groups.push(group);
                    }
                }
            }
            return groups;
        }

        function clearGroups(groups: [number, number][][]) {
            let count = 0;
            for (const g of groups) for (const [r, c] of g) { board[r][c] = EMPTY; count++; }
            return count;
        }

        async function resolveChains() {
            chainResolving = true;
            let ch = 0;
            while (true) {
                if (destroyed) return;
                applyGravity();
                const groups = findGroups();
                if (groups.length === 0) break;
                ch++;
                setChain(ch);
                const cleared = clearGroups(groups);
                scoreVal += cleared * 10 * ch * ch;
                setScore(scoreVal);
                if (ch > 1) {
                    const labels = ['', '', '2연쇄!', '3연쇄!!', '4연쇄!!!', '5연쇄!!!!', '대연쇄!!!!!'];
                    setChainFlash(ch < labels.length ? labels[ch] : `${ch}연쇄!!!!!`);
                    if (chainFlashTimer) clearTimeout(chainFlashTimer);
                    chainFlashTimer = setTimeout(() => setChainFlash(''), 1200);
                }
                await sleep(350);
                if (destroyed) return;
                draw();
                await sleep(200);
                if (destroyed) return;
            }
            levelVal = Math.floor(scoreVal / 500) + 1;
            dropInterval = Math.max(150, 700 - (levelVal - 1) * 60);
            setLevel(levelVal);
            chainResolving = false;
            if (!isGameOver) advance();
        }

        function advance() {
            cur = nxt;
            nxt = newPair();
            cur.x = 2; cur.y = -1; cur.rot = 0;
            if (!valid(cur, 0, 1) && !valid(cur)) { endGame(); return; }
            startTimer();
            draw();
            drawNext();
        }

        function endGame() {
            isGameOver = true;
            if (dropTimer) clearInterval(dropTimer);
            setGameOver(true);
        }

        function startTimer() {
            if (dropTimer) clearInterval(dropTimer);
            dropTimer = setInterval(() => { if (!chainResolving && !isGameOver) stepDown(); }, dropInterval);
        }

        function stepDown() {
            if (valid(cur, 0, 1)) { cur.y++; draw(); }
            else { placePair(); draw(); resolveChains(); }
        }

        function moveLeft()  { if (valid(cur, -1)) { cur.x--; draw(); } }
        function moveRight() { if (valid(cur, 1))  { cur.x++; draw(); } }
        function rotate() {
            if (valid(cur, 0, 0, 1))       { cur.rot = (cur.rot + 1) % 4; draw(); }
            else if (valid(cur, 1, 0, 1))  { cur.x++; cur.rot = (cur.rot + 1) % 4; draw(); }
            else if (valid(cur, -1, 0, 1)) { cur.x--; cur.rot = (cur.rot + 1) % 4; draw(); }
        }
        function hardDrop() {
            while (valid(cur, 0, 1)) cur.y++;
            placePair(); draw(); resolveChains();
        }

        // ── 렌더링 ──
        function drawPuyo(c2d: CanvasRenderingContext2D, x: number, y: number, colorIdx: number, sz = CELL) {
            const r = (sz - 4) / 2;
            const cx = x * sz + sz / 2, cy = y * sz + sz / 2;
            c2d.fillStyle = COLORS[colorIdx - 1];
            c2d.beginPath(); c2d.arc(cx, cy, r, 0, Math.PI * 2); c2d.fill();
            c2d.fillStyle = 'rgba(255,255,255,0.35)';
            c2d.beginPath(); c2d.arc(cx - r * 0.25, cy - r * 0.3, r * 0.35, 0, Math.PI * 2); c2d.fill();
        }

        function draw() {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (board[r][c]) drawPuyo(ctx, c, r, board[r][c]);
                    else { ctx.fillStyle = '#2a2a2a'; ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4); }
                }
            }
            if (!isGameOver && !chainResolving)
                for (const { x, y, c } of puyoPos(cur)) if (y >= 0) drawPuyo(ctx, x, y, c);
        }

        function drawNext() {
            nCtx.fillStyle = '#1a1a1a';
            nCtx.fillRect(0, 0, 40, 80);
            const sz = 20;
            for (const { x, y, c } of [{ x: 0, y: 0, c: nxt.c[0] }, { x: 0, y: 1, c: nxt.c[1] }]) {
                const r = sz / 2 - 2;
                const cx = x * sz + sz / 2, cy = y * sz + sz / 2;
                nCtx.fillStyle = COLORS[c - 1];
                nCtx.beginPath(); nCtx.arc(cx, cy, r, 0, Math.PI * 2); nCtx.fill();
                nCtx.fillStyle = 'rgba(255,255,255,0.35)';
                nCtx.beginPath(); nCtx.arc(cx - r * 0.25, cy - r * 0.3, r * 0.35, 0, Math.PI * 2); nCtx.fill();
            }
        }

        // ── 초기화 ──
        function init() {
            board = newBoard();
            cur = newPair(); nxt = newPair();
            scoreVal = 0; levelVal = 1; isGameOver = false;
            dropInterval = 700; chainResolving = false;
            setScore(0); setLevel(1); setChain(0); setGameOver(false); setChainFlash('');
            startTimer(); draw(); drawNext();
        }

        restartRef.current = init;

        // ── 키보드 ──
        function onKeyDown(e: KeyboardEvent) {
            if (isGameOver || chainResolving) return;
            if (e.key === 'ArrowLeft')  { e.preventDefault(); moveLeft(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); moveRight(); }
            else if (e.key === 'ArrowDown')  { e.preventDefault(); stepDown(); }
            else if (e.key === 'ArrowUp')    { e.preventDefault(); rotate(); }
            else if (e.key === ' ')          { e.preventDefault(); hardDrop(); }
        }

        // ── 터치 ──
        let tx = 0, ty = 0;
        function onTouchStart(e: TouchEvent) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; e.preventDefault(); }
        function onTouchEnd(e: TouchEvent) {
            if (isGameOver || chainResolving) return;
            const dx = e.changedTouches[0].clientX - tx;
            const dy = e.changedTouches[0].clientY - ty;
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) rotate();
            else if (Math.abs(dx) > Math.abs(dy)) { dx < 0 ? moveLeft() : moveRight(); }
            else { dy > 0 ? hardDrop() : rotate(); }
            e.preventDefault();
        }

        window.addEventListener('keydown', onKeyDown);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });

        init();

        return () => {
            destroyed = true;
            if (dropTimer) clearInterval(dropTimer);
            if (chainFlashTimer) clearTimeout(chainFlashTimer);
            window.removeEventListener('keydown', onKeyDown);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchend', onTouchEnd);
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', fontFamily: "'Consolas','Courier New',monospace" }}>

            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: '#252526', borderBottom: '1px solid #3e3e42', flexShrink: 0, height: '35px', gap: '8px' }}>
                <span style={{ color: '#569cd6', fontSize: '11px' }}>▶</span>
                <span style={{ fontSize: '12px', color: '#d4d4d4' }}>puyo_puyo.ts</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '24px' }}>
                    <span><span style={{ color: '#6a9955', fontSize: '11px' }}>score </span><span style={{ color: '#b5cea8', fontSize: '16px', fontWeight: 600 }}>{score}</span></span>
                    <span><span style={{ color: '#6a9955', fontSize: '11px' }}>level </span><span style={{ color: '#b5cea8', fontSize: '16px', fontWeight: 600 }}>{level}</span></span>
                    <span><span style={{ color: '#6a9955', fontSize: '11px' }}>chain </span><span style={{ color: '#ce9178', fontSize: '16px', fontWeight: 600 }}>{chain}</span></span>
                </div>
                <button
                    className="btn-secondary"
                    style={{ marginLeft: '16px', fontSize: '11px', padding: '2px 10px' }}
                    onClick={onClose}
                >
                    ✕ close
                </button>
            </div>

            {/* 게임 영역 */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', overflow: 'auto', padding: '16px' }}>

                {/* 보드 */}
                <div style={{ position: 'relative' }}>
                    <canvas
                        ref={canvasRef}
                        width={COLS * CELL}
                        height={ROWS * CELL}
                        style={{ display: 'block', border: '1px solid #3e3e42', borderRadius: '4px' }}
                    />
                    {gameOver && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#252526', border: '1px solid #3e3e42', borderRadius: '6px', padding: '20px 28px', textAlign: 'center', zIndex: 10 }}>
                            <div style={{ fontSize: '16px', color: '#f44747', marginBottom: '6px' }}>게임 오버</div>
                            <div style={{ fontSize: '11px', color: '#858585', marginBottom: '14px' }}>
                                <span className="cmt">// 최종 점수: </span>
                                <span className="num">{score}</span>
                            </div>
                            <button className="btn-primary" style={{ fontSize: '12px' }} onClick={() => restartRef.current()}>
                                ↺ restart()
                            </button>
                        </div>
                    )}
                </div>

                {/* 사이드 패널 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                    <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#858585', marginBottom: '6px', letterSpacing: '0.05em' }}>NEXT</div>
                        <canvas ref={nextCanvasRef} width={40} height={80} style={{ display: 'block', margin: '0 auto' }} />
                    </div>

                    {chainFlash && (
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#ce9178', textAlign: 'center', minHeight: '28px' }}>
                            {chainFlash}
                        </div>
                    )}

                    <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '8px 12px', fontSize: '11px', color: '#6a9955', lineHeight: '2', textAlign: 'center' }}>
                        <div><span className="kw">← →</span> 이동</div>
                        <div><span className="kw">↑</span> 회전</div>
                        <div><span className="kw">↓</span> 빠르게</div>
                        <div><span className="kw">Space</span> 즉시낙하</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
