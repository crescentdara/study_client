import { useEffect, useState } from 'react';
import type { WorkspaceMode } from './workspace/WorkspaceModeSwitch';

type Announcement = { id: string; date: string; version: string; title: string; body: string };
type SuggestionStatus = 'OPEN' | 'RESOLVED' | 'DECLINED';
type Suggestion = { id: string; date: string; title: string; body: string; status?: SuggestionStatus; decisionDate?: string };
type Tab = 'notice' | 'write' | 'suggestions';

export default function AnnouncementCenter({ workspaceMode, nickname, unreadSuggestionCount, onSuggestionsSeen, onClose }: { workspaceMode: WorkspaceMode; nickname: string; unreadSuggestionCount: number; onSuggestionsSeen: (ids: string[]) => void; onClose: () => void }) {
    const excel = workspaceMode === 'excel';
    const [items, setItems] = useState<Announcement[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [noticeTitle, setNoticeTitle] = useState('');
    const [noticeBody, setNoticeBody] = useState('');
    const [suggestionTitle, setSuggestionTitle] = useState('');
    const [suggestionBody, setSuggestionBody] = useState('');
    const [tab, setTab] = useState<Tab>('notice');
    const owner = nickname.trim() === '뚱이';

    const load = async () => {
        const [announcementResponse, suggestionResponse] = await Promise.all([fetch('/api/announcements'), fetch('/api/suggestions')]);
        setItems(announcementResponse.ok ? await announcementResponse.json() : []);
        setSuggestions(suggestionResponse.ok ? await suggestionResponse.json() : []);
    };
    useEffect(() => { void load().catch(() => { setItems([]); setSuggestions([]); }); }, []);
    useEffect(() => { if (tab === 'suggestions' && suggestions.length > 0) onSuggestionsSeen(suggestions.map((suggestion) => suggestion.id)); }, [tab, suggestions, onSuggestionsSeen]);

    const colors = excel
        ? { bg: '#f7faf6', panel: '#ffffff', line: '#cbdacb', ink: '#18372a', muted: '#5e7566', accent: '#217346', input: '#ffffff', inputLine: '#86ae8f', soft: '#f8fbf7' }
        : { bg: '#1e1e1e', panel: '#252526', line: '#3e3e42', ink: '#d4d4d4', muted: '#a7a7a7', accent: '#4ec9b0', input: '#3c3c3c', inputLine: '#5a5a5a', soft: '#202124' };
    const tabStyle = (active: boolean) => ({ border: 0, borderBottom: active ? `2px solid ${colors.accent}` : '2px solid transparent', background: 'transparent', color: colors.ink, padding: '8px 12px', cursor: 'pointer', fontWeight: active ? 800 : 400 });
    const inputStyle = { width: '100%', boxSizing: 'border-box' as const, border: `1px solid ${colors.inputLine}`, borderRadius: 4, background: colors.input, color: colors.ink, padding: '10px 11px', font: 'inherit', outlineColor: colors.accent };
    const subtleButton = { border: `1px solid ${colors.line}`, borderRadius: 3, padding: '4px 7px', background: 'transparent', color: colors.muted, cursor: 'pointer', fontSize: 12 };
    const statusInfo = (status: SuggestionStatus | undefined) => status === 'RESOLVED' ? { label: '해결', color: colors.accent } : status === 'DECLINED' ? { label: '반려', color: '#d56a5d' } : { label: '접수', color: '#c6a36d' };

    const addNotice = async () => {
        const response = await fetch('/api/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname, title: noticeTitle, body: noticeBody }) });
        if (!response.ok) return;
        const item = await response.json() as Announcement;
        setItems((current) => [item, ...current]); setNoticeTitle(''); setNoticeBody(''); setTab('notice');
    };
    const removeNotice = async (id: string) => { const response = await fetch(`/api/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' }); if (response.ok) setItems((current) => current.filter((item) => item.id !== id)); };
    const addSuggestion = async () => {
        const response = await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: suggestionTitle, body: suggestionBody }) });
        if (!response.ok) return;
        const suggestion = await response.json() as Suggestion;
        setSuggestions((current) => [suggestion, ...current]); setSuggestionTitle(''); setSuggestionBody('');
    };
    const updateSuggestionStatus = async (id: string, status: 'RESOLVED' | 'DECLINED') => {
        const response = await fetch(`/api/suggestions/${encodeURIComponent(id)}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname, status }) });
        if (!response.ok) return;
        const updated = await response.json() as Suggestion;
        setSuggestions((current) => current.map((suggestion) => suggestion.id === id ? updated : suggestion));
    };
    const removeSuggestion = async (id: string) => { const response = await fetch(`/api/suggestions/${encodeURIComponent(id)}?nickname=${encodeURIComponent(nickname)}`, { method: 'DELETE' }); if (response.ok) setSuggestions((current) => current.filter((suggestion) => suggestion.id !== id)); };

    return <div style={{ height: '100%', overflow: 'auto', background: colors.bg, color: colors.ink, padding: excel ? 16 : 22 }}>
        <div style={{ maxWidth: 820, margin: '0 auto', border: `1px solid ${colors.line}`, background: colors.panel }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${colors.line}`, background: excel ? '#e2f0d9' : '#2d2d30' }}><b style={{ fontSize: 16 }}>{excel ? '공지 및 건의사항' : 'NOTICE CENTER'}</b><button type="button" onClick={onClose} style={{ ...subtleButton, background: colors.input }}>닫기</button></header>
            <nav style={{ borderBottom: `1px solid ${colors.line}` }}><button type="button" onClick={() => setTab('notice')} style={tabStyle(tab === 'notice')}>{excel ? '공지' : 'notice.md'}</button><button type="button" onClick={() => setTab('write')} style={tabStyle(tab === 'write')}>{excel ? '공지 등록' : 'write-notice.md'}</button><button type="button" onClick={() => setTab('suggestions')} style={{ ...tabStyle(tab === 'suggestions'), color: unreadSuggestionCount > 0 ? '#c6a36d' : colors.ink, fontWeight: tab === 'suggestions' ? 800 : 400 }}>{excel ? '건의사항' : 'suggestions.md'}</button></nav>
            {tab === 'write' && <div style={{ padding: 16, display: 'grid', gap: 10 }}><b>{excel ? '새 공지 작성' : '// create announcement'}</b><input className="announcement-input" value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="공지 제목을 입력하세요" style={inputStyle} /><textarea className="announcement-input" value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} placeholder="공지 내용을 입력하세요" rows={5} style={{ ...inputStyle, resize: 'vertical' }} /><button type="button" onClick={() => void addNotice()} disabled={!noticeTitle.trim() || !noticeBody.trim()} style={{ justifySelf: 'start', border: 0, borderRadius: 4, padding: '9px 13px', background: noticeTitle.trim() && noticeBody.trim() ? colors.accent : colors.line, color: '#ffffff', cursor: noticeTitle.trim() && noticeBody.trim() ? 'pointer' : 'not-allowed', fontWeight: 700 }}>공지 등록</button></div>}
            {tab === 'notice' && items.map((item, index) => <article key={item.id} style={{ padding: '15px 16px', borderBottom: index < items.length - 1 ? `1px solid ${colors.line}` : 0 }}><div style={{ display: 'flex', gap: 8 }}><b style={{ color: colors.accent }}>{item.version}</b><span style={{ color: colors.muted, fontSize: 12 }}>{item.date}</span>{index === 0 && <span style={{ fontSize: 10, background: '#e6a23c', color: '#ffffff', padding: '2px 5px', borderRadius: 3 }}>NEW</span>}</div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><h3 style={{ margin: '8px 0 5px', fontSize: 14 }}>{item.title}</h3><button type="button" onClick={() => void removeNotice(item.id)} style={{ ...subtleButton, flexShrink: 0 }}>삭제</button></div><p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: colors.muted }}>{item.body}</p></article>)}
            {tab === 'suggestions' && <div style={{ padding: 16, display: 'grid', gap: 14 }}>
                <section style={{ display: 'grid', gap: 8, padding: 12, border: `1px solid ${colors.line}`, background: colors.soft }}><b>{excel ? '익명 건의 등록' : '// anonymous suggestion'}</b><small style={{ color: colors.muted }}>작성자 정보는 저장되지 않으며 관리자도 확인할 수 없습니다.</small><input className="announcement-input" value={suggestionTitle} onChange={(event) => setSuggestionTitle(event.target.value)} placeholder="건의 제목을 입력하세요" style={inputStyle} /><textarea className="announcement-input" value={suggestionBody} onChange={(event) => setSuggestionBody(event.target.value)} placeholder="개선했으면 하는 점을 작성하세요" rows={3} style={{ ...inputStyle, resize: 'vertical' }} /><button type="button" onClick={() => void addSuggestion()} disabled={!suggestionTitle.trim() || !suggestionBody.trim()} style={{ justifySelf: 'start', border: 0, borderRadius: 4, padding: '8px 11px', background: suggestionTitle.trim() && suggestionBody.trim() ? colors.accent : colors.line, color: '#ffffff', cursor: suggestionTitle.trim() && suggestionBody.trim() ? 'pointer' : 'not-allowed', fontWeight: 700 }}>익명 건의 등록</button></section>
                {suggestions.length === 0 && <small style={{ color: colors.muted }}>등록된 건의사항이 없습니다.</small>}
                {suggestions.map((suggestion) => { const status = statusInfo(suggestion.status); return <article key={suggestion.id} style={{ padding: 13, border: `1px solid ${colors.line}` }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.muted, fontSize: 12 }}><span>{suggestion.date}</span><b style={{ color: status.color, fontWeight: 600 }}>{status.label}</b>{suggestion.decisionDate && <span>처리일 {suggestion.decisionDate}</span>}</div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><h3 style={{ margin: '8px 0 5px', fontSize: 14 }}>{suggestion.title}</h3>{owner && <button type="button" onClick={() => void removeSuggestion(suggestion.id)} style={subtleButton}>삭제</button>}</div><p style={{ margin: 0, whiteSpace: 'pre-wrap', color: colors.muted, fontSize: 13, lineHeight: 1.55 }}>{suggestion.body}</p>{owner && (suggestion.status ?? 'OPEN') === 'OPEN' && <div style={{ display: 'flex', gap: 7, marginTop: 12 }}><button type="button" onClick={() => void updateSuggestionStatus(suggestion.id, 'RESOLVED')} style={{ border: 0, borderRadius: 4, padding: '7px 10px', background: colors.accent, color: '#ffffff', cursor: 'pointer', fontWeight: 700 }}>해결</button><button type="button" onClick={() => void updateSuggestionStatus(suggestion.id, 'DECLINED')} style={{ border: '1px solid #d56a5d', borderRadius: 4, padding: '7px 10px', background: 'transparent', color: '#d56a5d', cursor: 'pointer' }}>반려</button></div>}</article>; })}
            </div>}
        </div>
    </div>;
}
