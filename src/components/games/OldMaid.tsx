import { useEffect, useRef, useState } from 'react';
import { StudyStateResponse, OldMaidGameData, OldMaidCard, StudyMoveRequest } from '../../types';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
const SUITS      = ['♠', '♥', '♦', '♣'] as const;
const RANK_LABEL = ['', 'A','2','3','4','5','6','7','8','9','10','J','Q','K'];

const rankOf  = (c: OldMaidCard) => c[0];
const suitOf  = (c: OldMaidCard) => c[1];
const isJoker = (c: OldMaidCard) => c[0] === 0;

function cardStr(c: OldMaidCard) {
  return isJoker(c) ? 'Jo🃏' : RANK_LABEL[rankOf(c)] + SUITS[suitOf(c)];
}
function cardColor(c: OldMaidCard) {
  if (isJoker(c)) return '#c084fc';
  if (suitOf(c) === 1 || suitOf(c) === 2) return '#f87171';
  return '#d4d4d4';
}
function isPair(a: OldMaidCard, b: OldMaidCard) {
  return rankOf(a) !== 0 && rankOf(a) === rankOf(b);
}

// ─── 애니메이션 CSS ───────────────────────────────────────────────────────────
const ANIM_CSS = `
@keyframes omShake {
  0%,100%{ transform:translateX(0); }
  20%    { transform:translateX(-7px) rotate(-2deg); }
  50%    { transform:translateX(7px)  rotate(2deg); }
  80%    { transform:translateX(-4px); }
}
@keyframes omPop {
  0%  { transform:scale(1); }
  40% { transform:scale(1.15); }
  100%{ transform:scale(1); }
}`;

