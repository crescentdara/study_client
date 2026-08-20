import { useEffect, useState } from 'react';

type Menu = { id: string; menu: string; nickname: string; votes: number; winner: boolean };
type Lunch = { date: string; menus: Menu[]; voterCount: number; myVoteMenuId?: string };

export default function LunchVote({ nickname, theme }: { nickname: string; theme: 'vscode' | 'excel' }) {
    const excel = theme === 'excel';
    const [data, setData] = useState<Lunch>({ date: '', menus: [], voterCount: 0 });
    const [menu, setMenu] = useState('');
    const [message, setMessage] = useState('');
    const load = async () => { try { const response = await fetch(`/api/lunch/today?nickname=${encodeURIComponent(nickname)}`); if (response.ok) setData(await response.json()); } catch { setMessage('점심 메뉴를 불러오지 못했습니다.'); } };
    useEffect(() => { void load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer); }, [nickname]);
    const request = async (url: string, body: Record<string, string>) => {
        if (!nickname.trim()) { setMessage('닉네임을 먼저 입력하세요.'); return; }
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname, ...body }) });
        const value = await response.json().catch(() => null);
        if (!response.ok) { setMessage(value?.message ?? '처리하지 못했습니다.'); return; }
        setData(value); setMessage(''); setMenu('');
    };
    const colors = excel ? { paper: '#fff', line: '#c9d8ca', head: '#e2f0d9', ink: '#18372a', accent: '#217346', mute: '#637568' } : { paper: '#1e2733', line: '#3a4655', head: '#252f3d', ink: '#dce8f4', accent: '#4ec9b0', mute: '#94a5b7' };
    if (!excel) return <section className="code-block" style={{ margin: '12px 0 0', borderRadius: 0, border: 'none', borderTop: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, color: colors.ink }}>
        <div className="c-line"><span className="ln">🍱</span><span className="c-line-body"><span className="kw">const </span><span className="var">todayLunch</span><span className="pct">: </span><span className="typ">LunchMenu</span><span className="pct">[] = [</span><span className="cmt">  // {data.date || 'today'} · {data.voterCount} votes</span></span></div>
        {data.menus.length === 0 ? <div className="c-line"><span className="ln">·</span><span className="c-line-body"><span className="cmt">// 메뉴를 한 줄 등록해 보세요.</span></span></div> : data.menus.map((item) => <div className="c-line" key={item.id}><span className="ln">{item.winner ? '👑' : '·'}</span><span className="c-line-body" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="pct">{'{ menu: '}</span><b className="str">"{item.menu}"</b><span className="pct">{', by: '}</span><span className="var">{item.nickname}</span><span className="pct">{', votes: '}</span><span className="num">{item.votes}</span><span className="pct">{' },'}</span><button type="button" onClick={() => void request('/api/lunch/votes', { menuId: item.id })} disabled={Boolean(data.myVoteMenuId)} className="btn-secondary" style={{ marginLeft: 4, padding: '1px 6px', fontSize: 10 }}>{data.myVoteMenuId === item.id ? 'voted' : 'vote()'}</button></span></div>)}
        <div className="c-line"><span className="ln">+</span><span className="c-line-body" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="pct">{'{ menu: "'}</span><input value={menu} onChange={(event) => setMenu(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void request('/api/lunch/menus', { menu }); }} maxLength={30} placeholder="메뉴 입력" style={{ width: 130, border: 'none', borderBottom: '1px solid #4ec9b0', background: 'transparent', color: '#ce9178', outline: 'none', font: 'inherit', fontSize: 12, padding: '1px 2px' }} /><span className="pct">{'" },'}</span><button type="button" onClick={() => void request('/api/lunch/menus', { menu })} className="btn-secondary" style={{ padding: '1px 6px', fontSize: 10 }}>register()</button></span></div>
        <div className="c-line"><span className="ln">·</span><span className="c-line-body"><span className="pct">]</span>{message && <span style={{ color: '#f44747', marginLeft: 8, fontSize: 11 }}>{message}</span>}</span></div>
    </section>;
    const cell = { minHeight: 29, display: 'flex', alignItems: 'center', padding: '0 7px', borderRight: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, fontSize: 12 };
    return <section style={{ margin: 0, borderTop: `1px solid ${colors.line}`, borderLeft: `1px solid ${colors.line}`, background: colors.paper, color: colors.ink }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#f3f8f1', borderRight: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, fontSize: 12 }}><b>🍱 오늘의 점심 투표표</b><span style={{ color: colors.mute }}>{data.date || '오늘'} · {data.voterCount}명 투표</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '30px minmax(110px,1fr) 84px 48px 54px' }}>
            {['순위', '메뉴', '등록자', '득표', '선택'].map((header) => <div key={header} style={{ ...cell, justifyContent: 'center', background: '#f2f7f0', fontWeight: 800 }}>{header}</div>)}
            {data.menus.length === 0 ? <div style={{ ...cell, gridColumn: 'span 5', color: colors.mute, justifyContent: 'center' }}>메뉴를 추천해 주세요.</div> : data.menus.map((item, index) => <div key={item.id} style={{ display: 'contents' }}><div style={{ ...cell, justifyContent: 'center' }}>{item.winner ? '👑' : index + 1}</div><div style={{ ...cell, fontWeight: item.winner ? 800 : 500 }}>{item.menu}</div><div style={{ ...cell, color: colors.mute }}>{item.nickname}</div><div style={{ ...cell, justifyContent: 'center', color: item.winner ? '#c78b18' : colors.accent, fontWeight: 800 }}>{item.votes}</div><div style={{ ...cell, justifyContent: 'center' }}><button type="button" onClick={() => void request('/api/lunch/votes', { menuId: item.id })} disabled={item.nickname.trim().toLowerCase() === nickname.trim().toLowerCase()} style={{ border: 'none', background: 'transparent', color: colors.accent, cursor: 'pointer', fontSize: 11 }}>투표</button></div></div>)}
            <div style={{ ...cell, justifyContent: 'center', background: '#f8fbf7' }}>＋</div><div style={{ ...cell, padding: 0 }}><input value={menu} onChange={(event) => setMenu(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void request('/api/lunch/menus', { menu }); }} maxLength={30} placeholder="새 메뉴 입력" style={{ width: '100%', border: 0, outline: 'none', padding: '6px 7px', color: colors.ink, background: '#fff', fontSize: 12 }} /></div><div style={{ ...cell, gridColumn: 'span 2', color: colors.mute }}>내 추천 메뉴</div><div style={{ ...cell, justifyContent: 'center' }}><button type="button" onClick={() => void request('/api/lunch/menus', { menu })} style={{ border: 'none', background: 'transparent', color: colors.accent, fontWeight: 800, cursor: 'pointer', fontSize: 11 }}>등록</button></div>
        </div>
        {message && <small style={{ display: 'block', padding: '5px 8px', color: '#d75a4a', borderRight: `1px solid ${colors.line}` }}>{message}</small>}
    </section>;
}
