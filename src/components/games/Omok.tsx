import { OmokGameData, StudyMoveRequest, StudyStateResponse } from '../../types';

interface Props {
  studyState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
  boardSize: number;
}

export default function Omok({ studyState, sessionId, myPlayerIndex, sendMove, boardSize }: Props) {
  const data = studyState?.gameData as OmokGameData | null;
  const size = data?.size ?? boardSize;
  const board = data?.board ?? Array.from({ length: size }, () => Array(size).fill(0));
  const isMyTurn = studyState?.status === 'PLAYING' && data?.currentTurn === myPlayerIndex;
  const activeName = studyState?.playerNames?.[data?.currentTurn ?? 0] ?? 'player';
  const winCells = new Set((data?.winPath ?? []).map(([r, c]) => `${r}-${c}`));

  const place = (row: number, col: number) => {
    if (!isMyTurn || board[row]?.[col] !== 0) return;
    sendMove({
      moveType: 'PLACE_STONE',
      data: `${row},${col}`,
      sessionId,
      payload: { row, col },
    });
  };

  if (!studyState || studyState.status === 'WAITING') {
    return (
      <div className="code-block">
        <CL ln={1}><span className="cmt">{'// OMOK waiting for players...'}</span></CL>
        <CL ln={2}>
          <span className="kw">const </span><span className="var">players</span>
          <span className="pct"> = [</span>
          {(studyState?.playerNames ?? []).map((name, i, arr) => (
            <span key={name}>
              <span className="str">"{name}"</span>
              {i < arr.length - 1 && <span className="pct">, </span>}
            </span>
          ))}
          <span className="pct">]</span>
        </CL>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 230px', gap: 12, alignItems: 'start' }}>
      <div className="code-block" style={{ overflow: 'auto' }}>
        <CL ln={1}>
          <span className="cmt">{'// OMOK grid'}</span>
        </CL>
        <CL ln={2}>
          <span className="kw">const </span><span className="var">omokBoard</span>
          <span className="pct"> = </span><span className="typ">board</span>
          <span className="pct">(</span><span className="num">{size}</span><span className="pct">)</span>
          <span className="dim">  // {data?.moveCount ?? 0} moves</span>
        </CL>

        <div className="omok-sheet">
          <div className="omok-sheet-head">
            <span><span className="var">active</span><span className="pct">: </span><span className="str">"{activeName}"</span></span>
            <span><span className="var">mode</span><span className="pct">: </span><span className="typ">OMOK</span></span>
            <span><span className="var">size</span><span className="pct">: </span><span className="num">{size}x{size}</span></span>
          </div>
          <div className="omok-board" style={{ gridTemplateColumns: `16px repeat(${size}, minmax(12px, 1fr))` }}>
            <div className="omok-axis" />
            {Array.from({ length: size }, (_, c) => (
              <div key={`h-${c}`} className="omok-axis">{String.fromCharCode(65 + c)}</div>
            ))}
            {board.map((row, r) => (
              <RowFragment key={r}>
                <div className="omok-axis">{String(r + 1).padStart(2, '0')}</div>
                {row.map((cell, c) => {
                  const occupied = cell > 0;
                  const last = data?.lastRow === r && data?.lastCol === c;
                  const win = winCells.has(`${r}-${c}`);
                  return (
                    <button
                      key={`${r}-${c}`}
                      className={[
                        'omok-cell',
                        r === 0 ? 'top-edge' : '',
                        r === size - 1 ? 'bottom-edge' : '',
                        c === 0 ? 'left-edge' : '',
                        c === size - 1 ? 'right-edge' : '',
                        occupied ? 'filled' : '',
                        cell === 1 ? 'p1' : cell === 2 ? 'p2' : '',
                        last ? 'last' : '',
                        win ? 'win' : '',
                      ].join(' ')}
                      disabled={!isMyTurn || occupied || studyState.status !== 'PLAYING'}
                      onClick={() => place(r, c)}
                      title={`R${r + 1} C${c + 1}`}
                    >
                      {occupied && <span>{cell === 1 ? 'A' : 'B'}</span>}
                    </button>
                  );
                })}
              </RowFragment>
            ))}
          </div>
          <div className="omok-legend">
            <span><i className="omok-dot p1" />P1</span>
            <span><i className="omok-dot p2" />P2</span>
            <span><i className="omok-dot last" />last</span>
          </div>
        </div>
      </div>

      <div className="code-block">
        <CL ln={1}><span className="cmt">{'// players'}</span></CL>
        {(studyState.playerNames ?? []).map((name, i) => {
          const active = data?.currentTurn === i && studyState.status === 'PLAYING';
          const winner = studyState.winner === i;
          return (
            <CL ln={2 + i} key={name}>
              <span className={i === myPlayerIndex ? 'var' : 'dim'}>{i === myPlayerIndex ? 'me' : `p${i + 1}`}</span>
              <span className="pct">: </span>
              <span className="str">"{name}"</span>
              <span className="dim"> </span>
              <span style={{ color: winner ? '#dcdcaa' : active ? '#4ec9b0' : '#555' }}>
                {winner ? 'winner' : active ? 'turn' : 'waiting'}
              </span>
            </CL>
          );
        })}
        <CL ln={5}>
          <span className="var">turn</span><span className="pct">: </span>
          <span className="str">"{studyState.status === 'PLAYING' ? activeName : 'finished'}"</span>
        </CL>
        <CL ln={6}>
          <span className="var">status</span><span className="pct">: </span>
          <span className={isMyTurn ? 'typ' : 'dim'}>{isMyTurn ? 'your_turn' : studyState.status.toLowerCase()}</span>
        </CL>
        <CL ln={7}>
          <span className="cmt">
            {studyState.status === 'FINISHED'
              ? '// game over; host can restart'
              : isMyTurn
                ? '// select an empty intersection'
                : '// opponent turn'}
          </span>
        </CL>
      </div>
    </div>
  );
}

function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function CL({ ln, children, indent = 0 }: { ln: number; children: React.ReactNode; indent?: number }) {
  return (
    <div className="c-line">
      <span className="ln">{ln}</span>
      <span className="c-line-body" style={{ paddingLeft: indent * 16 }}>{children}</span>
    </div>
  );
}
