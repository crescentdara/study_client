import { useEffect, useRef, useState } from 'react';
import {
  CatchMindGameData,
  CatchMindSecretData,
  CatchMindStroke,
  StudyMoveRequest,
  StudyStateResponse,
} from '../../types';

interface Props {
  studyState: StudyStateResponse | null;
  secretState: StudyStateResponse | null;
  sessionId: string;
  myPlayerIndex: number;
  sendMove: (req: StudyMoveRequest) => void;
}

const COLORS = ['#ffffff', '#ef4444', '#60a5fa', '#4ade80', '#facc15', '#c084fc'];
export default function CatchMind({ studyState, secretState, sessionId, myPlayerIndex, sendMove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draftRef = useRef<CatchMindStroke | null>(null);
  const data = studyState?.gameData as CatchMindGameData | null;
  const secret = secretState?.gameData as CatchMindSecretData | null;
  const isDrawer = data?.currentTurn === myPlayerIndex;
  const drawerName = studyState?.playerNames?.[data?.currentTurn ?? 0] ?? 'drawer';
  const secretWord = isDrawer && secret?.currentTurn === myPlayerIndex && secret?.round === data?.round
    ? secret.secretWord
    : '';
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(6);
  const [eraserOn, setEraserOn] = useState(false);
  const [guess, setGuess] = useState('');
  const [wordInput, setWordInput] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    (data?.strokes ?? []).forEach((stroke) => drawStroke(ctx, stroke));
  }, [data?.strokes]);

  useEffect(() => {
    setWordInput('');
    setGuess('');
  }, [data?.round, data?.currentTurn]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    ];
  };

  const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || studyState?.status !== 'PLAYING' || !data?.wordReady || data.roundSolved) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draftRef.current = { color: eraserOn ? '#000000' : color, width, points: [getPoint(event)] };
  };

  const moveStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const draft = draftRef.current;
    if (!draft || !isDrawer || data?.roundSolved) return;
    draft.points.push(getPoint(event));
    const ctx = event.currentTarget.getContext('2d');
    if (ctx) drawStroke(ctx, draft);
  };

  const finishStroke = () => {
    const draft = draftRef.current;
    if (!draft || draft.points.length < 2) {
      draftRef.current = null;
      return;
    }
    sendMove({ moveType: 'CATCHMIND_DRAW', data: '', sessionId, payload: draft });
    draftRef.current = null;
  };

  const submitGuess = () => {
    const text = guess.trim();
    if (!text || isDrawer || studyState?.status !== 'PLAYING' || !data?.wordReady || data.roundSolved) return;
    sendMove({ moveType: 'CATCHMIND_GUESS', data: text, sessionId });
    setGuess('');
  };

  const submitWord = () => {
    const text = wordInput.trim();
    if (!text || !isDrawer || data?.wordReady || studyState?.status !== 'PLAYING') return;
    sendMove({ moveType: 'CATCHMIND_SET_WORD', data: text, sessionId });
    setWordInput('');
  };

  const clearCanvas = () => {
    if (!isDrawer) return;
    sendMove({ moveType: 'CATCHMIND_CLEAR', data: '', sessionId });
  };

  const nextRound = () => {
    if (!isDrawer && myPlayerIndex !== 0) return;
    sendMove({ moveType: 'CATCHMIND_NEXT', data: '', sessionId });
  };

  if (!studyState || !data) {
    return (
      <div className="code-block">
        <CL ln={1}><span className="cmt">{'// CatchMind loading...'}</span></CL>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 12, alignItems: 'start' }}>
      <div className="code-block" style={{ minWidth: 0 }}>
        <CL ln={1}>
          <span className="kw">const </span><span className="var">round</span>
          <span className="pct"> = </span><span className="num">{data.round}</span>
          <span className="pct"> / </span><span className="num">{data.maxRounds}</span>
          <span className="dim">  // drawer: {drawerName}</span>
        </CL>
        <CL ln={2}>
          <span className="kw">const </span><span className="var">word</span>
          <span className="pct"> = </span>
          <span className={isDrawer || data.roundSolved ? 'str' : 'dim'}>
            "{data.roundSolved ? data.revealedWord : isDrawer ? secretWord || 'set_word_first' : data.wordReady ? data.maskedWord : 'waiting_for_word'}"
          </span>
        </CL>

        {isDrawer && !data.wordReady && studyState.status === 'PLAYING' && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 36px 0' }}>
            <input
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitWord()}
              placeholder="set word..."
              maxLength={30}
              style={{ width: 220, fontSize: 12 }}
            />
            <button className="btn-primary" onClick={submitWord} style={{ fontSize: 11 }}>
              setWord()
            </button>
          </div>
        )}

        <div style={{ padding: '8px 36px 12px', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={900}
            height={560}
            onPointerDown={startStroke}
            onPointerMove={moveStroke}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            style={{
              width: '100%',
              aspectRatio: '900 / 560',
              display: 'block',
              background: '#000',
              border: '1px solid #3e3e42',
              cursor: isDrawer && data.wordReady && !data.roundSolved ? 'crosshair' : 'default',
              touchAction: 'none',
            }}
          />
          {data.roundSolved && (
            <div style={{
              position: 'absolute',
              inset: '8px 36px 48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(74,222,128,0.7)',
            }}>
              <div style={{ textAlign: 'center', fontFamily: "'Consolas','Courier New',monospace" }}>
                <div style={{ color: '#4ade80', fontSize: 28, fontWeight: 700 }}>CORRECT</div>
                <div style={{ color: '#d4d4d4', fontSize: 14, marginTop: 6 }}>
                  {studyState.playerNames?.[data.solvedBy] ?? 'player'} guessed "{data.revealedWord}"
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                disabled={!isDrawer || !data.wordReady || data.roundSolved}
                onClick={() => {
                  setColor(c);
                  setEraserOn(false);
                }}
                title={c}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 3,
                  border: color === c ? '2px solid #dcdcaa' : '1px solid #3e3e42',
                  background: c,
                opacity: isDrawer && data.wordReady && !data.roundSolved ? 1 : 0.45,
                }}
              />
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#858585', fontSize: 11 }}>
              <span className="var">width</span>
              <input
                type="range"
                min={2}
                max={32}
                value={width}
                disabled={!isDrawer || !data.wordReady || data.roundSolved}
                onChange={(e) => setWidth(Number(e.target.value))}
                style={{ width: 110 }}
              />
              <span className="num" style={{ minWidth: 20 }}>{width}</span>
            </label>
            <button
              className={`btn-opt ${eraserOn ? 'on' : ''}`}
              disabled={!isDrawer || !data.wordReady || data.roundSolved}
              onClick={() => setEraserOn((value) => !value)}
              style={{ fontSize: 11 }}
            >
              eraser()
            </button>
            {[6, 14, 24].map((w) => (
              <button
                key={w}
                className={`btn-opt ${width === w ? 'on' : ''}`}
                disabled={!isDrawer || !data.wordReady || data.roundSolved}
                onClick={() => setWidth(w)}
                style={{ fontSize: 11, minWidth: 34 }}
              >
                {w}
              </button>
            ))}
            <button className="btn-secondary" disabled={!isDrawer || !data.wordReady || data.roundSolved} onClick={clearCanvas} style={{ fontSize: 11 }}>
              clear()
            </button>
            {(isDrawer || myPlayerIndex === 0) && (data.roundSolved || data.wordReady) && (
              <button className="btn-secondary" onClick={nextRound} style={{ fontSize: 11 }}>
                {data.roundSolved ? 'nextRound()' : 'skipRound()'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="code-block">
        <CL ln={1}>
          <span className="cmt">
            {studyState.status === 'FINISHED'
              ? '// game over'
              : data.roundSolved
                ? `// ${studyState.playerNames?.[data.solvedBy] ?? 'player'} got it`
                : isDrawer
                  ? data.wordReady ? '// draw the word' : '// set a word'
                  : data.wordReady ? '// guess the word' : '// waiting for drawer'}
          </span>
        </CL>
        {(studyState.playerNames ?? []).map((name, i) => (
          <CL ln={2 + i} key={name}>
            <span className={i === myPlayerIndex ? 'var' : 'dim'}>{i === myPlayerIndex ? 'me' : `p${i + 1}`}</span>
            <span className="pct">: </span><span className="str">"{name}"</span>
            <span className="dim"> score=</span><span className="num">{data.scores?.[i] ?? 0}</span>
            {data.currentTurn === i && <span className="typ"> drawing</span>}
            {studyState.winner === i && <span className="fn"> winner</span>}
          </CL>
        ))}
        <CL ln={8}>
          <span className="var">strokes</span><span className="pct">: </span>
          <span className="num">{data.strokes?.length ?? 0}</span>
        </CL>
        {!isDrawer && studyState.status === 'PLAYING' && data.wordReady && !data.roundSolved && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 0 8px 36px' }}>
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
              placeholder="answer..."
              maxLength={30}
              style={{ flex: 1, minWidth: 0, fontSize: 12 }}
            />
            <button className="btn-primary" onClick={submitGuess} style={{ fontSize: 11 }}>
              guess()
            </button>
          </div>
        )}
        <CL ln={9}><span className="var">recentGuesses</span><span className="pct"> = [</span></CL>
        <div style={{ padding: '2px 0 8px 36px', maxHeight: 180, overflow: 'auto' }}>
          {(data.recentGuesses ?? []).map((item, i) => (
            <div key={`${item}-${i}`} style={{ fontSize: 11, color: item.includes('solved') ? '#6a9955' : '#858585' }}>
              "{item}",
            </div>
          ))}
        </div>
        <CL ln={10}><span className="pct">]</span></CL>
      </div>
    </div>
  );
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: CatchMindStroke) {
  if (!stroke.points || stroke.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = stroke.color || '#111827';
  ctx.lineWidth = stroke.width || 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
  }
  ctx.stroke();
  ctx.restore();
}

function CL({ ln, children, indent = 0 }: { ln: number; children: React.ReactNode; indent?: number }) {
  return (
    <div className="c-line">
      <span className="ln">{ln}</span>
      <span className="c-line-body" style={{ paddingLeft: indent * 16 }}>{children}</span>
    </div>
  );
}
