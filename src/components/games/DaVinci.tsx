import { useEffect, useRef, useState } from 'react';
import { StudyStateResponse, DaVinciGameData, StudyMoveRequest } from '../../types';

// ─── Tile helpers ─────────────────────────────────────────────────────────────
// ID 0-11 = black 0-11, 12-23 = white 0-11, 24 = black joker, 25 = white joker
const tileNumber = (id: number) => id >= 24 ? -1 : id % 12;
const isJoker    = (id: number) => id >= 24;
const isHiddenTile = (id: number) => id === -2 || id === -3;
// Visual color: joker takes on its own color (24=black, 25=white)
const jokerColor = (id: number): 'black' | 'white' => id === 24 ? 'black' : 'white';
const tileVisualColor = (id: number): 'black' | 'white' =>
  id === -3 ? 'white' : id === -2 ? 'black' : id < 12 ? 'black' : id < 24 ? 'white' : jokerColor(id);

// Ascending-order sort key: (number*2 + color), black=0 < white=1
// Jokers return -1 (no fixed order)
const tileOrder = (id: number) => isJoker(id) ? -1 : tileNumber(id) * 2 + (id < 12 ? 0 : 1);

// Returns valid insert positions for pendingId into the current row
// Joker: all positions. Regular tile: positions that maintain ascending order
// (jokers in the row are skipped when checking neighbors)
function validInsertPositions(row: number[], pendingId: number): number[] {
  const positions: number[] = [];
  const total = row.length;
  if (isJoker(pendingId)) {
    for (let i = 0; i <= total; i++) positions.push(i);
    return positions;
  }
  const ord = tileOrder(pendingId);
  for (let pos = 0; pos <= total; pos++) {
    // find nearest non-joker to the left
    let leftOk = true;
    for (let i = pos - 1; i >= 0; i--) {
      if (!isJoker(row[i])) { leftOk = tileOrder(row[i]) <= ord; break; }
    }
    // find nearest non-joker to the right
    let rightOk = true;
    for (let i = pos; i < total; i++) {
      if (!isJoker(row[i])) { rightOk = tileOrder(row[i]) >= ord; break; }
    }
    if (leftOk && rightOk) positions.push(pos);
  }
  return positions;
}

const P_COLORS = ['#569cd6', '#4ec9b0', '#ce9178', '#c586c0', '#dcdcaa', '#9cdcfe'];

