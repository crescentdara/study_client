import { useEffect, useMemo, useRef, useState } from 'react';
import { StudyMoveRequest, StudyStateResponse, RummikubGameData } from '../../types';

const tileNumber = (id: number): number => id >= 104 ? 0 : (id % 52) % 13 + 1;
const tileColor = (id: number): number => id >= 104 ? -1 : Math.floor((id % 52) / 13);
const isJoker = (id: number): boolean => id >= 104;

const TILE_BG: Record<number, string> = { 0: '#2a2a2e', 1: '#8b1a1a', 2: '#1a4a8a', 3: '#7a4010' };
const TILE_FG: Record<number, string> = { 0: '#d4d4d4', 1: '#ffaaaa', 2: '#aaccff', 3: '#ffcc88' };
const COLOR_LABELS = ['black', 'red', 'blue', 'orange'];
const P_COLORS = ['#569cd6', '#4ec9b0', '#ce9178', '#c586c0', '#dcdcaa', '#9cdcfe'];

type SortMode = 'manual' | 'number' | 'color';

interface Props {
  studyState: StudyStateResponse | null;
  secretState?: StudyStateResponse | null;
  myPlayerIndex: number;
  sessionId: string;
  sendMove: (req: StudyMoveRequest) => void;
}

function isValidSetClient(tiles: number[]): boolean {
  if (tiles.length < 3) return false;
  const normals = tiles.filter(t => !isJoker(t));
  const jokers = tiles.length - normals.length;
  if (normals.length === 0) return true;
  return isGroupClient(normals, tiles.length) || isRunClient(normals, jokers, tiles.length);
}

function isGroupClient(normals: number[], total: number): boolean {
  if (total > 4) return false;
  const num = tileNumber(normals[0]);
  const colors = new Set<number>();
  for (const tile of normals) {
    if (tileNumber(tile) !== num) return false;
    if (colors.has(tileColor(tile))) return false;
    colors.add(tileColor(tile));
  }
  return true;
}

function isRunClient(normals: number[], jokers: number, total: number): boolean {
  const color = tileColor(normals[0]);
  const nums: number[] = [];
  for (const tile of normals) {
    if (tileColor(tile) !== color) return false;
    nums.push(tileNumber(tile));
  }
  nums.sort((a, b) => a - b);
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1]) return false;
  }
  let gaps = 0;
  for (let i = 1; i < nums.length; i++) gaps += nums[i] - nums[i - 1] - 1;
  if (gaps > jokers) return false;

  const remaining = jokers - gaps;
  const lo = nums[0];
  const hi = nums[nums.length - 1];
  for (let before = 0; before <= remaining; before++) {
    const start = lo - before;
    const end = start + total - 1;
    if (start >= 1 && end <= 13 && end >= hi) return true;
  }
  return false;
}

function scoreTiles(tiles: number[]) {
  return tiles.filter(t => !isJoker(t)).reduce((sum, t) => sum + tileNumber(t), 0);
}

function applySort(hand: number[], mode: SortMode) {
  if (mode === 'number') {
    return [...hand].sort((a, b) => {
      const na = isJoker(a) ? 99 : tileNumber(a);
      const nb = isJoker(b) ? 99 : tileNumber(b);
      return na !== nb ? na - nb : tileColor(a) - tileColor(b);
    });
  }
  if (mode === 'color') {
    return [...hand].sort((a, b) => {
      const ca = isJoker(a) ? 99 : tileColor(a);
      const cb = isJoker(b) ? 99 : tileColor(b);
      return ca !== cb ? ca - cb : tileNumber(a) - tileNumber(b);
    });
  }
  return [...hand];
}

