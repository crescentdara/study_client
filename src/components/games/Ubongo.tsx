import { useState, useEffect, useRef, useCallback } from 'react';
import { StudyStateResponse, StudyMoveRequest, UbongoGameData, UbongoPieceInfo } from '../../types';

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
}

const OPACITY_KEY = 'ubongo_opacity';
const CELL  = 58;
const MINI  = 14;   // mini board cell px
const BOARD = 5;

const panel: React.CSSProperties = {
  background: '#252526', border: '1px solid #3e3e42',
  borderRadius: 8, padding: '10px 14px', marginBottom: 10,
};

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Piece mini renderer ────────────────────────────────────────────────────

function PieceMini({ piece, orientIdx, cellSize = MINI }: {
  piece: UbongoPieceInfo;
  orientIdx: number;
  cellSize?: number;
}) {
  const orient = piece.orientations[orientIdx % piece.orientations.length];
  const maxR = Math.max(...orient.map(([r]) => r));
  const maxC = Math.max(...orient.map(([, c]) => c));
  return (
    <div style={{ position: 'relative', width: (maxC + 1) * cellSize, height: (maxR + 1) * cellSize }}>
      {orient.map(([dr, dc], i) => (
        <div key={i} style={{
          position: 'absolute',
          left: dc * cellSize, top: dr * cellSize,
          width: cellSize - 2, height: cellSize - 2,
          background: piece.color,
          border: '1px solid rgba(0,0,0,0.35)',
          borderRadius: 2,
        }} />
      ))}
    </div>
  );
}

function buildBoardPieces(
  placements: Record<string, { row: number; col: number; orientationIndex: number }>,
  pieces: UbongoPieceInfo[],
): (string | null)[][] {
  const board: (string | null)[][] = Array.from({ length: BOARD }, () => Array(BOARD).fill(null));
  for (const [pid, pl] of Object.entries(placements)) {
    const piece = pieces.find(p => p.id === pid);
    if (!piece) continue;
    const orient = piece.orientations[pl.orientationIndex];
    for (const [dr, dc] of orient) {
      const r = pl.row + dr, c = pl.col + dc;
      if (r >= 0 && r < BOARD && c >= 0 && c < BOARD) board[r][c] = pid;
    }
  }
  return board;
}

function isValidPlacement(
  pieceId: string, row: number, col: number, orientIdx: number,
  pieces: UbongoPieceInfo[], blocked: boolean[][], boardPieces: (string | null)[][],
): boolean {
  const piece = pieces.find(p => p.id === pieceId);
  if (!piece) return false;
  const orient = piece.orientations[orientIdx % piece.orientations.length];
  for (const [dr, dc] of orient) {
    const r = row + dr, c = col + dc;
    if (r < 0 || r >= BOARD || c < 0 || c >= BOARD) return false;
    if (blocked[r][c]) return false;
    if (boardPieces[r][c] !== null) return false;
  }
  return true;
}

function getOccupiedCells(
  pieceId: string, row: number, col: number, orientIdx: number, pieces: UbongoPieceInfo[],
): [number, number][] {
  const piece = pieces.find(p => p.id === pieceId);
  if (!piece) return [];
  const orient = piece.orientations[orientIdx % piece.orientations.length];
  return orient.map(([dr, dc]) => [row + dr, col + dc] as [number, number]);
}

// ── Mini read-only board for opponents ────────────────────────────────────