const ANIM_CSS = `
@keyframes dvPulse { 0%,100%{box-shadow:0 0 0 2px #ffd700;} 50%{box-shadow:0 0 0 5px #ffd70088;} }
@keyframes dvFlash { 0%{opacity:1;} 100%{opacity:0;} }
@keyframes dvExecutionIn { 0%{opacity:0;transform:scale(1.35);filter:blur(8px)} 18%{opacity:1;transform:scale(.96);filter:none} 28%{transform:scale(1.02)} 100%{transform:scale(1)} }
@keyframes dvVictimShake { 0%,100%{transform:translate(0)} 15%{transform:translate(-8px,3px)} 30%{transform:translate(7px,-4px)} 45%{transform:translate(-5px,-2px)} 60%{transform:translate(4px,3px)} }
@keyframes dvScanLine { from{transform:translateY(-20vh)} to{transform:translateY(110vh)} }
@keyframes dvShred { 0%{clip-path:inset(0)} 100%{clip-path:polygon(0 0,7% 100%,14% 0,21% 100%,28% 0,35% 100%,42% 0,49% 100%,56% 0,63% 100%,70% 0,77% 100%,84% 0,91% 100%,100% 0)} }
.dv-execution-overlay{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at center,#271010f5,#08090bf9 68%);font-family:Consolas,monospace;animation:dvExecutionIn .55s cubic-bezier(.15,.75,.2,1);pointer-events:auto}
.dv-execution-overlay::after{content:'';position:absolute;left:0;right:0;top:0;height:3px;background:#f14c4c;box-shadow:0 0 18px #f14c4c;animation:dvScanLine 1.15s linear infinite}
.dv-execution-overlay.victim{animation:dvExecutionIn .45s ease,dvVictimShake .55s .45s ease}
.dv-execution-card{width:min(620px,82vw);padding:34px;border:2px solid #f14c4c;background:#111418;box-shadow:0 0 0 1px #000,0 0 55px #f14c4c55;text-align:center}
.dv-execution-card small{color:#f14c4c;letter-spacing:.28em;font-weight:900}
.dv-execution-card h1{margin:13px 0 5px;color:#fff;font-size:clamp(30px,5vw,64px);line-height:1;text-shadow:4px 4px #8b1111}
.dv-execution-card code{display:block;color:#858585;font-size:13px}
.dv-execution-card blockquote{margin:24px 0 13px;padding:16px;border-left:4px solid #f14c4c;background:#f14c4c13;color:#ffd7d7;font-size:18px;font-weight:800}
.dv-execution-card strong{color:#dcdcaa;font-size:12px}
.dv-execution-overlay.shred .dv-execution-card{animation:dvShred 3.5s 1.1s steps(8,end) forwards}
.dv-finisher-picker{position:fixed;inset:0;z-index:1290;display:flex;align-items:center;justify-content:center;background:#08090bed;pointer-events:auto}
.dv-finisher-panel{width:min(720px,90vw);padding:24px;border:1px solid #f14c4c;background:#17191d;box-shadow:0 20px 70px #000}
.dv-finisher-panel>small{color:#f14c4c;letter-spacing:.22em;font-weight:900}
.dv-finisher-panel h2{margin:7px 0 18px;color:#fff;font-size:25px}
.dv-finisher-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dv-finisher-grid button{min-height:94px;padding:12px;border:1px solid #5b2b2e;background:#21191b;color:#ddd;text-align:left;cursor:pointer;transition:.15s}
.dv-finisher-grid button:hover{border-color:#f14c4c;background:#341b1e;transform:translateY(-2px);box-shadow:0 7px 20px #0008}
.dv-finisher-grid b{display:block;margin-bottom:7px;color:#f14c4c;font-size:15px}
.dv-finisher-grid span{font-size:12px;line-height:1.45}
`;

const FINISHERS = [
  { style: 'TERMINATE', label: '강제 종료', taunt: '숫자가 12개뿐인데 그걸 못 맞혀?' },
  { style: 'TRASH', label: '휴지통 삭제', taunt: '삭제 완료. 복구할 가치 없음.' },
  { style: 'SHRED', label: '파일 파쇄', taunt: '패를 숨긴 게 아니라 실력을 숨겼네.' },
  { style: 'ACCESS_DENIED', label: '접근 거부', taunt: '추리 능력이 최소 사양을 충족하지 못했습니다.' },
] as const;

interface ExecutionEffect {
  id: number;
  style: DaVinciGameData['executionStyle'];
  taunt: string;
  target: number;
  killer: number;
}