function Tile({
  id,
  selected,
  dim,
  glowColor,
  dragging,
  dragOver,
  onClick,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  id: number;
  selected?: boolean;
  dim?: boolean;
  glowColor?: string;
  dragging?: boolean;
  dragOver?: boolean;
  onClick?: () => void;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
}) {
  const num = tileNumber(id);
  const col = tileColor(id);
  const bg = isJoker(id) ? '#3a3020' : (TILE_BG[col] ?? '#2a2a2e');
  const fg = isJoker(id) ? '#ffd700' : (TILE_FG[col] ?? '#d4d4d4');
  const borderColor = dragOver ? '#ffd700' : glowColor ? glowColor : selected ? '#ffffff' : '#55555588';

  return (
    <button
      draggable={!!onDragStart}
      onClick={onClick}
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.();
      }}
      onDragEnter={e => {
        e.preventDefault();
        onDragEnter?.();
      }}
      onDragOver={e => e.preventDefault()}
      onDragEnd={onDragEnd}
      title={isJoker(id) ? 'Joker' : `${COLOR_LABELS[col] ?? 'tile'} ${num}`}
      style={{
        width: 30,
        height: 38,
        borderRadius: 5,
        cursor: onClick ? 'pointer' : 'default',
        background: bg,
        color: fg,
        border: `2px solid ${borderColor}`,
        boxShadow: glowColor ? `0 0 10px ${glowColor}99`
          : selected ? '0 0 0 2px #ffffff55, 0 0 8px #ffffff66'
            : dragging ? '0 0 8px #ffd70066'
              : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 800,
        opacity: dim ? 0.45 : dragging ? 0.55 : 1,
        userSelect: 'none',
        flexShrink: 0,
        transition: 'border .1s, box-shadow .1s, opacity .1s',
      }}
    >
      {isJoker(id) ? 'J' : num}
    </button>
  );
}

