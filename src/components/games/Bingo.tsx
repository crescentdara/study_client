import { useState } from 'react';
import { StudyStateResponse, BingoGameData, BingoBoard as BoardT, StudyMoveRequest } from '../../types';

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
  boardSize: number;
}

export default function Bingo({ studyState, sessionId, myPlayerIndex, sendMove, boardSize }: Props) {
  const data        = studyState?.gameData as BingoGameData | null;
  const size        = data?.size ?? boardSize;
  const numPlayers  = data?.numPlayers ?? 2;
  const winCount    = data?.winBingoCount ?? (size===3 ? 2 : 3);
  const isMyTurn    = data?.currentTurn === myPlayerIndex;
  const iSet        = data?.boardsSet?.[myPlayerIndex] ?? false;

  // ── SETUP 단계: 로컬 보드 상태 ──
  const [localBoard, setLocalBoard] = useState<string[][]>(
    () => Array.from({ length: boardSize }, () => Array(boardSize).fill(''))
  );
  const [callInput, setCallInput]   = useState('');
  const [err,       setErr]         = useState('');

  const updateCell = (r: number, c: number, val: string) => {
    setLocalBoard(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = val;
      return next;
    });
  };

  const submitBoard = () => {
    // 모든 셀이 입력됐는지 확인
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (!localBoard[r][c].trim()) { setErr('All cells must be filled.'); return; }
    setErr('');
    sendMove({ moveType: 'SET_BOARD', data: '', sessionId, payload: localBoard });
  };

  const callTopic = () => {
    const t = callInput.trim();
    if (!t) { setErr('Enter a topic to call.'); return; }
    setErr('');
    sendMove({ moveType: 'CALL_TOPIC', data: t, sessionId });
    setCallInput('');
  };

  // ── 대기 중 ──
  if (!studyState || studyState.status === 'WAITING') {
    return (
      <div className="code-block">
        <CL ln={1}><span className="cmt">{'// Waiting for players...'}</span></CL>
        <CL ln={2}>
          <span className="kw">const </span><span className="var">players</span><span className="pct"> = [</span>
          {(studyState?.playerNames ?? []).map((nm, i, arr) => (
            <span key={i}><span className="str">"{nm}"</span>{i<arr.length-1&&<span className="pct">, </span>}</span>
          ))}
          <span className="pct">]</span>
        </CL>
        <CL ln={3}><span className="cmt">{'// '}{studyState?.message}</span></CL>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* ── SETUP: 보드 주제 입력 ── */}
      {studyState.status === 'SETUP' && (
        <div className="code-block">
          <CL ln={1}><span className="cmt">{'// ◻ Bingo Setup — fill in your ' + size + '×' + size + ' board'}</span></CL>
          {iSet ? (
            <CL ln={2} indent={1}><span className="cmt">{'// ✓ Board submitted — waiting for others...'}</span></CL>
          ) : (
            <>
              <CL ln={2} indent={1}>
                <span className="cmt">{'// Enter a topic for each cell. All cells are required.'}</span>
              </CL>
              <div style={{ padding: '8px 36px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${size}, 1fr)`,
                  gap: '4px',
                }}>
                  {Array.from({ length: size }, (_, r) =>
                    Array.from({ length: size }, (_, c) => (
                      <input
                        key={`${r}-${c}`}
                        style={{
                          fontSize: '11px', padding: '4px', textAlign: 'center',
                          background: localBoard[r][c].trim() ? '#1a2a3a' : '#1a1a1a',
                          color: localBoard[r][c].trim() ? '#9cdcfe' : '#858585',
                          border: `1px solid ${localBoard[r][c].trim() ? '#569cd6' : '#3e3e42'}`,
                          borderRadius: '2px',
                        }}
                        placeholder={`(${r+1},${c+1})`}
                        value={localBoard[r][c]}
                        onChange={e => updateCell(r, c, e.target.value)}
                        maxLength={20}
                      />
                    ))
                  )}
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="dim" style={{ fontSize: 11 }}>
                    {localBoard.flat().filter(v => v.trim()).length}/{size*size} cells filled
                  </span>
                  <button className="btn-primary" style={{ fontSize: 11 }} onClick={submitBoard}>
                    .submitBoard() ▶
                  </button>
                  {err && <span style={{ color: '#f14c4c', fontSize: 11 }}>// {err}</span>}
                </div>
              </div>

              {/* 다른 플레이어 설정 완료 상태 */}
              <CL ln={3} indent={1}>
                <span className="dim">
                  {(studyState.playerNames ?? []).map((nm, i) => (
                    <span key={i} style={{ marginRight: 8 }}>
                      <span style={{ color: data?.boardsSet?.[i] ? '#6a9955' : '#555' }}>
                        {data?.boardsSet?.[i] ? '✓' : '○'} {nm}
                      </span>
                    </span>
                  ))}
                </span>
              </CL>
            </>
          )}
        </div>
      )}

      {/* ── PLAYING + FINISHED ── */}
      {(studyState.status === 'PLAYING' || studyState.status === 'FINISHED') && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>

          {/* 내 보드 */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 11, marginBottom: 6 }}>
              <span className="cmt">{'// '}</span>
              <span className="var">my board</span>
              <span className="dim"> · </span>
              <span className="num">{data?.bingoCounts?.[myPlayerIndex]??0}</span>
              <span className="dim">/{winCount} lines</span>
              {studyState.winner===myPlayerIndex && <span className="fn"> 🏆</span>}
            </div>
            {data?.boards?.[myPlayerIndex] && (
              <BingoGrid board={data.boards[myPlayerIndex]} size={size} mine />
            )}
          </div>

          {/* 컨트롤 + 호출 목록 */}
          <div className="code-block" style={{ minWidth: 180, flexShrink: 0 }}>
            <CL ln={1}>
              <span className="cmt">
                {'// ' + (studyState.status==='FINISHED'
                  ? 'game over'
                  : isMyTurn ? 'your turn — call a topic' : `${studyState.playerNames?.[data?.currentTurn??0]}'s turn`)}
              </span>
            </CL>

            {/* 플레이어 빙고 현황 */}
            {(studyState.playerNames??[]).map((nm, i) => (
              <CL ln={2+i} key={i}>
                <span style={{ color: studyState.winner===i?'#dcdcaa':data?.currentTurn===i&&studyState.status==='PLAYING'?'#4ec9b0':'#858585' }}>
                  {i===myPlayerIndex?'★ ':'  '}
                </span>
                <span className={i===myPlayerIndex?'var':'dim'}>{nm}</span>
                <span className="dim"> </span>
                <span className="num">{data?.bingoCounts?.[i]??0}</span>
                <span className="dim">/{winCount}</span>
                {studyState.winner===i && <span className="fn"> 🏆</span>}
                {data?.currentTurn===i && studyState.status==='PLAYING' && <span className="typ"> ←</span>}
              </CL>
            ))}

            {/* 호출 입력 */}
            {isMyTurn && studyState.status==='PLAYING' && (
              <CL ln={2+numPlayers} indent={1}>
                <span className="fn">call</span><span className="pct">(</span>
                <input style={{ width: 90, display: 'inline-block', fontSize: 12 }}
                  placeholder="topic..."
                  value={callInput}
                  onChange={e => setCallInput(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && callTopic()}
                  maxLength={30}
                />
                <span className="pct">)</span>
                <button className="btn-primary" style={{ marginLeft: 6, fontSize: 11 }}
                  onClick={callTopic}>▶</button>
                {err && <div style={{ color:'#f14c4c', fontSize:10, marginTop:2 }}>// {err}</div>}
              </CL>
            )}

            {/* 호출된 주제 목록 */}
            <CL ln={3+numPlayers}>
              <span className="var">called</span>
              <span className="dim"> ({data?.calledTopics?.length??0})</span>
            </CL>
            <div style={{ padding: '2px 0 4px 36px', display: 'flex', flexWrap: 'wrap', gap: '3px', maxHeight: 100, overflowY: 'auto' }}>
              {(data?.calledTopics??[]).map((t, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 6px',
                  background: '#1a2233', color: '#9cdcfe',
                  border: '1px solid #3e3e42', borderRadius: 2,
                }}>{t}</span>
              ))}
            </div>
          </div>

          {/* 상대방 보드들 */}
          {/* <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(studyState.playerNames??[]).map((nm, i) => {
              if (i===myPlayerIndex || !data?.boards?.[i]) return null;
              return (
                <div key={i}>
                  <div style={{ fontSize: 11, marginBottom: 4 }}>
                    <span className="cmt">{'// '}</span>
                    <span className="dim">{nm}</span>
                    <span className="dim"> · </span>
                    <span className="num">{data.bingoCounts?.[i]??0}</span>
                    <span className="dim">/{winCount}</span>
                    {studyState.winner===i && <span className="fn"> 🏆</span>}
                  </div>
                  <BingoGrid board={data.boards[i]} size={size} mine={false} small />
                </div>
              );
            })}
          </div> */}
        </div>
      )}
    </div>
  );
}

function BingoGrid({ board, size, mine, small=false }: {
  board: BoardT; size: number; mine: boolean; small?: boolean;
}) {
  const accent = mine ? '#4ec9b0' : '#569cd6';
  const fs     = small ? '9px' : '11px';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${size}, 1fr)`, gap: small?2:3 }}>
      {board.topics.map((row, r) =>
        row.map((topic, c) => {
          const marked = board.marked[r][c];
          return (
            <div key={`${r}-${c}`} style={{
              minWidth: small ? 40 : 60,
              minHeight: small ? 28 : 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '2px 3px',
              fontSize: fs, wordBreak: 'break-word', lineHeight: 1.2,
              fontWeight: marked ? 'bold' : 'normal',
              background: marked ? (mine ? '#1a3a2a' : '#1a2233') : '#1a1a1a',
              color: marked ? accent : '#444',
              border: `1px solid ${marked ? accent+'88' : '#3e3e42'}`,
              transition: 'all 0.15s',
            }}>
              {topic || ''}
            </div>
          );
        })
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