// ─── Tile component ───────────────────────────────────────────────────────────
interface TileProps {
  id: number;
  showNumber: boolean;   // true = show actual number/joker mark
  pulse?: boolean;
  dim?: boolean;
  selected?: boolean;
  clickable?: boolean;
  revealedMine?: boolean; // my own tile that's been revealed to opponents
  onClick?: () => void;
}
function Tile({ id, showNumber, pulse, dim, selected, clickable, revealedMine, onClick }: TileProps) {
  const vc    = tileVisualColor(id);
  const num   = tileNumber(id);
  const isBlack = vc === 'black';
  const numberVisible = showNumber && !isHiddenTile(id);

  const bg    = isBlack ? '#1c1c2a' : '#e8e8e4';
  const fg    = isBlack ? '#d4d4d4' : '#1a1a1a';
  const border = selected      ? '2px solid #ffd700'
               : pulse         ? '2px solid #ffd700'
               : revealedMine  ? '2px solid #f14c4c'
               : '1px solid #3e3e42';

  return (
    <div
      onClick={onClick}
      title={clickable ? 'Click to guess' : revealedMine ? '공개된 타일 (상대가 알고 있음)' : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 38, height: 52, borderRadius: 5,
        background: bg, color: fg,
        border,
        boxShadow: revealedMine ? '0 0 6px #f14c4c66' : undefined,
        fontSize: 15, fontWeight: 700,
        userSelect: 'none',
        cursor: clickable ? 'pointer' : 'default',
        opacity: dim ? 0.45 : 1,
        transition: 'transform .12s, box-shadow .12s',
        animation: pulse ? 'dvPulse .9s infinite' : undefined,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {numberVisible
        ? (isJoker(id) ? <span style={{ color: '#ffd700', fontSize: 18 }}>★</span> : num)
        : '?'}
      {numberVisible && isJoker(id) && (
        <span style={{ position: 'absolute', bottom: 2, fontSize: 8, color: isBlack ? '#888' : '#666' }}>
          {vc[0].toUpperCase()}
        </span>
      )}
      {revealedMine && (
        <span style={{
          position: 'absolute', top: 1, right: 2,
          fontSize: 8, color: '#f14c4c', fontWeight: 900, lineHeight: 1,
        }}>●</span>
      )}
    </div>
  );
}

// insert-position button — always visible, easy to click
function InsertSlot({ onClick, label }: { onClick: () => void; label: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        minWidth: 28, height: 52, borderRadius: 4, cursor: 'pointer',
        background: hov ? '#569cd633' : '#1a2a3a',
        border: `2px dashed ${hov ? '#569cd6' : '#3a5a7a'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s', flexShrink: 0,
        color: hov ? '#569cd6' : '#4a7a9a', fontSize: 16, fontWeight: 700,
        padding: '0 4px',
      }}
      title={`여기에 배치 (${label})`}
    >
      ↓
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  studyState: StudyStateResponse | null;
  secretState?: StudyStateResponse | null;
  myPlayerIndex: number;
  sessionId: string;
  sendMove: (req: StudyMoveRequest) => void;
}
interface Feedback { text: string; type: 'correct' | 'wrong' | 'error' | 'info'; }

// ─── Component ────────────────────────────────────────────────────────────────
export default function DaVinci({ studyState, secretState, myPlayerIndex, sessionId, sendMove }: Props) {
  const [guessingTarget, setGuessingTarget] = useState<{ p: number; pos: number } | null>(null);
  const [guessedNumber,  setGuessedNumber]  = useState<number | null>(null);
  const [feedback,       setFeedback]       = useState<Feedback | null>(null);
  const [executionEffect, setExecutionEffect] = useState<ExecutionEffect | null>(null);
  const prevMessageEventId = useRef(-1);
  const prevExecutionEventId = useRef(0);
  const fbTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!studyState) return;
    setGuessingTarget(null);
    setGuessedNumber(null);
    const msg = studyState.message ?? '';
    const eventId = (studyState.gameData as DaVinciGameData | null)?.messageEventId ?? 0;
    if (msg && eventId !== prevMessageEventId.current) {
      prevMessageEventId.current = eventId;
      let fb: Feedback;
      if (msg === 'CORRECT')          fb = { text: '정답!', type: 'correct' };
      else if (msg === 'WRONG')       fb = { text: '틀렸습니다! 뽑은 타일이 공개됩니다.', type: 'wrong' };
      else if (msg.startsWith('ERROR')) fb = { text: msg, type: 'error' };
      else                            fb = { text: msg, type: 'info' };
      setFeedback(fb);
      if (fbTimer.current) clearTimeout(fbTimer.current);
      fbTimer.current = setTimeout(() => setFeedback(null), 3000);
    }
  }, [studyState]);

  useEffect(() => {
    const game = studyState?.gameData as DaVinciGameData | null;
    if (!game || game.executionEventId <= prevExecutionEventId.current || !game.executionStyle) return;
    prevExecutionEventId.current = game.executionEventId;
    setExecutionEffect({
      id: game.executionEventId,
      style: game.executionStyle,
      taunt: game.executionTaunt,
      target: game.lastEliminatedPlayer,
      killer: game.lastEliminatorPlayer,
    });
    const timer = window.setTimeout(() => setExecutionEffect(null), 4_200);
    return () => window.clearTimeout(timer);
  }, [studyState]);

  if (!studyState) return <div style={{ color: '#858585', padding: 24 }}>대기 중…</div>;
  const publicGame = studyState.gameData as DaVinciGameData | null;
  const privateGame = secretState?.studyType === 'DAVINCI_CODE'
    ? secretState.gameData as DaVinciGameData | null
    : null;
  const gd = privateGame?.gameId === publicGame?.gameId ? privateGame : publicGame;
  if (!gd)  return <div style={{ color: '#858585', padding: 24 }}>게임 데이터 로딩 중…</div>;

  const { numPlayers, playerTiles, revealed, pendingTileId, drawnTileId,
          correctGuessesThisTurn, poolSize, winner } = gd;
  const currentTurn = gd.currentTurn;
  const isMyTurn    = currentTurn === myPlayerIndex;
  const hasPending  = pendingTileId !== -1;   // drew but not placed yet
  const hasDrawn    = drawnTileId   !== -1;   // placed this turn
  // guess phase: placed this turn OR pool is empty
  const canGuess    = hasDrawn || poolSize === 0;

  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleDraw = () => {
    sendMove({ moveType: 'DAVINCI_DRAW', data: '', sessionId });
  };
  const handlePlace = (position: number) => {
    sendMove({ moveType: 'DAVINCI_PLACE', data: String(position), sessionId, payload: { position } });
  };
  const handlePass = () => {
    sendMove({ moveType: 'DAVINCI_PASS', data: '', sessionId });
  };
  const handleFinisher = (style: typeof FINISHERS[number]['style'], tauntId: number) => {
    sendMove({
      moveType: 'DAVINCI_FINISHER', data: '', sessionId,
      payload: { style, tauntId },
    });
  };
  const handleConfirmGuess = () => {
    if (!guessingTarget || guessedNumber === null) return;
    sendMove({
      moveType: 'DAVINCI_GUESS', data: '', sessionId,
      payload: { targetPlayer: guessingTarget.p, targetPosition: guessingTarget.pos, guessedNumber },
    });
  };
  const handleTileClick = (pIdx: number, tPos: number) => {
    if (!isMyTurn || !canGuess || pIdx === myPlayerIndex) return;
    if (revealed[pIdx]?.[tPos]) return;
    setGuessingTarget({ p: pIdx, pos: tPos });
    setGuessedNumber(null);
  };

  // ─── Render helpers ───────────────────────────────────────────────────────
  const fbColor = feedback?.type === 'correct' ? '#6a9955'
                : feedback?.type === 'wrong'   ? '#f14c4c'
                : feedback?.type === 'error'   ? '#f14c4c'
                : '#569cd6';

  const renderPlayerRow = (pIdx: number) => {
    const tiles    = playerTiles[pIdx] ?? [];
    const revs     = revealed[pIdx]    ?? [];
    const isMine   = pIdx === myPlayerIndex;
    const isElim   = tiles.length > 0 && revs.every(Boolean);
    const pColor   = P_COLORS[pIdx % P_COLORS.length];
    const isCurrent = currentTurn === pIdx;
    const wasExecuted = gd.executionEventId > 0 && gd.lastEliminatedPlayer === pIdx;
    const displayName = studyState.playerNames?.[pIdx] ?? `P${pIdx + 1}`;

    return (
      <div key={pIdx} style={{ marginBottom: 14 }}>
        {/* Player label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ color: pColor, fontWeight: 700, fontSize: 13 }}>
            {wasExecuted ? `${displayName}.trash` : displayName}
            {isMine ? ' (나)' : ''}
          </span>
          {isCurrent && (
            <span style={{ background: pColor, color: '#1e1e1e', borderRadius: 3, padding: '1px 5px', fontSize: 11, fontWeight: 700 }}>
              TURN
            </span>
          )}
          {isElim && <span style={{ color: '#f14c4c', fontSize: 11 }}>탈락</span>}
          <span style={{ color: '#858585', fontSize: 11 }}>
            숨김 {tiles.length - revs.filter(Boolean).length} / 전체 {tiles.length}
          </span>
        </div>

        {/* Tile row */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {tiles.map((id, tPos) => {
            const isRev   = revs[tPos] ?? false;
            const showNum = isMine || isRev;
            const isSelected = guessingTarget?.p === pIdx && guessingTarget?.pos === tPos;
            const isDrawnHighlight = isMine && id === drawnTileId && !isRev;
            const clickable = isMyTurn && canGuess && !isMine && !isRev;
            return (
              <Tile
                key={tPos}
                id={id}
                showNumber={showNum}
                pulse={isDrawnHighlight}
                selected={isSelected}
                clickable={clickable}
                revealedMine={isMine && isRev}
                dim={isElim && isRev}
                onClick={() => clickable && handleTileClick(pIdx, tPos)}
              />
            );
          })}
          {tiles.length === 0 && <span style={{ color: '#858585', fontSize: 12 }}>타일 없음</span>}
        </div>
      </div>
    );
  };

  // ─── Phase: placement UI ─────────────────────────────────────────────────
  const renderPlacementPhase = () => {
    const myTiles = playerTiles[myPlayerIndex] ?? [];
    const vc      = tileVisualColor(pendingTileId);
    const isJk    = isJoker(pendingTileId);

    return (
      <div>
        <div style={{ color: '#d4d4d4', fontSize: 13, marginBottom: 10 }}>
          {isJk
            ? `${vc === 'black' ? '검은' : '흰'} 조커를 뽑았습니다. 원하는 위치에 배치하세요.`
            : `새 타일을 뽑았습니다. 원하는 위치에 배치하세요.`}
        </div>

        {/* Show pending tile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ color: '#858585', fontSize: 11 }}>뽑은 타일:</span>
          <Tile id={pendingTileId} showNumber={true} pulse />
        </div>

        {/* Current row with insert slots */}
        <div style={{ color: '#858585', fontSize: 11, marginBottom: 6 }}>
          ↓ 삽입할 위치를 클릭하세요
        </div>
        {(() => {
          const validPos = new Set(validInsertPositions(myTiles, pendingTileId));
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {validPos.has(0) && <InsertSlot onClick={() => handlePlace(0)} label="맨 앞" />}
              {myTiles.map((id, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tile id={id} showNumber={true} />
                  {validPos.has(i + 1) && (
                    <InsertSlot onClick={() => handlePlace(i + 1)} label={`${i + 1}번 뒤`} />
                  )}
                </div>
              ))}
              {validPos.size === 0 && (
                <span style={{ color: '#f14c4c', fontSize: 12 }}>배치 가능한 위치가 없습니다.</span>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // ─── Phase: guess UI ─────────────────────────────────────────────────────
  const renderGuessPhase = () => (
    <div>
      <div style={{ color: '#d4d4d4', fontSize: 12, marginBottom: 8 }}>
        {correctGuessesThisTurn === 0
          ? '상대 타일을 클릭해서 숫자를 맞추세요.'
          : `정답 ${correctGuessesThisTurn}개. 계속 맞히거나 패스하세요.`}
      </div>

      {guessingTarget ? (
        <div>
          <div style={{ color: '#858585', fontSize: 11, marginBottom: 6 }}>
            P{guessingTarget.p + 1}의 {guessingTarget.pos + 1}번째 타일 — 숫자 선택:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {Array.from({ length: 12 }, (_, n) => (
              <button key={n} onClick={() => setGuessedNumber(n)} style={{
                width: 34, height: 34, borderRadius: 4, fontSize: 13, fontWeight: 700,
                background: guessedNumber === n ? '#569cd6' : '#2a2a2e',
                color:      guessedNumber === n ? '#1e1e1e' : '#d4d4d4',
                border: guessedNumber === n ? 'none' : '1px solid #3e3e42',
                cursor: 'pointer',
              }}>{n}</button>
            ))}
            {/* Joker guess button — guessedNumber = -1 */}
            <button onClick={() => setGuessedNumber(-1)} style={{
              width: 44, height: 34, borderRadius: 4, fontSize: 14, fontWeight: 700,
              background: guessedNumber === -1 ? '#ffd700' : '#2a2a2e',
              color:      guessedNumber === -1 ? '#1e1e1e' : '#ffd700',
              border: guessedNumber === -1 ? 'none' : '1px solid #ffd70066',
              cursor: 'pointer',
            }}>★</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleConfirmGuess}
              disabled={guessedNumber === null}
              style={{
                background: guessedNumber !== null ? '#6a9955' : '#2a2a2e',
                color:      guessedNumber !== null ? '#fff' : '#858585',
                border: 'none', borderRadius: 4, padding: '6px 16px',
                fontSize: 13, fontWeight: 700,
                cursor: guessedNumber !== null ? 'pointer' : 'not-allowed',
              }}
            >추측 확인</button>
            <button onClick={() => { setGuessingTarget(null); setGuessedNumber(null); }} style={{
              background: '#2a2a2e', color: '#d4d4d4', border: '1px solid #3e3e42',
              borderRadius: 4, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
            }}>취소</button>
          </div>
        </div>
      ) : (
        correctGuessesThisTurn > 0 && (
          <button onClick={handlePass} style={{
            background: '#ce9178', color: '#1e1e1e', border: 'none',
            borderRadius: 4, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>패스 (뽑은 타일 숨김 유지)</button>
        )
      )}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  const myEliminated = (playerTiles[myPlayerIndex]?.length ?? 0) > 0
    && (revealed[myPlayerIndex] ?? []).every(Boolean);
  const chooseFinisher = gd.finisherPending && gd.lastEliminatorPlayer === myPlayerIndex;
  const executionTargetName = executionEffect
    ? studyState.playerNames?.[executionEffect.target] ?? `P${executionEffect.target + 1}`
    : '';
  const executionKillerName = executionEffect
    ? studyState.playerNames?.[executionEffect.killer] ?? `P${executionEffect.killer + 1}`
    : '';
  return (
    <div style={{ fontFamily: 'monospace', color: '#d4d4d4', padding: 16, maxWidth: 740, margin: '0 auto' }}>
      <style>{ANIM_CSS}</style>

      {chooseFinisher && (
        <div className="dv-finisher-picker" role="dialog" aria-modal="true">
          <section className="dv-finisher-panel">
            <small>FINAL TILE EXPOSED</small>
            <h2>{studyState.playerNames?.[gd.lastEliminatedPlayer] ?? '상대'} 처형 방식 선택</h2>
            <div className="dv-finisher-grid">
              {FINISHERS.map((finisher, index) => (
                <button key={finisher.style} onClick={() => handleFinisher(finisher.style, index)}>
                  <b>{finisher.label}</b><span>{finisher.taunt}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {executionEffect && (
        <div className={`dv-execution-overlay ${executionEffect.style.toLowerCase()} ${executionEffect.target === myPlayerIndex ? 'victim' : ''}`}>
          <section className="dv-execution-card">
            <small>PUBLIC EXECUTION // {executionEffect.style}</small>
            <h1>{executionTargetName}.trash</h1>
            <code>&gt; process terminated with exit code 0</code>
            <blockquote>“{executionEffect.taunt}”</blockquote>
            <strong>EXECUTED BY {executionKillerName}</strong>
          </section>
        </div>
      )}

      {/* Game over */}
      {winner >= 0 && (
        <div style={{ background: '#2a2010', border: '2px solid #ffd700', borderRadius: 8, padding: '16px 24px', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ color: '#ffd700', fontSize: 20, fontWeight: 700 }}>
            {winner === myPlayerIndex ? '🏆 승리!' : `${studyState.playerNames?.[winner] ?? `P${winner + 1}`} 승리!`}
          </div>
        </div>
      )}

      {/* Player status bar */}
      <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {Array.from({ length: numPlayers }, (_, i) => {
            const tiles   = playerTiles[i] ?? [];
            const revs    = revealed[i]    ?? [];
            const pColor  = P_COLORS[i % P_COLORS.length];
            const isCur   = currentTurn === i;
            return (
              <div key={i} style={{
                padding: '4px 8px', borderRadius: 4, fontSize: 12,
                background: isCur ? pColor + '22' : 'transparent',
                border: isCur ? `1px solid ${pColor}` : '1px solid transparent',
              }}>
                <span style={{ color: pColor, fontWeight: 700 }}>{studyState.playerNames?.[i] ?? `P${i + 1}`}</span>
                <span style={{ color: '#858585', marginLeft: 4 }}>
                  {tiles.length - revs.filter(Boolean).length}/{tiles.length}
                </span>
              </div>
            );
          })}
          <div style={{ marginLeft: 'auto', color: '#858585', fontSize: 12 }}>Pool: {poolSize}</div>
        </div>
      </div>

      {/* Opponents */}
      <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: 6, padding: 12, marginBottom: 8 }}>
        <div style={{ color: '#858585', fontSize: 11, marginBottom: 8 }}>상대 타일</div>
        {Array.from({ length: numPlayers }, (_, i) => i !== myPlayerIndex && renderPlayerRow(i))}
      </div>

      {/* My tiles */}
      <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: 6, padding: 12, marginBottom: 8 }}>
        <div style={{ color: '#858585', fontSize: 11, marginBottom: 8 }}>내 타일</div>
        {renderPlayerRow(myPlayerIndex)}
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          background: fbColor + '22', border: `1px solid ${fbColor}`,
          borderRadius: 5, padding: '6px 12px', marginBottom: 8,
          color: fbColor, fontWeight: 700, fontSize: 14,
          animation: 'dvFlash 3s forwards',
        }}>
          {feedback.text}
        </div>
      )}

      {/* Action panel */}
      {winner < 0 && (
        <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: 6, padding: 14 }}>
          {!isMyTurn ? (
            <div style={{ color: '#858585', fontSize: 13 }}>
              {myEliminated
                ? '처형 완료 · 관전 모드로 전환되었습니다.'
                : `${studyState.playerNames?.[currentTurn] ?? `P${currentTurn + 1}`}의 차례입니다…`}
            </div>
          ) : (
            <>
              {/* Phase 1: draw */}
              {!hasPending && !canGuess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={handleDraw}
                    disabled={poolSize === 0}
                    style={{
                      background: poolSize > 0 ? '#569cd6' : '#2a2a2e',
                      color:      poolSize > 0 ? '#1e1e1e' : '#858585',
                      border: 'none', borderRadius: 4, padding: '7px 20px',
                      fontSize: 13, fontWeight: 700,
                      cursor: poolSize > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >타일 뽑기</button>
                  {poolSize === 0 && (
                    <span style={{ color: '#858585', fontSize: 12 }}>풀이 비어있음 — 바로 추측 가능</span>
                  )}
                </div>
              )}

              {/* Phase 2: place */}
              {hasPending && renderPlacementPhase()}

              {/* Phase 3: guess */}
              {canGuess && !hasPending && renderGuessPhase()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