export default function Rummikub({ studyState, secretState, myPlayerIndex, sessionId, sendMove }: Props) {
  const publicGame = studyState?.gameData as RummikubGameData | null | undefined;
  const privateGame = secretState?.studyType === 'RUMMIKUB'
    ? secretState.gameData as RummikubGameData | null | undefined
    : null;
  const game = publicGame;
  const myHand = privateGame?.hands?.[myPlayerIndex] ?? publicGame?.hands?.[myPlayerIndex] ?? [];
  const status = studyState?.status;

  const [draftTable, setDraftTable] = useState<number[][]>([]);
  const [draftHand, setDraftHand] = useState<number[]>([]);
  const [selectedHand, setSelectedHand] = useState<Set<number>>(new Set());
  const [floating, setFloating] = useState<number[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [hoverSet, setHoverSet] = useState<number | null>(null);

  const dragIdx = useRef<number>(-1);
  const dragOver = useRef<number>(-1);
  const [dragState, setDragState] = useState({ from: -1, over: -1 });

  useEffect(() => {
    setDraftTable(publicGame?.table ? publicGame.table.map(set => [...set]) : []);
    setDraftHand(applySort(myHand, sortMode));
    setSelectedHand(new Set());
    setFloating([]);
    setHoverSet(null);
    setDragState({ from: -1, over: -1 });
  }, [publicGame, privateGame, myPlayerIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const isMyTurn = game?.currentTurn === myPlayerIndex && status === 'PLAYING';
  const hasSelection = selectedHand.size > 0 || floating.length > 0;
  const selectedTiles = useMemo(() => [...selectedHand, ...floating], [selectedHand, floating]);
  const selectedScore = useMemo(() => scoreTiles(selectedTiles), [selectedTiles]);

  const hasPlayed = useMemo(() => {
    const serverTable = game?.table ?? [];
    return [...draftHand].sort((a, b) => a - b).join(',') !== [...myHand].sort((a, b) => a - b).join(',')
      || JSON.stringify(draftTable) !== JSON.stringify(serverTable);
  }, [draftHand, draftTable, game, myHand]);

  const invalidSets = useMemo(() => draftTable
    .map((set, index) => ({ index, invalid: set.length > 0 && !isValidSetClient(set) }))
    .filter(item => item.invalid)
    .map(item => item.index + 1), [draftTable]);

  const canSubmit = isMyTurn && hasPlayed && floating.length === 0 && invalidSets.length === 0;
  const canDraw = isMyTurn && !hasPlayed && floating.length === 0;

  function onHandDragStart(i: number) {
    dragIdx.current = i;
    dragOver.current = i;
    setDragState({ from: i, over: i });
  }

  function onHandDragEnter(i: number) {
    dragOver.current = i;
    setDragState(state => ({ ...state, over: i }));
  }

  function onHandDragEnd() {
    const from = dragIdx.current;
    const to = dragOver.current;
    if (from !== -1 && to !== -1 && from !== to) {
      setDraftHand(hand => {
        const next = [...hand];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
      setSortMode('manual');
    }
    dragIdx.current = -1;
    dragOver.current = -1;
    setDragState({ from: -1, over: -1 });
  }

  function sortHand(mode: SortMode) {
    setSortMode(mode);
    setDraftHand(hand => applySort(hand, mode));
  }

  function toggleHandTile(id: number) {
    if (!isMyTurn) return;
    setSelectedHand(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function pickFromTable(setIdx: number, tileIdx: number) {
    if (!isMyTurn) return;
    if (!game?.initialMeld?.[myPlayerIndex]) return;
    const tileId = draftTable[setIdx]?.[tileIdx];
    if (tileId == null) return;
    setDraftTable(table => table
      .map((set, index) => index === setIdx ? set.filter((_, idx) => idx !== tileIdx) : set)
      .filter(set => set.length > 0));
    setFloating(items => [...items, tileId]);
  }

  function placeIntoSet(setIdx: number) {
    if (!isMyTurn || selectedTiles.length === 0) return;
    setDraftTable(table => table.map((set, index) => index === setIdx ? [...set, ...selectedTiles] : set));
    setDraftHand(hand => hand.filter(id => !selectedHand.has(id)));
    setSelectedHand(new Set());
    setFloating([]);
    setHoverSet(null);
  }

  function placeAsNewSet() {
    if (!isMyTurn || selectedTiles.length === 0) return;
    setDraftTable(table => [...table, selectedTiles]);
    setDraftHand(hand => hand.filter(id => !selectedHand.has(id)));
    setSelectedHand(new Set());
    setFloating([]);
  }

  function handleDraw() {
    if (!canDraw) return;
    sendMove({ moveType: 'RUMMY_DRAW', data: '', sessionId });
  }

  function handleEndTurn() {
    if (!canSubmit) return;
    sendMove({ moveType: 'RUMMY_PLACE', data: '', sessionId, payload: draftTable });
  }

  function handleUndo() {
    setDraftTable(game?.table ? game.table.map(set => [...set]) : []);
    setDraftHand(applySort(myHand, sortMode));
    setSelectedHand(new Set());
    setFloating([]);
    setHoverSet(null);
  }

  if (!game) {
    return <div style={{ padding: 32, color: '#858585', textAlign: 'center' }}>Waiting for game data...</div>;
  }

  const message = studyState?.message ?? '';
  const currentName = studyState?.playerNames?.[game.currentTurn] ?? `P${game.currentTurn + 1}`;
  const mustInitialMeld = isMyTurn && !game.initialMeld?.[myPlayerIndex];
  const handCounts = game.handCounts ?? game.hands?.map(hand => hand.length) ?? [];

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: 'auto auto minmax(0, 1fr) auto auto',
      height: '100%',
      background: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'monospace',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '8px 12px',
        background: '#252526',
        borderBottom: '1px solid #3e3e42',
        flexWrap: 'wrap',
      }}>
        {Array.from({ length: game.numPlayers }).map((_, index) => {
          const isCurrent = game.currentTurn === index;
          const name = studyState?.playerNames?.[index] ?? `P${index + 1}`;
          const pc = P_COLORS[index % P_COLORS.length];
          return (
            <div key={index} style={{
              minWidth: 120,
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: 12,
              border: `1px solid ${isCurrent ? pc : '#3e3e42'}`,
              background: isCurrent ? '#2a2a2a' : 'transparent',
              color: pc,
              fontWeight: isCurrent ? 700 : 400,
              boxShadow: isCurrent ? `0 0 6px ${pc}66` : 'none',
            }}>
              {isCurrent ? '> ' : ''}{name}{index === myPlayerIndex ? ' (me)' : ''}
              <span style={{ color: '#858585', marginLeft: 8 }}>{handCounts[index] ?? 0} tiles</span>
              {game.initialMeld?.[index] && <span style={{ color: '#4ec9b0', marginLeft: 6 }}>open</span>}
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', color: '#858585', fontSize: 12, alignSelf: 'center' }}>
          Turn: {currentName} · Pool: {game.poolSize}
        </div>
      </div>

      <div style={{
        minHeight: 34,
        padding: '6px 12px',
        borderBottom: '1px solid #2f2f33',
        background: message.startsWith('ERROR:') ? '#3a2020' : '#202024',
        color: message.startsWith('ERROR:') ? '#f14c4c' : '#858585',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {game.winner >= 0
          ? `${studyState?.playerNames?.[game.winner] ?? `Player ${game.winner + 1}`} wins!`
          : message.startsWith('ERROR:')
            ? message
            : mustInitialMeld
              ? `First meld needs 30+ points from your hand. Selected: ${selectedScore}`
              : invalidSets.length > 0
                ? `Invalid set: #${invalidSets.join(', #')}`
                : hasSelection
                  ? `${selectedTiles.length} selected · ${selectedScore} points`
                  : 'Select tiles, then place them on a set or create a new set.'}
      </div>

      <div style={{
        minHeight: 0,
        overflowY: 'auto',
        padding: 8,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gridAutoRows: '78px',
        gap: 6,
        alignContent: 'start',
      }}>
        {draftTable.length === 0 && !hasSelection && (
          <div style={{
            minHeight: 78,
            border: '1px dashed #3e3e42',
            borderRadius: 6,
            color: '#858585',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
          }}>
            Table is empty.
          </div>
        )}

        {draftTable.map((set, setIdx) => {
          const valid = set.length > 0 && isValidSetClient(set);
          const previewValid = hasSelection ? isValidSetClient([...set, ...selectedTiles]) : valid;
          return (
            <div
              key={setIdx}
              onMouseEnter={() => setHoverSet(setIdx)}
              onMouseLeave={() => setHoverSet(null)}
              style={{
                minWidth: 0,
                height: 78,
                padding: 6,
                background: '#252526',
                borderRadius: 6,
                border: `1px solid ${!valid ? '#f14c4c88' : hoverSet === setIdx && hasSelection ? '#569cd6aa' : '#3e3e42'}`,
                display: 'grid',
                gridTemplateRows: '16px minmax(0, 1fr) 20px',
                gap: 3,
                boxShadow: hoverSet === setIdx && hasSelection ? '0 0 0 1px #569cd655' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <span style={{ color: '#858585' }}>Set #{setIdx + 1}</span>
                <span style={{ color: valid ? '#4ec9b0' : '#f14c4c' }}>{valid ? 'valid' : 'invalid'}</span>
                {hasSelection && (
                  <span style={{ color: previewValid ? '#4ec9b0' : '#ce9178', marginLeft: 'auto' }}>
                    preview {previewValid ? 'ok' : 'bad'}
                  </span>
                )}
              </div>

              <div style={{
                display: 'flex',
                gap: 3,
                overflowX: 'auto',
                overflowY: 'hidden',
                alignItems: 'center',
                paddingBottom: 2,
              }}>
                {set.map((tileId, tileIdx) => (
                  <Tile
                    key={`${setIdx}-${tileIdx}-${tileId}`}
                    id={tileId}
                    dim={!isMyTurn}
                    onClick={isMyTurn && game.initialMeld?.[myPlayerIndex] ? () => pickFromTable(setIdx, tileIdx) : undefined}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => placeIntoSet(setIdx)}
                  disabled={!isMyTurn || !hasSelection}
                  style={smallBtnStyle(!isMyTurn || !hasSelection, '#569cd6')}
                >
                  Place
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={placeAsNewSet}
          disabled={!isMyTurn || !hasSelection}
          style={{
            height: 78,
            borderRadius: 6,
            border: `1px dashed ${isMyTurn && hasSelection ? '#569cd6' : '#3e3e42'}`,
            color: isMyTurn && hasSelection ? '#569cd6' : '#858585',
            background: isMyTurn && hasSelection ? '#1a2a3a' : '#202024',
            cursor: isMyTurn && hasSelection ? 'pointer' : 'not-allowed',
            fontWeight: 700,
          }}
        >
          New set{hasSelection ? ` (${selectedTiles.length})` : ''}
        </button>
      </div>

      <div style={{
        height: 50,
        borderTop: '1px solid #3e3e42',
        background: floating.length > 0 ? '#252018' : '#202024',
        padding: '6px 12px',
        display: 'grid',
        gridTemplateColumns: '104px minmax(0, 1fr)',
        gap: 8,
        alignItems: 'center',
      }}>
        <div style={{ color: floating.length > 0 ? '#ffd700' : '#858585', fontSize: 11 }}>
          Floating {floating.length > 0 ? `(${floating.length})` : ''}
        </div>
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', minWidth: 0 }}>
          {floating.length === 0 && <span style={{ color: '#555', fontSize: 11 }}>None</span>}
          {floating.map((id, index) => <Tile key={`float-${index}-${id}`} id={id} glowColor="#ffd700" />)}
        </div>
      </div>

      <div style={{
        height: 164,
        borderTop: '1px solid #3e3e42',
        background: '#252526',
        padding: '8px 12px',
        display: 'grid',
        gridTemplateRows: '26px minmax(0, 1fr) 30px',
        gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#d4d4d4', fontWeight: 700 }}>My rack</span>
          <span style={{ fontSize: 11, color: '#858585' }}>{draftHand.length} tiles</span>
          {!isMyTurn && <span style={{ color: '#ce9178', fontSize: 11 }}>Waiting for turn</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button onClick={() => sortHand('manual')} style={activeSortBtnStyle('#858585', sortMode === 'manual')}>Manual</button>
            <button onClick={() => sortHand('number')} style={activeSortBtnStyle('#4ec9b0', sortMode === 'number')}>Number</button>
            <button onClick={() => sortHand('color')} style={activeSortBtnStyle('#c586c0', sortMode === 'color')}>Color</button>
          </div>
        </div>

        <div
          style={{
            minHeight: 0,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, 30px)',
            gridAutoRows: '38px',
            gap: 4,
            alignContent: 'start',
            padding: 2,
          }}
          onDragOver={e => e.preventDefault()}
        >
          {draftHand.map((id, index) => (
            <Tile
              key={`hand-${index}-${id}`}
              id={id}
              selected={selectedHand.has(id)}
              dragging={dragState.from === index}
              dragOver={dragState.over === index && dragState.from !== index}
              onClick={() => toggleHandTile(id)}
              onDragStart={() => onHandDragStart(index)}
              onDragEnter={() => onHandDragEnter(index)}
              onDragEnd={onHandDragEnd}
            />
          ))}
          {draftHand.length === 0 && <span style={{ color: '#858585', fontSize: 12 }}>No tiles.</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <button onClick={handleDraw} disabled={!canDraw} style={btnStyle(!canDraw, '#4ec9b0')}>Draw</button>
          <button onClick={handleEndTurn} disabled={!canSubmit} style={btnStyle(!canSubmit, '#569cd6')}>Submit turn</button>
          <button onClick={handleUndo} disabled={!isMyTurn} style={btnStyle(!isMyTurn, '#858585')}>Undo</button>
          <span style={{ color: '#858585', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {floating.length > 0
              ? 'Place floating tiles before submitting.'
              : invalidSets.length > 0
                ? `Fix invalid set #${invalidSets.join(', #')}.`
                : selectedHand.size > 0
                  ? `${selectedHand.size} selected.`
                  : 'Click tiles to select. Drag tiles to reorder your rack.'}
          </span>
        </div>
      </div>
    </div>
  );
}

function btnStyle(disabled: boolean, color: string): React.CSSProperties {
  return {
    padding: '6px 16px',
    fontSize: 12,
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#2a2a2a' : `${color}18`,
    border: `1px solid ${disabled ? '#3e3e42' : color}`,
    color: disabled ? '#858585' : color,
    transition: 'all .15s',
    flexShrink: 0,
  };
}

function smallBtnStyle(disabled: boolean, color: string): React.CSSProperties {
  return {
    padding: '3px 10px',
    fontSize: 11,
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#2a2a2a' : 'transparent',
    border: `1px solid ${disabled ? '#3e3e42' : color}`,
    color: disabled ? '#858585' : color,
    transition: 'all .15s',
    flexShrink: 0,
  };
}

function activeSortBtnStyle(color: string, active: boolean): React.CSSProperties {
  return {
    padding: '3px 8px',
    fontSize: 11,
    borderRadius: 4,
    cursor: 'pointer',
    background: active ? color : 'transparent',
    border: `1px solid ${color}`,
    color: active ? '#1e1e1e' : color,
    fontWeight: active ? 700 : 400,
    transition: 'all .15s',
    flexShrink: 0,
  };
}