function MiniBoard({
  placements, pieces, blocked, solved,
}: {
  placements: Record<string, { row: number; col: number; orientationIndex: number }>;
  pieces: UbongoPieceInfo[];
  blocked: boolean[][];
  solved: boolean;
}) {
  const bp = buildBoardPieces(placements, pieces);
  const cs = 11; // cell size px
  return (
    <div style={{
      display: 'inline-grid',
      gridTemplateColumns: `repeat(${BOARD}, ${cs}px)`,
      gap: 1.5,
      background: solved ? '#1a2e2b' : '#1a1a1c',
      padding: 3,
      borderRadius: 4,
      border: `1px solid ${solved ? '#4ec9b0' : '#3e3e42'}`,
    }}>
      {Array.from({ length: BOARD }, (_, r) =>
        Array.from({ length: BOARD }, (_, c) => {
          const isBlocked = blocked[r][c];
          const pid = bp[r][c];
          const piece = pid ? pieces.find(p => p.id === pid) : null;
          return (
            <div key={`${r}-${c}`} style={{
              width: cs, height: cs,
              background: isBlocked ? '#0f0f10' : piece ? piece.color : '#2d2d30',
              borderRadius: 2,
              opacity: isBlocked ? 0.5 : 1,
            }} />
          );
        })
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Ubongo({ studyState, sessionId, myPlayerIndex, sendMove }: Props) {

  // ── Opacity ──────────────────────────────────────────────────────────────
  const [opacity, setOpacityState] = useState<number>(() => {
    const s = localStorage.getItem(OPACITY_KEY);
    return s ? parseFloat(s) : 1;
  });
  const setOpacity = (v: number) => { setOpacityState(v); localStorage.setItem(OPACITY_KEY, String(v)); };

  // ── Drag state ───────────────────────────────────────────────────────────
  const [drag, setDrag] = useState<{
    pieceId: string; x: number; y: number; targetCell: [number, number] | null;
  } | null>(null);

  // ── Selected piece ────────────────────────────────────────────────────────
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);

  // ── Orientation ──────────────────────────────────────────────────────────
  const [orientIdx, setOrientIdx] = useState(0);

  // ── Elapsed timer (local) ────────────────────────────────────────────────
  const [elapsedMs, setElapsedMs] = useState(0);

  const dragStartRef   = useRef<{ pieceId: string; startX: number; startY: number } | null>(null);
  const justDroppedRef = useRef(false); // suppress click-to-remove right after drag-drop
  const orientRef      = useRef(orientIdx);
  const sessionRef    = useRef(sessionId);
  const sendRef       = useRef(sendMove);
  const gameDataRef   = useRef<UbongoGameData | null>(null);
  const disabledRef   = useRef(false);
  const selectedRef   = useRef(selectedPieceId);

  orientRef.current   = orientIdx;
  sessionRef.current  = sessionId;
  sendRef.current     = sendMove;
  selectedRef.current = selectedPieceId;

  const gameData   = studyState?.gameData as UbongoGameData | null;
  gameDataRef.current = gameData;

  const myState    = gameData?.playerStates[myPlayerIndex] ?? { placements: {}, solved: false, solveTimeMs: 0 };
  const isFinished = studyState?.status === 'FINISHED';
  const winner     = gameData?.winner ?? -1;
  const disabled   = myState.solved; // each player plays independently until they solve
  disabledRef.current = disabled;

  // Reset when new puzzle loads
  useEffect(() => { setOrientIdx(0); setSelectedPieceId(null); }, [gameData?.puzzle]);

  // Running timer
  useEffect(() => {
    if (!gameData?.startTime || myState.solved) return;
    const origin = gameData.startTime;
    const id = setInterval(() => setElapsedMs(Date.now() - origin), 500);
    return () => clearInterval(id);
  }, [gameData?.startTime, isFinished, myState.solved]);

  // Keyboard
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'r' || e.key === 'R') setOrientIdx(i => i + 1);
    if (e.key === 'Escape') { setDrag(null); setSelectedPieceId(null); dragStartRef.current = null; }
  }, []);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Global mouse handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragStartRef.current && !drag) {
        const { pieceId, startX, startY } = dragStartRef.current;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (dx * dx + dy * dy > 25) {
          dragStartRef.current = null;
          setDrag({ pieceId, x: e.clientX, y: e.clientY, targetCell: null });
        }
        return;
      }
      if (!drag) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = el?.closest('[data-ubongo-cell]') as HTMLElement | null;
      const row = cellEl ? parseInt(cellEl.dataset.row!) : -1;
      const col = cellEl ? parseInt(cellEl.dataset.col!) : -1;
      setDrag(prev => prev ? { ...prev, x: e.clientX, y: e.clientY, targetCell: row >= 0 ? [row, col] : null } : null);
    };

    const onUp = () => {
      if (dragStartRef.current) { dragStartRef.current = null; return; }
      setDrag(prev => {
        if (!prev) return null;
        const gd = gameDataRef.current;
        if (prev.targetCell && gd && !disabledRef.current) {
          const [r, c] = prev.targetCell;
          const piece = gd.puzzle.pieces.find(p => p.id === prev.pieceId);
          if (piece) {
            const oi = orientRef.current % piece.orientations.length;
            sendRef.current({ moveType: 'UBONGO_PLACE', data: '', sessionId: sessionRef.current,
              payload: { pieceId: prev.pieceId, row: r, col: c, orientationIndex: oi } });
            // prevent the board cell's onClick from immediately removing the piece we just dropped
            justDroppedRef.current = true;
            setTimeout(() => { justDroppedRef.current = false; }, 200);
          }
        }
        return null;
      });
    };

    document.body.style.cursor = drag ? 'grabbing' : '';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [drag]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!gameData) return <div style={{ color: '#888', padding: 24 }}>퍼즐 로딩 중...</div>;

  const { puzzle, playerStates } = gameData;
  const boardPieces  = buildBoardPieces(myState.placements, puzzle.pieces);
  const placedIds    = new Set(Object.keys(myState.placements));
  const unplaced     = puzzle.pieces.filter(p => !placedIds.has(p.id));
  const playerNames  = studyState?.playerNames ?? [];

  const activePieceId = drag?.pieceId ?? selectedPieceId;
  const dragPiece     = activePieceId ? puzzle.pieces.find(p => p.id === activePieceId) ?? null : null;
  const dragOrient    = dragPiece ? orientIdx % dragPiece.orientations.length : 0;

  const previewCells = new Set<string>();
  let previewValid = false;
  if (drag?.targetCell && dragPiece) {
    const [hr, hc] = drag.targetCell;
    previewValid = isValidPlacement(dragPiece.id, hr, hc, dragOrient, puzzle.pieces, puzzle.blocked, boardPieces);
    getOccupiedCells(dragPiece.id, hr, hc, dragOrient, puzzle.pieces)
      .forEach(([r, c]) => previewCells.add(`${r},${c}`));
  }

  const handleRemove = (pieceId: string) => {
    if (disabled) return;
    sendMove({ moveType: 'UBONGO_REMOVE', data: '', sessionId, payload: { pieceId } });
  };

  const myName = playerNames[myPlayerIndex] ?? `Player ${myPlayerIndex + 1}`;
  const isSolved = myState.solved;
  const displayTime = isSolved ? myState.solveTimeMs : elapsedMs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 12, gap: 10, userSelect: 'none', opacity }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ ...panel, width: '100%', maxWidth: 700, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#569cd6', fontWeight: 700, fontSize: 15 }}>🧩 Ubongo</span>
        <span style={{ color: '#6a9955', fontSize: 12 }}>
          {puzzle.pieces.length}개 조각 · {puzzle.pieces.reduce((s, p) => s + p.size, 0)}칸
        </span>
        <span style={{
          background: '#1e1e1e', border: '1px solid #555',
          borderRadius: 4, padding: '2px 10px',
          color: isSolved ? '#4ec9b0' : '#d4d4d4',
          fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
        }}>
          ⏱ {formatTime(displayTime)}
          {isSolved && ' ✓'}
        </span>

        {isFinished && winner >= 0 && (
          <span style={{ color: '#4ec9b0', fontWeight: 700 }}>
            🏆 {playerNames[winner] ?? `Player ${winner + 1}`} 우승!
          </span>
        )}

        {/* Opacity slider */}
        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
          background: '#2d2d30', borderRadius: 6, padding: '4px 10px',
          border: '1px solid #3e3e42', opacity: 1,
        }}>
          <span style={{ fontSize: 11, color: '#888' }}>투명도</span>
          <input type="range" min={0.2} max={1} step={0.05} value={opacity}
            onChange={e => setOpacity(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: '#569cd6', cursor: 'pointer' }} />
          <span style={{ fontSize: 11, color: '#888', width: 30 }}>{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      {/* ── Opponents row ────────────────────────────────────────────────── */}
      {playerStates.length > 1 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {playerStates.map((ps, i) => {
            if (i === myPlayerIndex) return null;
            const name   = playerNames[i] ?? `Player ${i + 1}`;
            const placed = Object.keys(ps.placements).length;
            const total  = puzzle.pieces.length;
            const isWin  = winner === i;
            return (
              <div key={i} style={{
                ...panel, marginBottom: 0,
                borderColor: isWin ? '#4ec9b0' : '#3e3e42',
                background: isWin ? '#1a2e2b' : '#1e1e1e',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '8px 12px',
              }}>
                <div style={{ color: isWin ? '#4ec9b0' : '#9cdcfe', fontSize: 12, fontWeight: 700 }}>
                  {name}{isWin && ' 🏆'}
                </div>
                <MiniBoard placements={ps.placements} pieces={puzzle.pieces} blocked={puzzle.blocked} solved={ps.solved} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <div style={{ flex: 1, background: '#1e1e1e', borderRadius: 3, height: 4, overflow: 'hidden', border: '1px solid #333' }}>
                    <div style={{
                      width: `${total ? (placed / total) * 100 : 0}%`, height: '100%',
                      background: ps.solved ? '#4ec9b0' : '#555', transition: 'width 0.2s',
                    }} />
                  </div>
                  <span style={{ color: '#888', fontSize: 10 }}>{placed}/{total}</span>
                </div>
                {ps.solved && (
                  <div style={{ color: '#4ec9b0', fontSize: 10 }}>✓ {formatTime(ps.solveTimeMs)}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>

        {/* ── My Board ───────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0 }}>
          {/* Board header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, justifyContent: 'center' }}>
            <span style={{
              color: isSolved ? '#4ec9b0' : '#9cdcfe',
              fontWeight: 700, fontSize: 13,
            }}>
              {isSolved ? '✓ ' : '▶ '}{myName}의 보드
            </span>
            <button
              onClick={() => setOrientIdx(i => i + 1)}
              disabled={!activePieceId}
              style={{
                background: activePieceId ? '#3e3e42' : '#2a2a2d',
                color: activePieceId ? '#d4d4d4' : '#555',
                border: '1px solid #555', borderRadius: 4,
                padding: '3px 12px', cursor: activePieceId ? 'pointer' : 'default', fontSize: 12,
              }}
            >↻ 회전 (R)</button>
            {activePieceId && dragPiece && (
              <span style={{ color: dragPiece.color, fontSize: 11 }}>
                {drag ? '드래그 중' : '선택됨'} · 방향 {dragOrient + 1}/{dragPiece.orientations.length}
              </span>
            )}
          </div>

          {/* Board grid */}
          <div style={{
            display: 'inline-grid',
            gridTemplateColumns: `repeat(${BOARD}, ${CELL}px)`,
            gap: 3, background: '#1a1a1c', padding: 6, borderRadius: 8,
            border: `2px solid ${isSolved ? '#4ec9b0' : '#569cd680'}`,
          }}>
            {Array.from({ length: BOARD }, (_, r) =>
              Array.from({ length: BOARD }, (_, c) => {
                const isBlocked = puzzle.blocked[r][c];
                const occupied  = boardPieces[r][c];
                const isPreview = previewCells.has(`${r},${c}`);
                const piece     = occupied ? puzzle.pieces.find(p => p.id === occupied) : null;

                let bg = '#2d2d30';
                if (isBlocked)   bg = '#0f0f10';
                else if (piece)  bg = piece.color;
                else if (isPreview) bg = dragPiece!.color + '70';

                const border = isBlocked
                  ? '1.5px solid #111'
                  : occupied
                    ? `1.5px solid ${piece?.color}cc`
                    : isPreview
                      ? `1.5px dashed ${previewValid ? '#ffffffaa' : '#ff444488'}`
                      : '1.5px solid #3e3e42';

                return (
                  <div
                    key={`${r}-${c}`}
                    data-ubongo-cell="1"
                    data-row={r}
                    data-col={c}
                    onClick={() => { if (!justDroppedRef.current) occupied && !disabled && handleRemove(occupied); }}
                    style={{
                      width: CELL, height: CELL, background: bg, border, borderRadius: 4,
                      cursor: isBlocked ? 'not-allowed' : occupied && !disabled ? 'pointer' : 'default',
                      transition: 'background 0.08s, border-color 0.08s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title={occupied ? `${occupied} – 클릭하면 제거` : isBlocked ? '막힌 칸' : ''}
                  >
                    {isBlocked && <div style={{ width: '40%', height: '40%', background: '#1e1e20', borderRadius: 2 }} />}
                    {occupied && !isBlocked && (
                      <span style={{ fontSize: 9, color: '#fff6', pointerEvents: 'none' }}>{occupied}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Piece tray ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 165 }}>
          <div style={{ ...panel, padding: '8px 10px' }}>
            <div style={{ color: '#9cdcfe', fontSize: 11, marginBottom: 8 }}>
              미배치 조각 ({unplaced.length}/{puzzle.pieces.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {unplaced.map(piece => {
                const isActive = activePieceId === piece.id;
                const oi = isActive ? dragOrient : 0;
                return (
                  <div
                    key={piece.id}
                    onMouseDown={e => {
                      e.preventDefault();
                      if (disabled) return;
                      if (activePieceId !== piece.id) setOrientIdx(0);
                      setSelectedPieceId(piece.id);
                      dragStartRef.current = { pieceId: piece.id, startX: e.clientX, startY: e.clientY };
                    }}
                    style={{
                      background: isActive ? '#3a3a3d' : '#1e1e1e',
                      border: `2px solid ${isActive ? piece.color : '#3e3e42'}`,
                      borderRadius: 6, padding: '6px 10px',
                      cursor: disabled ? 'not-allowed' : 'grab',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'border-color 0.15s, background 0.1s',
                      opacity: drag?.pieceId === piece.id ? 0.5 : 1,
                    }}
                  >
                    <PieceMini piece={piece} orientIdx={oi} cellSize={MINI} />
                    <div>
                      <div style={{ color: piece.color, fontSize: 11, fontWeight: 700 }}>{piece.id}</div>
                      <div style={{ color: '#555', fontSize: 10 }}>{piece.size}칸</div>
                    </div>
                  </div>
                );
              })}
              {unplaced.length === 0 && (
                <div style={{ color: '#4ec9b0', fontSize: 12, textAlign: 'center', padding: '4px 0' }}>✓ 모두 배치!</div>
              )}
            </div>
          </div>

          {/* Placed pieces */}
          {placedIds.size > 0 && (
            <div style={{ ...panel, padding: '8px 10px' }}>
              <div style={{ color: '#9cdcfe', fontSize: 11, marginBottom: 6 }}>배치됨 (클릭: 되돌리기)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[...placedIds].map(pid => {
                  const p = puzzle.pieces.find(x => x.id === pid);
                  return (
                    <div key={pid} onClick={() => handleRemove(pid)} style={{
                      background: p?.color + '22', border: `1px solid ${p?.color ?? '#555'}`,
                      borderRadius: 4, padding: '2px 8px', color: p?.color, fontSize: 11,
                      cursor: disabled ? 'default' : 'pointer',
                    }}>
                      {pid} ✕
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* My progress summary */}
          <div style={{ ...panel, padding: '8px 10px', marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#888', fontSize: 11 }}>내 진행도</span>
              <span style={{ color: '#d4d4d4', fontSize: 11 }}>{placedIds.size}/{puzzle.pieces.length}</span>
            </div>
            <div style={{ background: '#1e1e1e', borderRadius: 3, height: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${puzzle.pieces.length ? (placedIds.size / puzzle.pieces.length) * 100 : 0}%`,
                height: '100%',
                background: isSolved ? '#4ec9b0' : '#569cd6',
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Solve message ────────────────────────────────────────────────── */}
      {isSolved && (
        <div style={{ ...panel, background: winner === myPlayerIndex ? '#1a2e2b' : '#1e2533',
          borderColor: winner === myPlayerIndex ? '#4ec9b0' : '#569cd6',
          textAlign: 'center', fontSize: 15, fontWeight: 700,
          color: winner === myPlayerIndex ? '#4ec9b0' : '#9cdcfe',
        }}>
          {winner === myPlayerIndex ? '🏆 우승! ' : '✓ 완료! '}
          {formatTime(myState.solveTimeMs)}
        </div>
      )}

      {/* ── Floating piece preview during drag ─────────────────────────── */}
      {drag && dragPiece && (
        <div style={{
          position: 'fixed', left: drag.x + 12, top: drag.y - 12,
          pointerEvents: 'none', zIndex: 9999,
          opacity: 0.85, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))',
        }}>
          <PieceMini piece={dragPiece} orientIdx={dragOrient} cellSize={MINI * 2} />
        </div>
      )}
    </div>
  );
}
