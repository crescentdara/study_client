import { useState } from 'react';
import { StudyStateResponse, BaseballGameData, StudyMoveRequest, GuessResult } from '../../types';

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
  digits: number;
}

export default function Baseball({ studyState, sessionId, myPlayerIndex, sendMove, digits }: Props) {
  const [input, setInput] = useState('');
  const [err,   setErr]   = useState('');

  const data      = studyState?.gameData as BaseballGameData | null;
  const n         = data?.numPlayers ?? 2;
  const d         = data?.digits ?? digits;
  const isMyTurn  = data?.currentTurn === myPlayerIndex;
  const targetIdx = (myPlayerIndex + 1) % n;
  const targetName = studyState?.playerNames?.[targetIdx] ?? '?';
  const iSet      = data?.secretSet?.[myPlayerIndex] ?? false;

  const validate = (v: string) => {
    if (v.length !== d)                        { setErr(`Need ${d} digits.`); return false; }
    if (!/^[1-9]+$/.test(v))                   { setErr('Digits 1–9 only (no zero).'); return false; }
    if (new Set(v.split('')).size !== d)       { setErr('All digits must be unique.'); return false; }
    setErr(''); return true;
  };

  const submit = (type: 'SET_SECRET' | 'GUESS') => {
    if (!validate(input)) return;
    sendMove({ moveType: type, data: input, sessionId });
    setInput('');
  };

  if (!studyState || studyState.status === 'WAITING') {
    return (
      <div className="code-block">
        <CL ln={1}><span className="cmt">{'// Waiting for players...'}</span></CL>
        <CL ln={2}>
          <span className="kw">const </span><span className="var">players</span>
          <span className="pct"> = [</span>
          {(studyState?.playerNames ?? []).map((nm, i, arr) => (
            <span key={i}><span className="str">"{nm}"</span>{i < arr.length-1 && <span className="pct">, </span>}</span>
          ))}
          <span className="pct">]</span>
        </CL>
        <CL ln={3}><span className="cmt">{'// '}{studyState?.message}</span></CL>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* ── 플레이어 상태 ── */}
      <div className="code-block">
        <CL ln={1}><span className="cmt">{'// ⚾ Baseball · ' + d + '-digit · ' + n + ' players'}</span></CL>
        {(studyState.playerNames ?? []).map((name, i) => {
          const tgt     = studyState.playerNames?.[(i+1)%n] ?? '?';
          const isActive = data?.currentTurn === i && studyState.status === 'PLAYING';
          const isWinner = studyState.winner === i;
          return (
            <CL ln={2+i} key={i} indent={1}>
              <span style={{ color: isWinner ? '#dcdcaa' : isActive ? '#4ec9b0' : '#858585' }}>
                {i === myPlayerIndex ? '★ ' : '  '}
              </span>
              <span className={i===myPlayerIndex ? 'var' : 'dim'}>{name}</span>
              <span className="dim"> → </span>
              <span className="str">"{tgt}"</span>
              <span className="pct">  </span>
              <span style={{ color: isWinner ? '#dcdcaa' : isActive ? '#4ec9b0' : '#555' }}>
                {isWinner ? '🏆 winner' : isActive ? '← turn' : !data?.secretSet?.[i] ? 'setting...' : 'waiting'}
              </span>
            </CL>
          );
        })}
      </div>

      {/* ── SETUP: 비밀 숫자 설정 ── */}
      {studyState.status === 'SETUP' && (
        <div className="code-block">
          <CL ln={1}><span className="cmt">{'// Set your secret number (' + d + ' digits)'}</span></CL>
          {iSet ? (
            <CL ln={2} indent={1}><span className="cmt">{'// ✓ Secret set — waiting for others...'}</span></CL>
          ) : (
            <>
              <CL ln={2} indent={1}>
                <span className="cmt">{'// ' + d + '-digit, 1–9, no repeats — ' + targetName + ' will guess yours'}</span>
              </CL>
              <CL ln={3} indent={1}>
                <span className="kw">const </span><span className="var">secret</span><span className="pct"> = </span>
                <input style={{ width: 80, display: 'inline-block', letterSpacing: 3 }}
                  placeholder={'_'.repeat(d)} value={input}
                  onChange={e => setInput(e.target.value.replace(/\D/g,'').slice(0,d))}
                  maxLength={d} onKeyDown={e => e.key==='Enter' && submit('SET_SECRET')} />
                <button className="btn-primary" style={{ marginLeft: 8, fontSize: 11 }}
                  onClick={() => submit('SET_SECRET')}>.setSecret()</button>
                {err && <span style={{ marginLeft: 8, color: '#f14c4c', fontSize: 11 }}>// {err}</span>}
              </CL>
            </>
          )}
        </div>
      )}

      {/* ── PLAYING: 추측 + 히스토리 전체 표시 ── */}
      {studyState.status === 'PLAYING' && (
        <>
          {/* 추측 입력 */}
          <div className="code-block">
            <CL ln={1}>
              <span className="cmt">
                {'// ' + (isMyTurn ? `Your turn → guess "${targetName}"` : `${studyState.playerNames?.[data?.currentTurn??0]}'s turn`)}
              </span>
            </CL>
            {isMyTurn ? (
              <CL ln={2} indent={1}>
                <span className="kw">const </span><span className="var">guess</span><span className="pct"> = </span>
                <input style={{ width: 80, display: 'inline-block', letterSpacing: 3 }}
                  placeholder={'_'.repeat(d)} value={input}
                  onChange={e => setInput(e.target.value.replace(/\D/g,'').slice(0,d))}
                  maxLength={d} onKeyDown={e => e.key==='Enter' && submit('GUESS')} />
                <button className="btn-primary" style={{ marginLeft: 8, fontSize: 11 }}
                  onClick={() => submit('GUESS')}>.guess() ▶</button>
                {err && <span style={{ marginLeft: 8, color: '#f14c4c', fontSize: 11 }}>// {err}</span>}
              </CL>
            ) : (
              <CL ln={2} indent={1}><span className="cmt">{'// waiting...'}</span></CL>
            )}
          </div>

          {/* ── 전체 추측 기록 (모든 플레이어) ── */}
          <div className="code-block">
            <CL ln={1}><span className="cmt">{'// Guess history — all players'}</span></CL>
            <div style={{ display: 'flex', flexDirection: 'row',}}>
            {(studyState.playerNames ?? []).map((name, i) => {
              const tgt  = studyState.playerNames?.[(i+1)%n] ?? '?';
              const hist = data?.guessHistories?.[i] ?? [];
              const isMe = i === myPlayerIndex;
              return (
                <div key={i}>
                  {/* 플레이어 헤더 */}
                  <CL ln={2 + i * 10} indent={0}>
                    <span className={isMe ? 'var' : 'dim'}>{isMe ? '★ ' : '  '}{name}</span>
                    <span className="dim"> → </span>
                    <span className="str">"{tgt}"</span>
                    <span className="dim">  [{hist.length} guesses]</span>
                  </CL>

                  {/* 추측 목록 테이블 */}
                  {hist.length > 0 && (
                    <div style={{ padding: '2px 0 4px 36px' }}>
                      {/* 헤더 */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '80px 36px 36px auto',
                        fontSize: 11, color: '#4e4e4e', padding: '2px 0',
                        borderBottom: '1px solid #3e3e42',
                      }}>
                        <span>GUESS</span><span>S</span><span>B</span><span>RESULT</span>
                      </div>
                      {/* 행 */}
                      {hist.map((g: GuessResult, j: number) => (
                        <div key={j} style={{
                          display: 'grid', gridTemplateColumns: '80px 36px 36px auto',
                          fontSize: 12, padding: '2px 0',
                          borderBottom: '1px solid #2a2a2a',
                          background: j % 2 === 0 ? 'transparent' : '#ffffff04',
                        }}>
                          <span className="num" style={{ letterSpacing: 2 }}>{g.guess}</span>
                          <span style={{ color: g.strikes > 0 ? '#4ec9b0' : '#555' }}>{g.strikes}</span>
                          <span style={{ color: g.balls > 0 ? '#569cd6' : '#555' }}>{g.balls}</span>
                          <span style={{ color: g.strikes === d ? '#dcdcaa' : '#858585' }}>
                            {g.strikes === d ? '✓ CORRECT!' : `${g.strikes}S ${g.balls}B`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {hist.length === 0 && (
                    <CL ln={3 + i * 10} indent={2}>
                      <span className="cmt">{'// no guesses yet'}</span>
                    </CL>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </>
      )}

      {/* ── FINISHED ── */}
      {studyState.status === 'FINISHED' && (
        <div className="code-block">
          <CL ln={1}><span className="cmt">{'// Game over'}</span></CL>
          <CL ln={2}>
            <span className="kw">return </span>
            <span className="pct">{'{ '}</span>
            <span className="var">winner</span><span className="pct">: </span>
            <span className="str">"{studyState.winner !== -1 ? studyState.playerNames?.[studyState.winner] : 'none'}"</span>
            {data?.secrets && (
              <>
                <span className="pct">, </span>
                <span className="var">secrets</span><span className="pct">: [</span>
                {(studyState.playerNames ?? []).map((nm, i) => (
                  <span key={i}>
                    <span className="str">"{nm}:{data.secrets?.[i]}"</span>
                    {i < n-1 && <span className="pct">, </span>}
                  </span>
                ))}
                <span className="pct">]</span>
              </>
            )}
            <span className="pct">{' }'}</span>
            {studyState.winner === myPlayerIndex && <span className="cmt">  // 🏆 you win!</span>}
          </CL>
        </div>
      )}
    </div>
  );
}

function CL({ ln, children, indent=0 }: { ln: number; children: React.ReactNode; indent?: number }) {
  return (
    <div className="c-line">
      <span className="ln">{ln}</span>
      <span className="c-line-body" style={{ paddingLeft: indent*16 }}>{children}</span>
    </div>
  );
}
