import { useState, useCallback } from 'react';
import { StudyStateResponse, StudyMoveRequest, RushHourGameData, RushHourVehicle, RushHourPlayerState } from '../../types';

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
}

const CELL = 36;
const GAP  = 2;
const BOARD = 6;
const OPACITY_KEY = 'rush_hour_opacity';

const panel: React.CSSProperties = {
  background: '#252526', border: '1px solid #3e3e42', borderRadius: 8,
  padding: '10px 14px', marginBottom: 10,
};

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function buildGrid(vehicles: RushHourVehicle[]): number[][] {
  const grid: number[][] = Array.from({ length: BOARD }, () => Array(BOARD).fill(-1));
  for (const v of vehicles) {
    for (let i = 0; i < v.length; i++) {
      const r = v.horizontal ? v.row     : v.row + i;
      const c = v.horizontal ? v.col + i : v.col;
      if (r >= 0 && r < BOARD && c >= 0 && c < BOARD) grid[r][c] = v.id;
    }
  }
  return grid;
}

/**
 * Returns all valid target top-left positions for this vehicle.
 * Horizontal: checks each new leading cell as the vehicle slides.
 * Vertical:   checks each new leading cell as the vehicle slides.
 */
function validMoves(v: RushHourVehicle, grid: number[][]): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = [];
  if (v.horizontal) {
    // slide left: new left edge enters a cell to the left each step
    for (let newLeft = v.col - 1; newLeft >= 0; newLeft--) {
      if (grid[v.row][newLeft] !== -1) break;
      out.push({ row: v.row, col: newLeft });
    }
    // slide right: new right edge = newLeft + length - 1
    for (let newLeft = v.col + 1; newLeft + v.length - 1 < BOARD; newLeft++) {
      const newRight = newLeft + v.length - 1;
      if (grid[v.row][newRight] !== -1) break;
      out.push({ row: v.row, col: newLeft });
    }
  } else {
    // slide up
    for (let newTop = v.row - 1; newTop >= 0; newTop--) {
      if (grid[newTop][v.col] !== -1) break;
      out.push({ row: newTop, col: v.col });
    }
    // slide down: new bottom = newTop + length - 1
    for (let newTop = v.row + 1; newTop + v.length - 1 < BOARD; newTop++) {
      const newBottom = newTop + v.length - 1;
      if (grid[newBottom][v.col] !== -1) break;
      out.push({ row: newTop, col: v.col });
    }
  }
  return out;
}