// ─── 카드 칩 컴포넌트 ─────────────────────────────────────────────────────────
function CardChip({ card, selected, pairHint, onClick, disabled }: {
  card: OldMaidCard;
  selected?: boolean; pairHint?: boolean;
  onClick?: () => void; disabled?: boolean;
}) {
  const col = cardColor(card);
  return (
    <span
      onClick={!disabled ? onClick : undefined}
      title={cardStr(card)}
      style={{
        display: 'inline-flex', alignItems: 'center',
        fontFamily: 'monospace', fontSize: '10px',
        padding: '1px 5px', margin: '1px',
        color:      selected ? '#1e1e1e' : col,
        background: selected ? col : pairHint ? 'rgba(78,201,176,0.15)' : isJoker(card) ? 'rgba(192,132,252,0.08)' : 'transparent',
        border:     `1px solid ${selected ? col : pairHint ? '#4ec9b060' : col + '50'}`,
        borderRadius: '2px',
        cursor:     disabled ? 'default' : 'pointer',
        userSelect: 'none',
        animation:  selected ? 'omPop 0.2s ease-out' : undefined,
        transition: 'background 0.1s, color 0.1s',
        fontWeight: (selected || isJoker(card)) ? 'bold' : 'normal',
      }}
    >
      {cardStr(card)}
      {selected && <span style={{ marginLeft: '2px', fontSize: '8px' }}>✓</span>}
      {pairHint && <span style={{ marginLeft: '2px', color: '#4ec9b0', fontSize: '8px' }}>↩</span>}
    </span>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
interface OldMaidProps {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
}

export default function OldMaid({ studyState, sessionId, myPlayerIndex, sendMove }: OldMaidProps) {
  const game        = studyState?.gameData as OldMaidGameData | undefined;
  const playerNames = studyState?.playerNames ?? [];

  const [selected,        setSelected]        = useState<number[]>([]);
  const [discardErr,      setDiscardErr]       = useState('');
  const [shufflingSet,    setShufflingSet]     = useState<Set<number>>(new Set());
  const [hoveredDraw,     setHoveredDraw]      = useState<number | null>(null);
  const prevShuffle = useRef(-1);

  // CSS 주입
  useEffect(() => {
    if (!document.getElementById('om-anim')) {
      const s = document.createElement('style');
      s.id = 'om-anim'; s.textContent = ANIM_CSS;
      document.head.appendChild(s);
    }
  }, []);

  // 셔플 애니메이션
  useEffect(() => {
    if (!game) return;
    const ls = game.lastShuffle;
    if (ls !== -1 && ls !== prevShuffle.current) {
      prevShuffle.current = ls;
      setShufflingSet(p => new Set(p).add(ls));
      setTimeout(() => setShufflingSet(p => { const n = new Set(p); n.delete(ls); return n; }), 650);
    }
  }, [game?.lastShuffle]);

  // 상태 변경 시 선택 초기화
  useEffect(() => { setSelected([]); setDiscardErr(''); }, [studyState]);

  if (!game) return (
    <div className="code-block" style={{ padding: '8px 12px' }}>
      <span className="cmt">// initializing OldMaid...</span>
    </div>
  );

  const isDealing  = game.dealing;
  const isFinished = studyState?.status === 'FINISHED';
  const isMyTurn   = game.currentTurn === myPlayerIndex;
  const nextPlayer = game.nextActivePlayer;
  const myHand     = game.hands[myPlayerIndex] ?? [];
  const iAmSafe    = game.safe[myPlayerIndex];
  const canDiscard = selected.length === 2
    && selected[0] < myHand.length
    && selected[1] < myHand.length
    && isPair(myHand[selected[0]], myHand[selected[1]]);

  const handleDeal    = () => { if (isDealing && isMyTurn) sendMove({ moveType: 'DEAL_CARD',    data: '', sessionId }); };
  const handleDraw    = (i: number) => { if (!isDealing && isMyTurn && !isFinished) sendMove({ moveType: 'DRAW_CARD',    data: String(i), sessionId }); };
  const handleShuffle = () => { if (!isDealing && !isFinished && !iAmSafe)          sendMove({ moveType: 'SHUFFLE_HAND', data: '', sessionId }); };
  const handleEndTurn = () => { if (!isDealing && isMyTurn && !isFinished)          sendMove({ moveType: 'END_TURN',     data: '', sessionId }); };
  const handleDiscard = () => {
    if (selected.length !== 2) return;
    const [i1, i2] = selected;
    if (!isPair(myHand[i1], myHand[i2])) { setDiscardErr(`${cardStr(myHand[i1])} + ${cardStr(myHand[i2])} ≠ pair`); return; }
    sendMove({ moveType: 'DISCARD_PAIR', data: `${i1},${i2}`, sessionId });
  };
  const toggleSelect = (idx: number) => {
    setDiscardErr('');
    setSelected(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx)
      : prev.length >= 2  ? [prev[1], idx]
      : [...prev, idx]
    );
  };

  // ── 공통 스타일 ───────────────────────────────────────────────────────────
  const boxStyle: React.CSSProperties = {
    background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px',
    padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '2px',
  };
  const labelStyle: React.CSSProperties = { fontSize: '10px', color: '#569cd6', fontFamily: 'monospace' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', height: 'fit-content' }}>

      {/* ── 상단: 플레이어 현황 (한 줄 압축) ─────────────────────────────── */}
      <div style={{ ...boxStyle, flexDirection: 'row', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
        <span className="cmt" style={{ fontSize: '10px', marginRight: 2 }}>{'// players'}</span>
        {playerNames.map((name, i) => {
          const safe    = game.safe[i];
          const loser   = isFinished && game.loser === i;
          const current = !isFinished && game.currentTurn === i;
          const target  = !isDealing && !isFinished && isMyTurn && nextPlayer === i;
          const cnt     = game.handSizes[i];
          const shaking = shufflingSet.has(i);
          return (
            <span key={i}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                fontFamily: 'monospace', fontSize: '10px',
                padding: '1px 6px',
                background: current ? 'rgba(86,156,214,0.12)' : '#1e1e1e',
                border: `1px solid ${loser ? '#f14c4c' : current ? '#569cd6' : target ? '#4ec9b060' : '#3e3e42'}`,
                borderRadius: '2px',
                animation: shaking ? 'omShake 0.65s ease-in-out' : undefined,
              }}
            >
              <span className={i === myPlayerIndex ? 'kw' : 'var'}>{name}</span>
              {safe   && <span style={{ color: '#6a9955' }}>✓</span>}
              {loser  && <span style={{ color: '#f14c4c' }}>🃏</span>}
              {!safe && !loser && (
                <span style={{ color: cnt <= 2 ? '#ce9178' : '#858585' }}>{cnt}</span>
              )}
              {target && <span style={{ color: '#4ec9b0', fontSize: '8px' }}>▼</span>}
              {current && !isDealing && <span style={{ color: '#569cd6', fontSize: '8px' }}>●</span>}
            </span>
          );
        })}
        {isDealing && (
          <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '10px' }}>
            <span className="cmt">deck: </span><span className="num">{game.deckSize}</span>
          </span>
        )}
        {isFinished && game.loser >= 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#f14c4c', fontFamily: 'monospace' }}>
            🃏 {playerNames[game.loser]} THIEF
          </span>
        )}
        {/* 완료 버튼 */}
        {!isDealing && !isFinished && isMyTurn && (
          <button
            className="btn-primary"
            style={{ marginLeft: 'auto', fontSize: '10px', padding: '1px 10px' }}
            onClick={handleEndTurn}
          >
            완료 ▶
          </button>
        )}
      </div>

      {/* ── 메인 영역: 좌우 분할 ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px' }}>

        {/* ── 왼쪽: 내 손패 ───────────────────────────────────────────────── */}
        <div style={{ ...boxStyle, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={labelStyle}>
              <span className="kw">let </span>
              <span className="var">myHand</span>
              <span className="dim"> // {myHand.length}</span>
            </span>
            {!iAmSafe && !isFinished && !isDealing && (
              <button
                className="btn-secondary"
                style={{ fontSize: '15px', padding: '0px 5px', marginLeft: 'auto' }}
                onClick={handleShuffle}
                title="내 카드 순서를 섞습니다"
              >
                🔀
              </button>
            )}
          </div>

          {/* 카드 목록 */}
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {iAmSafe ? (
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6a9955' }}>✓ safe</span>
            ) : myHand.length === 0 ? (
              <span className="cmt" style={{ fontSize: '10px' }}>// no cards yet</span>
            ) : myHand.map((card, idx) => {
              const isSel     = selected.includes(idx);
              const wouldPair = selected.length === 1 && isPair(myHand[selected[0]], card) && !isSel;
              const canClick  = !isDealing && isMyTurn && !isFinished;
              return (
                <CardChip
                  key={idx} card={card}
                  selected={isSel} pairHint={wouldPair}
                  onClick={() => canClick && toggleSelect(idx)}
                  disabled={!canClick}
                />
              );
            })}
          </div>

          {/* 쌍 버리기 컨트롤 (내 턴에만) */}
          {!iAmSafe && !isDealing && !isFinished && isMyTurn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <button
                className={canDiscard ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '10px', padding: '1px 8px' }}
                onClick={handleDiscard}
                disabled={selected.length !== 2}
              >
                discard()
              </button>
              {selected.length === 2 && (
                <span style={{ fontSize: '10px', color: canDiscard ? '#6a9955' : '#f14c4c', fontFamily: 'monospace' }}>
                  {canDiscard
                    ? `✓ ${cardStr(myHand[selected[0]])}+${cardStr(myHand[selected[1]])}`
                    : `✗ ${discardErr || 'not a pair'}`}
                </span>
              )}
            </div>
          )}
          {/* 내 턴 아닐 때 안내 */}
          {!iAmSafe && !isDealing && !isFinished && !isMyTurn && myHand.length > 0 && (
            <span className="cmt" style={{ fontSize: '10px' }}>// 상대 턴 대기 중...</span>
          )}
        </div>

        {/* ── 오른쪽: 덱(배분) 또는 상대 패(플레이) ─────────────────────── */}
        <div style={{ ...boxStyle, width: '150px', flexShrink: 0 }}>

          {/* ──── 배분 단계 ──── */}
          {isDealing && (
            <>
              <span style={labelStyle}>
                <span className="fn">deck</span>
                <span className="dim"> // {game.deckSize}</span>
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                {Array.from({ length: Math.min(game.deckSize, 16) }).map((_, i) => (
                  <span key={i} style={{
                    display: 'inline-block', width: '10px', height: '14px',
                    background: isMyTurn && i === 0 ? 'rgba(86,156,214,0.3)' : '#1e1e1e',
                    border: `1px solid ${isMyTurn && i === 0 ? '#569cd6' : '#3e3e42'}`,
                    borderRadius: '1px',
                  }} />
                ))}
                {game.deckSize > 16 && (
                  <span className="dim" style={{ fontSize: '9px', alignSelf: 'center' }}>+{game.deckSize - 16}</span>
                )}
              </div>
              {isMyTurn ? (
                <button className="btn-primary" style={{ fontSize: '10px', padding: '1px 8px' }} onClick={handleDeal}>
                  ▶ draw()
                </button>
              ) : (
                <span className="cmt" style={{ fontSize: '9px' }}>
                  <span className="str">"{playerNames[game.currentTurn]}"</span> drawing...
                </span>
              )}
            </>
          )}

          {/* ──── 플레이 단계 ──── */}
          {!isDealing && !isFinished && (
            <>
              <span style={labelStyle}>
                {isMyTurn
                  ? <><span className="fn">draw</span><span className="pct">(</span><span className="str">"{playerNames[nextPlayer]}"</span><span className="pct">)</span></>
                  : <><span className="cmt">// </span><span className="str">"{playerNames[game.currentTurn]}"</span><span className="cmt">'s turn</span></>
                }
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', flex: 1 }}>
                {game.handSizes[nextPlayer] === 0
                  ? <span className="cmt" style={{ fontSize: '10px' }}>// empty</span>
                  : Array.from({ length: game.handSizes[nextPlayer] }).map((_, idx) => {
                      const hov = hoveredDraw === idx;
                      return (
                        <span key={idx}
                          onClick={() => handleDraw(idx)}
                          onMouseEnter={() => isMyTurn && setHoveredDraw(idx)}
                          onMouseLeave={() => setHoveredDraw(null)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '18px',
                            fontFamily: 'monospace', fontSize: '9px',
                            color:      hov ? '#1e1e1e' : '#569cd6',
                            background: hov ? '#569cd6' : 'rgba(86,156,214,0.08)',
                            border:     `1px solid ${hov ? '#569cd6' : '#569cd640'}`,
                            borderRadius: '2px',
                            cursor:     isMyTurn ? 'pointer' : 'default',
                            transform:  hov ? 'translateY(-2px)' : 'none',
                            transition: 'all 0.1s',
                            userSelect: 'none',
                          }}
                        >
                          {hov ? idx : '?'}
                        </span>
                      );
                    })
                }
              </div>
            </>
          )}

          {/* ──── 게임 종료 ──── */}
          {isFinished && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'center', flex: 1 }}>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#f14c4c' }}>throw OldMaidError</span>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', paddingLeft: 8 }}>
                <span className="str">"{game.loser >= 0 ? playerNames[game.loser] : '?'}"</span>
              </span>
              <span style={{ fontSize: '10px', color: game.loser === myPlayerIndex ? '#f14c4c' : '#6a9955', marginTop: 2 }}>
                {game.loser === myPlayerIndex ? '// 😱 you lose' : '// 🎉 you are safe'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
