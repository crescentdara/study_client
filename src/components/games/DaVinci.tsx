import { useEffect, useRef, useState } from 'react';
import { StudyStateResponse, DaVinciGameData, StudyMoveRequest } from '../../types';

// ─── Tile helpers ─────────────────────────────────────────────────────────────
// ID 0-11 = black 0-11, 12-23 = white 0-11, 24 = black joker, 25 = white joker
const tileNumber = (id: number) => id >= 24 ? -1 : id % 12;
const isJoker    = (id: number) => id >= 24;
// Visual color: joker takes on its own color (24=black, 25=white)
const jokerColor = (id: number): 'black' | 'white' => id === 24 ? 'black' : 'white';
const tileVisualColor = (id: number): 'black' | 'white' =>
  id < 12 ? 'black' : id < 24 ? 'white' : jokerColor(id);

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
`;

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
      {showNumber
        ? (isJoker(id) ? <span style={{ color: '#ffd700', fontSize: 18 }}>★</span> : num)
        : '?'}
      {showNumber && isJoker(id) && (
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
  myPlayerIndex: number;
  sessionId: string;
  sendMove: (req: StudyMoveRequest) => void;
}
interface Feedback { text: string; type: 'correct' | 'wrong' | 'error' | 'info'; }

// ─── Component ────────────────────────────────────────────────────────────────
export default function DaVinci({ studyState, myPlayerIndex, sessionId, sendMove }: Props) {
  const [guessingTarget, setGuessingTarget] = useState<{ p: number; pos: number } | null>(null);
  const [guessedNumber,  setGuessedNumber]  = useState<number | null>(null);
  const [feedback,       setFeedback]       = useState<Feedback | null>(null);
  const prevMsg  = useRef('');
  const fbTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!studyState) return;
    setGuessingTarget(null);
    setGuessedNumber(null);
    const msg = studyState.message ?? '';
    if (msg && msg !== prevMsg.current) {
      prevMsg.current = msg;
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

  if (!studyState) return <div style={{ color: '#858585', padding: 24 }}>대기 중…</div>;
  const gd = studyState.gameData as DaVinciGameData | null;
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

    return (
      <div key={pIdx} style={{ marginBottom: 14 }}>
        {/* Player label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ color: pColor, fontWeight: 700, fontSize: 13 }}>
            {studyState.playerNames?.[pIdx] ?? `P${pIdx + 1}`}
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
  return (
    <div style={{ fontFamily: 'monospace', color: '#d4d4d4', padding: 16, maxWidth: 740, margin: '0 auto' }}>
      <style>{ANIM_CSS}</style>

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
              {studyState.playerNames?.[currentTurn] ?? `P${currentTurn + 1}`}의 차례입니다…
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