function Board({
  playerState, isMe, isSolved, onMove, disabled,
}: {
  playerState: RushHourPlayerState;
  isMe: boolean;
  isSolved: boolean;
  onMove: (vehicleId: number, targetRow: number, targetCol: number) => void;
  disabled: boolean;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const grid  = buildGrid(playerState.vehicles);
  const sel   = selectedId !== null ? playerState.vehicles.find(v => v.id === selectedId) ?? null : null;
  const moves = sel ? validMoves(sel, grid) : [];
  const moveSet = new Set(moves.map(m => `${m.row},${m.col}`));
  const boardPx = BOARD * CELL + (BOARD - 1) * GAP;

  const clickVehicle = useCallback((id: number) => {
    if (!isMe || disabled) return;
    setSelectedId(prev => prev === id ? null : id);
  }, [isMe, disabled]);

  const clickCell = useCallback((row: number, col: number) => {
    if (!isMe || disabled) return;
    const key = `${row},${col}`;
    if (sel && moveSet.has(key)) {
      onMove(sel.id, row, col);
      setSelectedId(null);
    } else {
      const cid = grid[row][col];
      setSelectedId(cid !== -1 ? (cid === selectedId ? null : cid) : null);
    }
  }, [isMe, disabled, sel, moveSet, grid, selectedId, onMove]);

  return (
    <div style={{ position: 'relative', width: boardPx, height: boardPx, flexShrink: 0 }}>
      {/* Grid cells */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD}, ${CELL}px)`,
        gridTemplateRows: `repeat(${BOARD}, ${CELL}px)`,
        gap: GAP,
      }}>
        {Array.from({ length: BOARD * BOARD }).map((_, idx) => {
          const row = Math.floor(idx / BOARD), col = idx % BOARD;
          const isTarget = moveSet.has(`${row},${col}`) && grid[row][col] === -1;
          return (
            <div key={idx} onClick={() => clickCell(row, col)} style={{
              background: isTarget ? 'rgba(255,255,255,0.12)' : '#1e1e1e',
              border: isTarget ? '2px dashed rgba(255,255,255,0.35)' : '1px solid #3e3e42',
              borderRadius: 4,
              cursor: isTarget ? 'pointer' : 'default',
              boxSizing: 'border-box',
            }} />
          );
        })}
      </div>

      {/* Exit arrow */}
      <div style={{
        position: 'absolute', right: -26,
        top: 2 * (CELL + GAP) + CELL / 2 - 10,
        fontSize: 18, color: '#e74c3c', fontWeight: 'bold',
      }}>▶</div>

      {/* Vehicles */}
      {playerState.vehicles.map(v => {
        const isSel = v.id === selectedId;
        const top   = v.row * (CELL + GAP);
        const left  = v.col * (CELL + GAP);
        const w = v.horizontal ? v.length * CELL + (v.length - 1) * GAP : CELL;
        const h = v.horizontal ? CELL : v.length * CELL + (v.length - 1) * GAP;

        return (
          <div key={v.id} onClick={() => clickVehicle(v.id)} style={{
            position: 'absolute', top, left, width: w, height: h,
            background: v.color, borderRadius: 8,
            border: isSel ? '3px solid #fff' : '2px solid rgba(0,0,0,0.3)',
            boxSizing: 'border-box',
            cursor: isMe && !disabled ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isSel ? '0 0 14px rgba(255,255,255,0.55)' : '0 2px 4px rgba(0,0,0,0.4)',
            transition: 'box-shadow 0.12s, border 0.12s',
            zIndex: isSel ? 10 : 5, userSelect: 'none',
          }}>
            {v.id === 0 && <span style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', opacity: 0.9 }}>★</span>}

            {/* Move overlays for selected vehicle */}
            {isSel && moves.map((m, mi) => {
              const mTop  = m.row * (CELL + GAP) - top;
              const mLeft = m.col * (CELL + GAP) - left;
              const isLeft  = v.horizontal && m.col < v.col;
              const isRight = v.horizontal && m.col > v.col;
              const isUp    = !v.horizontal && m.row < v.row;
              return (
                <div key={mi}
                  onClick={e => { e.stopPropagation(); onMove(v.id, m.row, m.col); setSelectedId(null); }}
                  style={{
                    position: 'absolute', top: mTop, left: mLeft, width: w, height: h,
                    background: 'rgba(255,255,255,0.13)',
                    border: '2px dashed rgba(255,255,255,0.55)',
                    borderRadius: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, color: 'rgba(255,255,255,0.8)',
                    zIndex: 20, boxSizing: 'border-box',
                  }}>
                  {isLeft ? '←' : isRight ? '→' : isUp ? '↑' : '↓'}
                </div>
              );
            })}
          </div>
        );
      })}

      {isSolved && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.62)', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 'bold', color: '#2ecc71', zIndex: 30,
        }}>탈출! 🎉</div>
      )}
    </div>
  );
}

export default function RushHour({ studyState, sessionId, myPlayerIndex, sendMove }: Props) {
  const [opacity, setOpacityState] = useState<number>(() => {
    const stored = localStorage.getItem(OPACITY_KEY);
    return stored ? parseFloat(stored) : 1;
  });

  const setOpacity = (v: number) => {
    setOpacityState(v);
    localStorage.setItem(OPACITY_KEY, String(v));
  };

  const gameData   = studyState?.gameData as RushHourGameData | undefined;
  const playerNames = studyState?.playerNames ?? [];
  const status     = studyState?.status;

  const handleMove = useCallback((vehicleId: number, targetRow: number, targetCol: number) => {
    sendMove({ moveType: 'RUSH_MOVE', data: '', sessionId, payload: { vehicleId, targetRow, targetCol } });
  }, [sendMove, sessionId]);

  if (!gameData) return <div style={{ color: '#888', padding: 24 }}>게임 로딩 중...</div>;

  const winner     = gameData.winner;
  const isFinished = status === 'FINISHED';
  const puzzleNo   = (gameData.puzzleIndex ?? 0) + 1;

  return (
    <div style={{ padding: 16, color: '#d4d4d4', fontFamily: 'monospace', opacity }}>
      {/* Header */}
      <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ color: '#569cd6', fontWeight: 'bold', fontSize: 15 }}>🚗 러시아워</span>
        <span style={{ color: '#555', fontSize: 12 }}>Puzzle #{puzzleNo}</span>
        <span style={{ color: '#888', fontSize: 12 }}>빨간 차(★)를 ▶ 출구로 탈출시키세요</span>
        {isFinished && winner >= 0 && (
          <span style={{ color: '#2ecc71', fontWeight: 'bold', marginLeft: 'auto' }}>
            🏆 {playerNames[winner] ?? `P${winner+1}`} 우승!
          </span>
        )}

        {/* Opacity control — always visible, does NOT affect itself */}
        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
          background: '#2d2d30', borderRadius: 6, padding: '4px 10px',
          border: '1px solid #3e3e42', opacity: 1 /* immune to parent opacity */,
        }}>
          <span style={{ fontSize: 11, color: '#888' }}>투명도</span>
          <input
            type="range" min={0.2} max={1} step={0.05}
            value={opacity}
            onChange={e => setOpacity(parseFloat(e.target.value))}
            style={{ width: 90, accentColor: '#569cd6', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, color: '#569cd6', minWidth: 28, textAlign: 'right' }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>
      </div>

      {/* Rankings */}
      <div style={{ ...panel }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>순위</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {gameData.playerStates
            .map((ps, i) => ({ ps, i, name: playerNames[i] ?? `P${i+1}` }))
            .sort((a, b) => {
              if (a.ps.solved && b.ps.solved) return a.ps.solveTimeMs - b.ps.solveTimeMs;
              if (a.ps.solved) return -1; if (b.ps.solved) return 1; return 0;
            })
            .map(({ ps, i, name }, rank) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: i === myPlayerIndex ? '#2d2d30' : 'transparent',
                borderRadius: 6, padding: '4px 8px',
                border: i === myPlayerIndex ? '1px solid #569cd6' : '1px solid transparent',
              }}>
                <span style={{ color: rank === 0 && ps.solved ? '#f1c40f' : '#888', fontWeight: 'bold' }}>
                  {rank === 0 && ps.solved ? '🥇' : `#${rank+1}`}
                </span>
                <span style={{ color: i === myPlayerIndex ? '#569cd6' : '#d4d4d4' }}>{name}</span>
                <span style={{ color: '#888', fontSize: 11 }}>{ps.moves}수</span>
                {ps.solved && <span style={{ color: '#2ecc71', fontSize: 11 }}>{formatTime(ps.solveTimeMs)}</span>}
              </div>
            ))}
        </div>
      </div>

      {/* Boards */}
      <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {gameData.playerStates.map((ps, i) => {
          const isMe = i === myPlayerIndex;
          const name = playerNames[i] ?? `P${i+1}`;
          return (
            <div key={i}>
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  color: isMe ? '#569cd6' : '#d4d4d4',
                  fontWeight: isMe ? 'bold' : 'normal', fontSize: 13,
                }}>
                  {name}{isMe ? ' (나)' : ''}
                </span>
                <span style={{ color: '#888', fontSize: 11 }}>{ps.moves}수</span>
                {ps.solved && <span style={{ color: '#2ecc71', fontSize: 11 }}>✓ 완료</span>}
              </div>
              <Board
                playerState={ps} isMe={isMe} isSolved={ps.solved}
                onMove={handleMove} disabled={isFinished || ps.solved}
              />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, ...panel, fontSize: 11, color: '#555' }}>
        차량 클릭 → 이동 위치 클릭. 빨간 차(★)를 오른쪽 끝(▶)까지 이동시키면 탈출!
      </div>
    </div>
  );
}
