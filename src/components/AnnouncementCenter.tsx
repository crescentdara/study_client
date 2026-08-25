import { useEffect, useState } from 'react';
import type { WorkspaceMode } from './workspace/WorkspaceModeSwitch';

type Announcement = { id: string; date: string; version: string; title: string; body: string };

export default function AnnouncementCenter({ workspaceMode, nickname, onClose }: { workspaceMode: WorkspaceMode; nickname: string; onClose: () => void }) {
    const excel = workspaceMode === 'excel';
    const [items, setItems] = useState<Announcement[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [tab, setTab] = useState<'list' | 'write'>('list');

    useEffect(() => {
        fetch('/api/announcements')
            .then((response) => response.ok ? response.json() : [])
            .then(setItems)
            .catch(() => setItems([]));
    }, []);

    const colors = excel
        ? { bg: '#f7faf6', panel: '#ffffff', line: '#cbdacb', ink: '#18372a', muted: '#5e7566', accent: '#217346', input: '#ffffff', inputLine: '#86ae8f' }
        : { bg: '#1e1e1e', panel: '#252526', line: '#3e3e42', ink: '#d4d4d4', muted: '#a7a7a7', accent: '#4ec9b0', input: '#3c3c3c', inputLine: '#5a5a5a' };
    const tabStyle = (active: boolean) => ({ border: 0, borderBottom: active ? `2px solid ${colors.accent}` : '2px solid transparent', background: 'transparent', color: colors.ink, padding: '8px 12px', cursor: 'pointer', fontWeight: active ? 800 : 400 });
    const inputStyle = { width: '100%', boxSizing: 'border-box' as const, border: `1px solid ${colors.inputLine}`, borderRadius: 4, background: colors.input, color: colors.ink, padding: '10px 11px', font: 'inherit', outlineColor: colors.accent };

    const add = async () => {
        const response = await fetch('/api/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, title, body }),
        });
        if (!response.ok) return;
        const item = await response.json();
        setItems((current) => [item, ...current]);
        setTitle('');
        setBody('');
        setTab('list');
    };

    const remove = async (id: string) => {
        const response = await fetch(`/api/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (response.ok) {
            setItems((current) => {
                const seen = current.map((item) => item.id);
                try {
                    const key = 'study.announcement.seenIds';
                    const stored = JSON.parse(localStorage.getItem(key) ?? '[]');
                    const previous = Array.isArray(stored) ? stored : [];
                    localStorage.setItem(key, JSON.stringify([...new Set([...previous, ...seen])].slice(-200)));
                } catch { /* deleting the announcement still succeeds without browser storage */ }
                return current.filter((item) => item.id !== id);
            });
        }
    };

    return (
        <div style={{ height: '100%', overflow: 'auto', background: colors.bg, color: colors.ink, padding: excel ? 16 : 22 }}>
            <div style={{ maxWidth: 820, margin: '0 auto', border: `1px solid ${colors.line}`, background: colors.panel }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${colors.line}`, background: excel ? '#e2f0d9' : '#2d2d30' }}>
                    <b style={{ fontSize: 16 }}>{excel ? '업데이트 내역' : 'UPDATES'}</b>
                    <button type="button" onClick={onClose} style={{ border: `1px solid ${colors.line}`, borderRadius: 3, padding: '5px 9px', background: colors.input, color: colors.ink, cursor: 'pointer' }}>닫기</button>
                </header>
                <nav style={{ borderBottom: `1px solid ${colors.line}` }}>
                    <button type="button" onClick={() => setTab('list')} style={tabStyle(tab === 'list')}>{excel ? '공지' : 'notice.md'}</button>
                    <button type="button" onClick={() => setTab('write')} style={tabStyle(tab === 'write')}>{excel ? '공지 등록' : 'write-notice.md'}</button>
                </nav>
                {tab === 'write' ? (
                    <div style={{ padding: 16, display: 'grid', gap: 10 }}>
                        <b>{excel ? '새 공지 작성' : '// create announcement'}</b>
                        <input className="announcement-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="공지 제목을 입력하세요" style={inputStyle} />
                        <textarea className="announcement-input" value={body} onChange={(event) => setBody(event.target.value)} placeholder="공지 내용을 입력하세요" rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                        <button type="button" onClick={() => void add()} disabled={!title.trim() || !body.trim()} style={{ justifySelf: 'start', border: 0, borderRadius: 4, padding: '9px 13px', background: title.trim() && body.trim() ? colors.accent : colors.line, color: '#ffffff', cursor: title.trim() && body.trim() ? 'pointer' : 'not-allowed', fontWeight: 700 }}>공지 등록</button>
                    </div>
                ) : (
                    items.map((item, index) => (
                        <article key={item.id} style={{ padding: '15px 16px', borderBottom: index < items.length - 1 ? `1px solid ${colors.line}` : 0 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <b style={{ color: colors.accent }}>{item.version}</b>
                                <span style={{ color: colors.muted, fontSize: 12 }}>{item.date}</span>
                                {index === 0 && <span style={{ fontSize: 10, background: '#e6a23c', color: '#ffffff', padding: '2px 5px', borderRadius: 3 }}>NEW</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <h3 style={{ margin: '8px 0 5px', fontSize: 14 }}>{item.title}</h3>
                                <button type="button" onClick={() => void remove(item.id)} style={{ flexShrink: 0, border: `1px solid ${colors.line}`, borderRadius: 3, padding: '4px 7px', background: 'transparent', color: colors.muted, cursor: 'pointer', fontSize: 12 }}>삭제</button>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: colors.muted }}>{item.body}</p>
                        </article>
                    ))
                )}
            </div>
        </div>
    );
}
