import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { StudyMoveRequest, StudyStateResponse, UbongoGameData, UbongoPieceInfo } from '../../types';

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
}

const OPACITY_KEY = 'ubongo_opacity';
const BOARD = 5;
const CELL = 46;
const MINI = 10;
const MINI_BOX = BOARD * MINI;

const panel: CSSProperties = {
  background: '#252526',
  border: '1px solid #3e3e42',
  borderRadius: 8,
  padding: '10px 14px',
  marginBottom: 6,
};

type Placement = { row: number; col: number; orientationIndex: number };
type BoardPieces = (string | null)[][];
type Anchor = [number, number];

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function getPuzzleKey(data: UbongoGameData | null) {
  if (!data) return '';
  const blocked = data.puzzle.blocked.map(row => row.map(cell => (cell ? '1' : '0')).join('')).join('/');
  const pieces = data.puzzle.pieces.map(piece => piece.id).join(',');
  return `${pieces}|${blocked}|${data.startTime}`;
}

function getOrientation(piece: UbongoPieceInfo, orientIdx: number) {
  return piece.orientations[orientIdx % piece.orientations.length] ?? [];
}

function getDefaultAnchor(piece: UbongoPieceInfo, orientIdx: number): Anchor {
  const orient = getOrientation(piece, orientIdx);
  return orient[0] ? [orient[0][0], orient[0][1]] : [0, 0];
}

function normalizeAnchor(piece: UbongoPieceInfo, orientIdx: number, anchor: Anchor): Anchor {
  const orient = getOrientation(piece, orientIdx);
  return orient.some(([r, c]) => r === anchor[0] && c === anchor[1])
    ? anchor
    : getDefaultAnchor(piece, orientIdx);
}

function buildBoardPieces(placements: Record<string, Placement>, pieces: UbongoPieceInfo[]): BoardPieces {
  const board: BoardPieces = Array.from({ length: BOARD }, () => Array(BOARD).fill(null));
  for (const [pieceId, placement] of Object.entries(placements)) {
    const piece = pieces.find(item => item.id === pieceId);
    if (!piece) continue;
    for (const [dr, dc] of getOrientation(piece, placement.orientationIndex)) {
      const r = placement.row + dr;
      const c = placement.col + dc;
      if (r >= 0 && r < BOARD && c >= 0 && c < BOARD) board[r][c] = pieceId;
    }
  }
  return board;
}

function isValidPlacement(
  pieceId: string,
  row: number,
  col: number,
  orientIdx: number,
  pieces: UbongoPieceInfo[],
  blocked: boolean[][],
  boardPieces: BoardPieces,
) {
  const piece = pieces.find(item => item.id === pieceId);
  if (!piece) return false;
  for (const [dr, dc] of getOrientation(piece, orientIdx)) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= BOARD || c < 0 || c >= BOARD) return false;
    if (blocked[r][c]) return false;
    if (boardPieces[r][c] !== null) return false;
  }
  return true;
}

function getOccupiedCells(piece: UbongoPieceInfo, row: number, col: number, orientIdx: number): Anchor[] {
  return getOrientation(piece, orientIdx).map(([dr, dc]) => [row + dr, col + dc]);
}

