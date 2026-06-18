import { useEffect, useMemo, useRef, useState } from 'react';
import { StudyStateResponse, StudyMoveRequest, RummikubGameData } from '../../types';

// ─── Tile helpers ─────────────────────────────────────────────────────────────
const tileNumber = (id: number): number => id >= 104 ? 0 : (id % 52) % 13 + 1;
const tileColor  = (id: number): number => id >= 104 ? -1 : Math.floor((id % 52) / 13);
const isJoker    = (id: number): boolean => id >= 104;

// ─── Client-side set validation (mirrors server) ──────────────────────────────
function isValidSetClient(tiles: number[]): boolean {
  if (tiles.length < 3) return false;
  const normals = tiles.filter(t => !isJoker(t));
  const jokers  = tiles.length - normals.length;
  return isGroupClient(normals, jokers, tiles.length) || isRunClient(normals, jokers, tiles.length);
}

function isGroupClient(normals: number[], _jokers: number, total: number): boolean {
  if (total > 4) return false;
  if (normals.length === 0) return true;
  const num = tileNumber(normals[0]);
  const colors = new Set<number>();
  for (const t of normals) {
    if (tileNumber(t) !== num) return false;
    if (colors.has(tileColor(t))) return false;
    colors.add(tileColor(t));
  }
  return true;
}

function isRunClient(normals: number[], jokers: number, total: number): boolean {
  if (normals.length === 0) return total >= 3;
  const color = tileColor(normals[0]);
  const nums: number[] = [];
  for (const t of normals) {
    if (tileColor(t) !== color) return false;
    nums.push(tileNumber(t));
  }
  nums.sort((a, b) => a - b);
  for (let i = 1; i < nums.length; i++) if (nums[i] === nums[i - 1]) return false;
  let gaps = 0;
  for (let i = 1; i < nums.length; i++) gaps += nums[i] - nums[i - 1] - 1;
  if (gaps > jokers) return false;
  const remaining = jokers - gaps;
  const lo = nums[0], hi = nums[nums.length - 1];
  for (let before = 0; before <= remaining; before++) {
    const s = lo - before;
    const e = s + total - 1;
    if (s >= 1 && e <= 13 && e >= hi) return true;
  }
  return false;
}

/**
 * When placing newTiles into existingSet that contains a joker:
 * if the combined set is invalid but without the joker it becomes valid,
 * auto-eject the joker (goes to floating, must be reused elsewhere).
 */
function addTilesWithJokerEject(
  existingSet: number[],
  newTiles: number[]
): { set: number[]; ejected: number[] } {
  const combined = [...existingSet, ...newTiles];
  const setJokers = existingSet.filter(isJoker);

  if (setJokers.length === 0 || isValidSetClient(combined)) {
    return { set: combined, ejected: [] };
  }

  for (const joker of setJokers) {
    // remove exactly one occurrence of this joker
    const withoutJoker = (() => {
      const arr = [...combined];
      const idx = arr.indexOf(joker);
      if (idx !== -1) arr.splice(idx, 1);
      return arr;
    })();
    if (withoutJoker.length >= 3 && isValidSetClient(withoutJoker)) {
      return { set: withoutJoker, ejected: [joker] };
    }
  }

  return { set: combined, ejected: [] };
}

// ─── Visual ───────────────────────────────────────────────────────────────────
const TILE_BG: Record<number, string> = { 0: '#2a2a2e', 1: '#8b1a1a', 2: '#1a4a8a', 3: '#7a4010' };
const TILE_FG: Record<number, string> = { 0: '#d4d4d4', 1: '#ffaaaa', 2: '#aaccff', 3: '#ffcc88' };
const P_COLORS = ['#569cd6', '#4ec9b0', '#ce9178', '#c586c0', '#dcdcaa', '#9cdcfe'];
const COLOR_LABELS = ['■', '●', '▲', '★'];

function Tile({
  id, selected, dim, glowColor, dragging, dragOver, onClick,
  onDragStart, onDragEnter, onDragEnd,
}: {
  id: number; selected?: boolean; dim?: boolean; glowColor?: string;
  dragging?: boolean; dragOver?: boolean;
  onClick?: () => void; onDragStart?: () => void; onDragEnter?: () => void; onDragEnd?: () => void;
}) {
  const num = tileNumber(id);
  const col = tileColor(id);
  const bg  = isJoker(id) ? '#3a3020' : (TILE_BG[col] ?? '#2a2a2e');
  const fg  = isJoker(id) ? '#ffd700' : (TILE_FG[col] ?? '#d4d4d4');

  const borderColor = dragOver     ? '#ffd700'
                    : glowColor    ? glowColor
                    : selected     ? '#ffffff'
                    : '#55555588';

  return (
    <div
      draggable={!!onDragStart}
      onClick={onClick}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); }}
      onDragEnter={e => { e.preventDefault(); onDragEnter?.(); }}
      onDragOver={e => e.preventDefault()}
      onDragEnd={onDragEnd}
      title={isJoker(id) ? 'Joker' : `${COLOR_LABELS[col] ?? '?'} ${num}`}
      style={{
        width: 30, height: 38, borderRadius: 4,
        cursor: onClick ? 'pointer' : 'default',
        background: bg, color: fg,
        border: `2px solid ${borderColor}`,
        boxShadow: glowColor   ? `0 0 8px ${glowColor}99`
                 : selected    ? '0 0 6px #ffffff88'
                 : dragging    ? '0 0 8px #ffd70066'
                 : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
        opacity: dim ? 0.4 : dragging ? 0.5 : 1,
        userSelect: 'none', flexShrink: 0,
        transition: 'border .1s, box-shadow .1s',
      }}
    >
      {isJoker(id) ? '★' : num}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  studyState: StudyStateResponse | null;
  myPlayerIndex: number;
  sessionId: string;
  sendMove: (req: StudyMoveRequest) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Rummikub({ studyState, myPlayerIndex, sessionId, sendMove }: Props) {
  const game   = studyState?.gameData as RummikubGameData | null | undefined;
  const status = studyState?.status;

  // Draft state — fully liquid; server only sees the submitted table
  const [draftTable,   setDraftTable]   = useState<number[][]>([]);
  const [draftHand,    setDraftHand]    = useState<number[]>([]);
  // Tiles picked from hand (to be placed on table)
  const [selectedHand, setSelectedHand] = useState<Set<number>>(new Set());
  // Tiles picked from table (MUST be placed on table, cannot return to hand)
  const [floating,     setFloating]     = useState<number[]>([]);
  // Persistent sort preference — survives server state updates
  const [sortMode, setSortMode] = useState<'none' | 'number' | 'color'>('none');

  // hand drag-reorder
  const dragIdx  = useRef<number>(-1);
  const dragOver = useRef<number>(-1);
  const [dragState, setDragState] = useState<{ from: number; over: number }>({ from: -1, over: -1 });

  const applySort = (hand: number[], mode: 'none' | 'number' | 'color') => {
    if (mode === 'number') return [...hand].sort((a, b) => {
      const na = isJoker(a) ? 99 : tileNumber(a), nb = isJoker(b) ? 99 : tileNumber(b);
      return na !== nb ? na - nb : tileColor(a) - tileColor(b);
    });
    if (mode === 'color') return [...hand].sort((a, b) => {
      const ca = isJoker(a) ? 99 : tileColor(a), cb = isJoker(b) ? 99 : tileColor(b);
      return ca !== cb ? ca - cb : tileNumber(a) - tileNumber(b);
    });
    return [...hand];
  };

  // Reset on server state change — re-apply persistent sort
  useEffect(() => {
    setDraftTable(game?.table ? game.table.map(s => [...s]) : []);
    const raw = game?.hands?.[myPlayerIndex] ? [...game.hands[myPlayerIndex]] : [];
    setDraftHand(applySort(raw, sortMode));
    setSelectedHand(new Set());
    setFloating([]);
    setDragState({ from: -1, over: -1 });
  }, [studyState]); // eslint-disable-line

  const isMyTurn = game?.currentTurn === myPlayerIndex && status === 'PLAYING';
  const hasSelection = selectedHand.size > 0 || floating.length > 0;

  const hasPlayed = useMemo(() => {
    const serverHand  = game?.hands?.[myPlayerIndex] ?? [];
    const serverTable = game?.table ?? [];
    // sorted join so reorder doesn't count
    return [...draftHand].sort().join(',') !== [...serverHand].sort().join(',')
        || JSON.stringify(draftTable) !== JSON.stringify(serverTable);
  }, [draftHand, draftTable, game, myPlayerIndex]);

  // ─── Hand drag ────────────────────────────────────────────────────────────
  function onHandDragStart(i: number) {
    dragIdx.current = i; dragOver.current = i;
    setDragState({ from: i, over: i });
  }
  function onHandDragEnter(i: number) {
    dragOver.current = i;
    setDragState(s => ({ ...s, over: i }));
  }
  function onHandDragEnd() {
    const from = dragIdx.current, to = dragOver.current;
    if (from !== -1 && to !== -1 && from !== to) {
      setDraftHand(h => {
        const next = [...h];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
    }
    dragIdx.current = -1; dragOver.current = -1;
    setDragState({ from: -1, over: -1 });
  }

  // ─── Sort ─────────────────────────────────────────────────────────────────
  function sortByNumber() {
    setSortMode('number');
    setDraftHand(h => applySort(h, 'number'));
  }
  function sortByColor() {
    setSortMode('color');
    setDraftHand(h => applySort(h, 'color'));
  }
  function sortNone() {
    setSortMode('none');
  }

  // ─── Table interactions ───────────────────────────────────────────────────

  // Pick up a tile from a table set → goes to floating (cannot return to hand)
  function pickFromTable(setIdx: number, tileIdx: number) {
    if (!isMyTurn) return;
    const tileId = draftTable[setIdx][tileIdx];
    setDraftTable(t => {
      const next = t.map((s, i) =>
        i === setIdx ? s.filter((_, ti) => ti !== tileIdx) : s
      );
      return next.filter(s => s.length > 0);
    });
    setFloating(f => [...f, tileId]);
  }

  // Place selected hand tiles + floating into an existing set, with joker auto-eject
  function placeIntoSet(setIdx: number) {
    if (!hasSelection) return;
    const newTiles = [...selectedHand, ...floating];
    const { set: newSet, ejected } = addTilesWithJokerEject(draftTable[setIdx], newTiles);
    setDraftHand(h => h.filter(id => !selectedHand.has(id)));
    setSelectedHand(new Set());
    setFloating(ejected); // ejected jokers stay floating — user must place them
    setDraftTable(t => t.map((s, i) => i === setIdx ? newSet : s));
  }

  // Place selected hand tiles + floating as a brand-new set
  function placeAsNewSet() {
    const newTiles = [...selectedHand, ...floating];
    if (newTiles.length === 0) return;
    setDraftHand(h => h.filter(id => !selectedHand.has(id)));
    setSelectedHand(new Set());
    setFloating([]);
    setDraftTable(t => [...t, newTiles]);
  }

  // Toggle a hand tile in/out of selection
  function toggleHandTile(id: number) {
    if (!isMyTurn) return;
    setSelectedHand(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ─── Action buttons ───────────────────────────────────────────────────────
  function handleDraw() {
    if (!isMyTurn || hasPlayed || floating.length > 0) return;
    sendMove({ moveType: 'RUMMY_DRAW', data: '', sessionId });
  }
  function handleEndTurn() {
    if (!isMyTurn || !hasPlayed || floating.length > 0) return;
    sendMove({ moveType: 'RUMMY_PLACE', data: '', sessionId, payload: draftTable });
  }
  function handleUndo() {
    setDraftTable(game?.table ? game.table.map(s => [...s]) : []);
    setDraftHand(game?.hands?.[myPlayerIndex] ? [...game.hands[myPlayerIndex]] : []);
    setSelectedHand(new Set());
    setFloating([]);
  }

  if (!game) return (
    <div style={{ padding: 32, color: '#858585', textAlign: 'center' }}>Waiting for game data…</div>
  );

  const errorMsg = studyState?.message ?? '';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', overflow: 'hidden',
    }}>

      {/* ── Player bar ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 12px',
        background: '#252526', borderBottom: '1px solid #3e3e42',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {Array.from({ length: game.numPlayers }).map((_, i) => {
          const isCurrent = game.currentTurn === i;
          const name = studyState?.playerNames?.[i] ?? `P${i + 1}`;
          const handSize = game.hands?.[i]?.length ?? 0;
          const pc = P_COLORS[i % P_COLORS.length];
          return (
            <div key={i} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12,
              border: `1px solid ${isCurrent ? pc : '#3e3e42'}`,
              background: isCurrent ? '#2a2a2a' : 'transparent',
              color: pc, fontWeight: isCurrent ? 700 : 400,
              boxShadow: isCurrent ? `0 0 6px ${pc}66` : 'none',
            }}>
              {isCurrent ? '▶ ' : ''}{name}{i === myPlayerIndex ? ' (me)' : ''}{' '}
              <span style={{ color: '#858585' }}>■×{handSize}</span>
              {game.initialMeld?.[i] && <span style={{ color: '#4ec9b0', marginLeft: 4 }}>✓</span>}
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', color: '#858585', fontSize: 12, alignSelf: 'center' }}>
          Pool: {game.poolSize}
        </div>
      </div>

      {/* ── Winner / error banners ── */}
      {game.winner >= 0 && (
        <div style={{
          padding: '10px 16px', background: '#2a3a2a', borderBottom: '1px solid #4ec9b0',
          color: '#4ec9b0', fontWeight: 700, textAlign: 'center', flexShrink: 0,
        }}>
          🏆 {studyState?.playerNames?.[game.winner] ?? `Player ${game.winner + 1}`} wins!
        </div>
      )}
      {errorMsg.startsWith('ERROR:') && (
        <div style={{ padding: '6px 12px', background: '#3a2020', color: '#f14c4c', fontSize: 12, flexShrink: 0 }}>
          {errorMsg}
        </div>
      )}

      {/* ── Table area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' }}>
        {draftTable.length === 0 && !hasSelection && (
          <div style={{ color: '#858585', textAlign: 'center', width: '100%', marginTop: 16, fontSize: 13 }}>
            테이블이 비어있습니다.
          </div>
        )}

        {draftTable.map((set, si) => {
          const valid = isValidSetClient(set);
          // Sort for display by number ascending (jokers at end), preserve original index for pickup
          const sorted = set
            .map((id, idx) => ({ id, idx }))
            .sort((a, b) => {
              const na = isJoker(a.id) ? 999 : tileNumber(a.id);
              const nb = isJoker(b.id) ? 999 : tileNumber(b.id);
              return na !== nb ? na - nb : tileColor(a.id) - tileColor(b.id);
            });
          return (
            <div key={si} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, flexWrap: 'nowrap',
              padding: '4px 6px', background: '#252526', borderRadius: 6,
              border: `1px solid ${!valid && set.length > 0 ? '#f14c4c55' : '#3e3e42'}`,
              flexShrink: 0,
            }}>
              <span style={{ color: '#555', fontSize: 10, marginRight: 1, flexShrink: 0 }}>#{si + 1}</span>

              {sorted.map(({ id: tileId, idx: origIdx }) => (
                <Tile
                  key={`${si}-${origIdx}-${tileId}`}
                  id={tileId}
                  onClick={isMyTurn ? () => pickFromTable(si, origIdx) : undefined}
                  dim={!isMyTurn}
                />
              ))}

              {/* Place-here button */}
              {isMyTurn && hasSelection && (
                <button onClick={() => placeIntoSet(si)} style={smallBtnStyle('#569cd6')}>
                  + 여기에 배치
                </button>
              )}

              {!valid && set.length >= 3 && (
                <span style={{ color: '#f14c4c', fontSize: 10, marginLeft: 2 }}>⚠</span>
              )}
            </div>
          );
        })}

        {/* New set button */}
        {isMyTurn && hasSelection && (
          <button onClick={placeAsNewSet} style={{
            alignSelf: 'flex-start', marginTop: 4, padding: '5px 14px', fontSize: 12,
            background: '#1a2a3a', border: '1px solid #569cd6', color: '#569cd6',
            borderRadius: 6, cursor: 'pointer',
          }}>
            + 새 세트 ({[...selectedHand].length + floating.length}개)
          </button>
        )}
      </div>

      {/* ── Floating tiles (picked from table — must be re-placed) ── */}
      {floating.length > 0 && (
        <div style={{
          borderTop: '1px solid #ffd70066', background: '#252018',
          padding: '8px 12px', flexShrink: 0,
        }}>
          <div style={{ color: '#ffd700', fontSize: 11, marginBottom: 6 }}>
            ★ 배치 필요 ({floating.length}개) — 다른 세트에 배치하세요. 손으로 가져갈 수 없습니다.
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {floating.map((id, i) => (
              <Tile key={`float-${i}-${id}`} id={id} glowColor="#ffd700" />
            ))}
          </div>
        </div>
      )}

      {/* ── My hand ── */}
      <div style={{ borderTop: '1px solid #3e3e42', background: '#252526', padding: '10px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#858585' }}>
            내 패 ({draftHand.length}장)
            {!isMyTurn && <span style={{ marginLeft: 8, color: '#ce9178' }}>— 상대 턴</span>}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => sortMode === 'number' ? sortNone() : sortByNumber()}
              style={activeSortBtnStyle('#4ec9b0', sortMode === 'number')}
            >숫자순{sortMode === 'number' ? ' ✓' : ''}</button>
            <button
              onClick={() => sortMode === 'color' ? sortNone() : sortByColor()}
              style={activeSortBtnStyle('#c586c0', sortMode === 'color')}
            >색상순{sortMode === 'color' ? ' ✓' : ''}</button>
          </div>
        </div>

        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 44, marginBottom: 10 }}
          onDragOver={e => e.preventDefault()}
        >
          {draftHand.map((id, i) => (
            <Tile
              key={`hand-${i}-${id}`}
              id={id}
              selected={selectedHand.has(id)}
              dragging={dragState.from === i}
              dragOver={dragState.over === i && dragState.from !== i}
              onClick={() => toggleHandTile(id)}
              onDragStart={() => onHandDragStart(i)}
              onDragEnter={() => onHandDragEnter(i)}
              onDragEnd={onHandDragEnd}
            />
          ))}
          {draftHand.length === 0 && (
            <span style={{ color: '#858585', fontSize: 12, alignSelf: 'center' }}>패가 없습니다</span>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleDraw}
            disabled={!isMyTurn || hasPlayed || floating.length > 0}
            style={btnStyle(!isMyTurn || hasPlayed || floating.length > 0, '#4ec9b0')}
          >뽑기</button>
          <button
            onClick={handleEndTurn}
            disabled={!isMyTurn || !hasPlayed || floating.length > 0}
            style={btnStyle(!isMyTurn || !hasPlayed || floating.length > 0, '#569cd6')}
          >
            턴 종료{floating.length > 0 ? ' (★ 먼저 배치)' : ''}
          </button>
          <button
            onClick={handleUndo}
            disabled={!isMyTurn}
            style={btnStyle(!isMyTurn, '#858585')}
          >되돌리기</button>
          {selectedHand.size > 0 && (
            <span style={{ color: '#858585', fontSize: 11 }}>
              {selectedHand.size}개 선택됨 — 세트 클릭 또는 "새 세트"
            </span>
          )}
        </div>

        {isMyTurn && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#555' }}>
            패 클릭 → 선택 · 테이블 타일 클릭 → 집어들기(★) · 조커가 있는 세트에 배치하면 자동 대체
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(disabled: boolean, color: string): React.CSSProperties {
  return {
    padding: '5px 16px', fontSize: 12, borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#2a2a2a' : `${color}18`,
    border: `1px solid ${disabled ? '#3e3e42' : color}`,
    color: disabled ? '#858585' : color,
    transition: 'all .15s',
  };
}

function smallBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '2px 8px', fontSize: 10, borderRadius: 4,
    cursor: 'pointer', background: 'transparent',
    border: `1px solid ${color}`, color,
    transition: 'all .15s', flexShrink: 0,
  };
}

function activeSortBtnStyle(color: string, active: boolean): React.CSSProperties {
  return {
    padding: '2px 8px', fontSize: 10, borderRadius: 4,
    cursor: 'pointer',
    background: active ? color : 'transparent',
    border: `1px solid ${color}`,
    color: active ? '#1e1e1e' : color,
    fontWeight: active ? 700 : 400,
    transition: 'all .15s', flexShrink: 0,
  };
}