function PieceMini({ piece, orientIdx, cellSize = MINI }: {
  piece: UbongoPieceInfo;
  orientIdx: number;
  cellSize?: number;
}) {
  const orient = getOrientation(piece, orientIdx);
  const maxR = Math.max(0, ...orient.map(([r]) => r));
  const maxC = Math.max(0, ...orient.map(([, c]) => c));

  return (
    <div style={{
      position: 'relative',
      width: Math.max(MINI_BOX, (maxC + 1) * cellSize),
      height: Math.max(MINI_BOX, (maxR + 1) * cellSize),
    }}>
      {orient.map(([dr, dc], index) => (
        <div
          key={`${dr}-${dc}-${index}`}
          data-ubongo-piece-cell="1"
          data-piece-row={dr}
          data-piece-col={dc}
          style={{
            position: 'absolute',
            left: dc * cellSize,
            top: dr * cellSize,
            width: cellSize - 2,
            height: cellSize - 2,
            background: piece.color,
            border: '1px solid rgba(0,0,0,0.35)',
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

function MiniBoard({ placements, pieces, blocked, solved }: {
  placements: Record<string, Placement>;
  pieces: UbongoPieceInfo[];
  blocked: boolean[][];
  solved: boolean;
}) {
  const boardPieces = buildBoardPieces(placements, pieces);
  const cellSize = 10;

  return (
    <div style={{
      display: 'inline-grid',
      gridTemplateColumns: `repeat(${BOARD}, ${cellSize}px)`,
      gap: 1.5,
      background: solved ? '#1a2e2b' : '#1a1a1c',
      padding: 3,
      borderRadius: 4,
      border: `1px solid ${solved ? '#4ec9b0' : '#3e3e42'}`,
    }}>
      {Array.from({ length: BOARD }, (_, r) =>
        Array.from({ length: BOARD }, (_, c) => {
          const pieceId = boardPieces[r][c];
          const piece = pieceId ? pieces.find(item => item.id === pieceId) : null;
          return (
            <div
              key={`${r}-${c}`}
              style={{
                width: cellSize,
                height: cellSize,
                background: blocked[r][c] ? '#0f0f10' : piece ? piece.color : '#2d2d30',
                borderRadius: 2,
                opacity: blocked[r][c] ? 0.5 : 1,
              }}
            />
          );
        }),
      )}
    </div>
  );
}

export default function Ubongo({ studyState, sessionId, myPlayerIndex, sendMove }: Props) {
  const gameData = studyState?.gameData as UbongoGameData | null;
  const playerNames = studyState?.playerNames ?? [];
  const stablePuzzleKey = useMemo(() => getPuzzleKey(gameData), [gameData]);

  const [opacity, setOpacityState] = useState(() => {
    const stored = localStorage.getItem(OPACITY_KEY);
    return stored ? parseFloat(stored) : 1;
  });
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [orientIdx, setOrientIdx] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [drag, setDrag] = useState<{
    pieceId: string;
    x: number;
    y: number;
    targetCell: Anchor | null;
    anchor: Anchor;
  } | null>(null);

  const dragStartRef = useRef<{ pieceId: string; startX: number; startY: number; anchor: Anchor } | null>(null);
  const justDroppedRef = useRef(false);
  const orientRef = useRef(orientIdx);
  const sessionRef = useRef(sessionId);
  const sendRef = useRef(sendMove);
  const gameDataRef = useRef<UbongoGameData | null>(gameData);
  const disabledRef = useRef(false);

  orientRef.current = orientIdx;
  sessionRef.current = sessionId;
  sendRef.current = sendMove;
  gameDataRef.current = gameData;

  const myState = gameData?.playerStates[myPlayerIndex] ?? { placements: {}, solved: false, solveTimeMs: 0 };
  const winner = gameData?.winner ?? -1;
  const disabled = myState.solved;
  disabledRef.current = disabled;

  const setOpacity = (value: number) => {
    setOpacityState(value);
    localStorage.setItem(OPACITY_KEY, String(value));
  };

  useEffect(() => {
    setOrientIdx(0);
    setSelectedPieceId(null);
    setDrag(null);
    dragStartRef.current = null;
  }, [stablePuzzleKey]);

  useEffect(() => {
    if (!gameData?.startTime || myState.solved) return undefined;
    const origin = gameData.startTime;
    setElapsedMs(Date.now() - origin);
    const timer = window.setInterval(() => setElapsedMs(Date.now() - origin), 500);
    return () => window.clearInterval(timer);
  }, [gameData?.startTime, myState.solved]);

  const rotateSelected = useCallback(() => {
    if (!selectedPieceId && !drag) return;
    setOrientIdx(value => value + 1);
  }, [drag, selectedPieceId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || Boolean(target?.isContentEditable);
      if (isTyping) return;
      if (event.key === 'r' || event.key === 'R') rotateSelected();
      if (event.key === 'Escape') {
        setDrag(null);
        setSelectedPieceId(null);
        dragStartRef.current = null;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rotateSelected]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (dragStartRef.current && !drag) {
        const { pieceId, startX, startY, anchor } = dragStartRef.current;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (dx * dx + dy * dy > 25) {
          dragStartRef.current = null;
          setDrag({ pieceId, x: event.clientX, y: event.clientY, targetCell: null, anchor });
        }
        return;
      }
      if (!drag) return;

      const element = document.elementFromPoint(event.clientX, event.clientY);
      const cell = element?.closest('[data-ubongo-cell]') as HTMLElement | null;
      const row = cell ? parseInt(cell.dataset.row ?? '-1', 10) : -1;
      const col = cell ? parseInt(cell.dataset.col ?? '-1', 10) : -1;
      setDrag(prev => prev ? {
        ...prev,
        x: event.clientX,
        y: event.clientY,
        targetCell: row >= 0 && col >= 0 ? [row, col] : null,
      } : null);
    };

    const onUp = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null;
        return;
      }

      setDrag(prev => {
        if (!prev) return null;
        const data = gameDataRef.current;
        if (!prev.targetCell || !data || disabledRef.current) return null;

        const piece = data.puzzle.pieces.find(item => item.id === prev.pieceId);
        if (!piece) return null;

        const orientation = orientRef.current % piece.orientations.length;
        const anchor = normalizeAnchor(piece, orientation, prev.anchor);
        const [targetRow, targetCol] = prev.targetCell;
        sendRef.current({
          moveType: 'UBONGO_PLACE',
          data: '',
          sessionId: sessionRef.current,
          payload: {
            pieceId: prev.pieceId,
            row: targetRow - anchor[0],
            col: targetCol - anchor[1],
            orientationIndex: orientation,
          },
        });
        justDroppedRef.current = true;
        window.setTimeout(() => { justDroppedRef.current = false; }, 200);
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
  }, [drag]);

  if (!gameData) return <div style={{ color: '#888', padding: 24 }}>Loading puzzle...</div>;

  const { puzzle, playerStates } = gameData;
  const boardPieces = buildBoardPieces(myState.placements, puzzle.pieces);
  const placedIds = new Set(Object.keys(myState.placements));
  const unplaced = puzzle.pieces.filter(piece => !placedIds.has(piece.id));
  const activePieceId = drag?.pieceId ?? selectedPieceId;
  const activePiece = activePieceId ? puzzle.pieces.find(piece => piece.id === activePieceId) ?? null : null;
  const activeOrientation = activePiece ? orientIdx % activePiece.orientations.length : 0;
  const solved = myState.solved;
  const displayTime = solved ? myState.solveTimeMs : elapsedMs;

  const previewCells = new Set<string>();
  let previewValid = false;
  if (drag?.targetCell && activePiece) {
    const anchor = normalizeAnchor(activePiece, activeOrientation, drag.anchor);
    const row = drag.targetCell[0] - anchor[0];
    const col = drag.targetCell[1] - anchor[1];
    previewValid = isValidPlacement(activePiece.id, row, col, activeOrientation, puzzle.pieces, puzzle.blocked, boardPieces);
    getOccupiedCells(activePiece, row, col, activeOrientation).forEach(([r, c]) => previewCells.add(`${r},${c}`));
  }

  const removePiece = (pieceId: string) => {
    if (disabled) return;
    sendMove({ moveType: 'UBONGO_REMOVE', data: '', sessionId, payload: { pieceId } });
  };

  const startPieceDrag = (event: ReactMouseEvent<HTMLDivElement>, piece: UbongoPieceInfo, shownOrientation: number) => {
    event.preventDefault();
    if (disabled) return;
    if (activePieceId !== piece.id) setOrientIdx(0);
    setSelectedPieceId(piece.id);

    const cell = (event.target as HTMLElement).closest('[data-ubongo-piece-cell]') as HTMLElement | null;
    const anchor: Anchor = cell
      ? [parseInt(cell.dataset.pieceRow ?? '0', 10), parseInt(cell.dataset.pieceCol ?? '0', 10)]
      : getDefaultAnchor(piece, shownOrientation);
    dragStartRef.current = { pieceId: piece.id, startX: event.clientX, startY: event.clientY, anchor };
  };

  const myName = playerNames[myPlayerIndex] ?? `Player ${myPlayerIndex + 1}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 6, gap: 6, userSelect: 'none', opacity }}>
      <div style={{ ...panel, width: '100%', maxWidth: 620, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 10px' }}>
        <span style={{ color: '#569cd6', fontWeight: 700, fontSize: 15 }}>Ubongo</span>
        <span style={{ color: '#6a9955', fontSize: 12 }}>
          pieces {puzzle.pieces.length} / cells {puzzle.pieces.reduce((sum, piece) => sum + piece.size, 0)}
        </span>
        <span style={{
          background: '#1e1e1e',
          border: '1px solid #555',
          borderRadius: 4,
          padding: '2px 10px',
          color: solved ? '#4ec9b0' : '#d4d4d4',
          fontFamily: 'monospace',
          fontSize: 14,
          fontWeight: 700,
        }}>
          {formatTime(displayTime)}{solved ? ' cleared' : ''}
        </span>

        {winner >= 0 && (
          <span style={{ color: '#4ec9b0', fontWeight: 700 }}>
            {playerNames[winner] ?? `Player ${winner + 1}`} solved first
          </span>
        )}

        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#2d2d30',
          borderRadius: 6,
          padding: '4px 10px',
          border: '1px solid #3e3e42',
          opacity: 1,
        }}>
          <span style={{ fontSize: 11, color: '#888' }}>opacity</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={opacity}
            onChange={event => setOpacity(parseFloat(event.target.value))}
            style={{ width: 80, accentColor: '#569cd6', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, color: '#888', width: 30 }}>{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      {playerStates.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {playerStates.map((state, index) => {
            if (index === myPlayerIndex) return null;
            const placed = Object.keys(state.placements).length;
            const isWinner = winner === index;
            return (
              <div key={index} style={{
                ...panel,
                marginBottom: 0,
                borderColor: isWinner ? '#4ec9b0' : '#3e3e42',
                background: isWinner ? '#1a2e2b' : '#1e1e1e',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '5px 8px',
              }}>
                <div style={{ color: isWinner ? '#4ec9b0' : '#9cdcfe', fontSize: 12, fontWeight: 700 }}>
                  {playerNames[index] ?? `Player ${index + 1}`}{isWinner ? ' first' : ''}
                </div>
                <MiniBoard placements={state.placements} pieces={puzzle.pieces} blocked={puzzle.blocked} solved={state.solved} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <div style={{ flex: 1, background: '#1e1e1e', borderRadius: 3, height: 4, overflow: 'hidden', border: '1px solid #333' }}>
                    <div style={{
                      width: `${puzzle.pieces.length ? (placed / puzzle.pieces.length) * 100 : 0}%`,
                      height: '100%',
                      background: state.solved ? '#4ec9b0' : '#555',
                      transition: 'width 0.2s',
                    }} />
                  </div>
                  <span style={{ color: '#888', fontSize: 10 }}>{placed}/{puzzle.pieces.length}</span>
                </div>
                {state.solved && <div style={{ color: '#4ec9b0', fontSize: 10 }}>{formatTime(state.solveTimeMs)}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 535, minHeight: 352, display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ flex: '0 0 260px' }}>
          <div style={{ height: 25, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, justifyContent: 'center' }}>
            <span style={{ color: solved ? '#4ec9b0' : '#9cdcfe', fontWeight: 700, fontSize: 13 }}>
              {myName}'s board
            </span>
            <button
              onClick={rotateSelected}
              disabled={!activePieceId || disabled}
              style={{
                background: activePieceId && !disabled ? '#3e3e42' : '#2a2a2d',
                color: activePieceId && !disabled ? '#d4d4d4' : '#555',
                border: '1px solid #555',
                borderRadius: 4,
                padding: '2px 8px',
                cursor: activePieceId && !disabled ? 'pointer' : 'default',
                fontSize: 11,
              }}
            >
              rotate (R)
            </button>
            {activePiece && (
              <span style={{ color: activePiece.color, fontSize: 10 }}>
                {drag ? 'dragging' : 'selected'} / orientation {activeOrientation + 1}/{activePiece.orientations.length}
              </span>
            )}
          </div>

          <div style={{
            display: 'inline-grid',
            gridTemplateColumns: `repeat(${BOARD}, ${CELL}px)`,
            gap: 2,
            background: '#1a1a1c',
            padding: 5,
            borderRadius: 8,
            border: `2px solid ${solved ? '#4ec9b0' : '#569cd680'}`,
          }}>
            {Array.from({ length: BOARD }, (_, r) =>
              Array.from({ length: BOARD }, (_, c) => {
                const blocked = puzzle.blocked[r][c];
                const occupied = boardPieces[r][c];
                const piece = occupied ? puzzle.pieces.find(item => item.id === occupied) : null;
                const preview = previewCells.has(`${r},${c}`);
                const bg = blocked ? '#0f0f10' : piece ? piece.color : preview && activePiece ? `${activePiece.color}70` : '#2d2d30';
                const border = blocked
                  ? '1.5px solid #111'
                  : occupied
                    ? `1.5px solid ${piece?.color}cc`
                    : preview
                      ? `1.5px dashed ${previewValid ? '#ffffffaa' : '#ff444488'}`
                      : '1.5px solid #3e3e42';

                return (
                  <div
                    key={`${r}-${c}`}
                    data-ubongo-cell="1"
                    data-row={r}
                    data-col={c}
                    onClick={() => {
                      if (!justDroppedRef.current && occupied && !disabled) removePiece(occupied);
                    }}
                    style={{
                      width: CELL,
                      height: CELL,
                      background: bg,
                      border,
                      borderRadius: 4,
                      cursor: blocked ? 'not-allowed' : occupied && !disabled ? 'pointer' : 'default',
                      transition: 'background 0.08s, border-color 0.08s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={occupied ? `${occupied}: click to remove` : blocked ? 'blocked' : ''}
                  >
                    {blocked && <div style={{ width: '40%', height: '40%', background: '#1e1e20', borderRadius: 2 }} />}
                    {occupied && !blocked && <span style={{ fontSize: 9, color: '#fff6', pointerEvents: 'none' }}>{occupied}</span>}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <div style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <div style={{ ...panel, padding: '6px 8px', minHeight: 268, marginBottom: 0 }}>
            <div style={{ color: '#9cdcfe', fontSize: 11, marginBottom: 5 }}>
              unplaced pieces ({unplaced.length}/{puzzle.pieces.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {unplaced.map(piece => {
                const active = activePieceId === piece.id;
                const shownOrientation = active ? activeOrientation : 0;
                return (
                  <div
                    key={piece.id}
                    onMouseDown={event => startPieceDrag(event, piece, shownOrientation)}
                    style={{
                      background: active ? '#3a3a3d' : '#1e1e1e',
                      border: `2px solid ${active ? piece.color : '#3e3e42'}`,
                      borderRadius: 5,
                      padding: '4px 5px',
                      cursor: disabled ? 'not-allowed' : 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      minHeight: 72,
                      transition: 'border-color 0.15s, background 0.1s',
                      opacity: drag?.pieceId === piece.id ? 0.5 : 1,
                    }}
                  >
                    <PieceMini piece={piece} orientIdx={shownOrientation} cellSize={MINI} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: piece.color, fontSize: 10, fontWeight: 700 }}>{piece.id}</div>
                      <div style={{ color: '#555', fontSize: 9 }}>{piece.size} cells</div>
                    </div>
                  </div>
                );
              })}
              {unplaced.length === 0 && (
                <div style={{ color: '#4ec9b0', fontSize: 12, textAlign: 'center', padding: '4px 0' }}>all pieces placed</div>
              )}
            </div>
          </div>

          <div style={{ ...panel, padding: '6px 8px', minHeight: 54, marginBottom: 0 }}>
            <div style={{ color: '#9cdcfe', fontSize: 11, marginBottom: 4 }}>placed pieces</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 22 }}>
              {placedIds.size > 0 ? [...placedIds].map(pieceId => {
                const piece = puzzle.pieces.find(item => item.id === pieceId);
                return (
                  <div key={pieceId} onClick={() => removePiece(pieceId)} style={{
                    background: `${piece?.color ?? '#555'}22`,
                    border: `1px solid ${piece?.color ?? '#555'}`,
                    borderRadius: 4,
                    padding: '1px 5px',
                    color: piece?.color,
                    fontSize: 10,
                    cursor: disabled ? 'default' : 'pointer',
                  }}>
                    {pieceId}
                  </div>
                );
              }) : (
                <span style={{ color: '#555', fontSize: 11 }}>none</span>
              )}
            </div>
          </div>

          <div style={{ ...panel, padding: '6px 8px', marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#888', fontSize: 11 }}>progress</span>
              <span style={{ color: '#d4d4d4', fontSize: 11 }}>{placedIds.size}/{puzzle.pieces.length}</span>
            </div>
            <div style={{ background: '#1e1e1e', borderRadius: 3, height: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${puzzle.pieces.length ? (placedIds.size / puzzle.pieces.length) * 100 : 0}%`,
                height: '100%',
                background: solved ? '#4ec9b0' : '#569cd6',
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{
        ...panel,
        minHeight: 18,
        padding: '5px 10px',
        marginBottom: 0,
        visibility: solved ? 'visible' : 'hidden',
        background: winner === myPlayerIndex ? '#1a2e2b' : '#1e2533',
        borderColor: winner === myPlayerIndex ? '#4ec9b0' : '#569cd6',
        textAlign: 'center',
        fontSize: 15,
        fontWeight: 700,
        color: winner === myPlayerIndex ? '#4ec9b0' : '#9cdcfe',
      }}>
        {winner === myPlayerIndex ? 'First clear' : 'Cleared'} / {formatTime(myState.solveTimeMs)}
      </div>

      {drag && activePiece && (
        <div style={{
          position: 'fixed',
          left: drag.x + 12,
          top: drag.y - 12,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.85,
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))',
        }}>
          <PieceMini piece={activePiece} orientIdx={activeOrientation} cellSize={MINI * 2} />
        </div>
      )}
    </div>
  );
}
