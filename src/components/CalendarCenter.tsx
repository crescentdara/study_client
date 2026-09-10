import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkspaceMode } from './workspace/WorkspaceModeSwitch';

type CalendarEvent = { id: string; date: string; title: string; time: string; color?: string; nickname: string };
type CalendarComment = { id: string; eventId: string; content: string; nickname: string; createdAt: string; updatedAt: string };
type CommentStatus = { eventId: string; count: string; latestCommentAt: string };
type EventPopover = { event: CalendarEvent; x: number; y: number };
const pad = (value: number) => String(value).padStart(2, '0');
const formatDate = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
const colorForNickname = (nickname: string) => {
    let hash = 0;
    for (const character of (nickname.trim() || '익명')) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return `hsl(${Math.abs(hash) % 360} 62% 52%)`;
};
const timeOrder = (time: string) => {
    const match = time.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    let hour = Number(match[1]);
    if (time.includes('오전') && hour === 12) hour = 0;
    if (time.includes('오후') && hour < 12) hour += 12;
    return hour * 60 + Number(match[2]);
};

function CalendarComments({ eventId, nickname, colors, composeRequested, onComposeRequestHandled }: { eventId: string; nickname: string; colors: { line: string; ink: string; muted: string; accent: string; soft: string }; composeRequested: boolean; onComposeRequestHandled: () => void }) {
    const [comments, setComments] = useState<CalendarComment[]>([]);
    const [content, setContent] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [composerOpen, setComposerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const loadComments = async () => {
        const response = await fetch(`/api/calendar-events/${encodeURIComponent(eventId)}/comments`);
        if (response.ok) setComments(await response.json());
    };
    useEffect(() => { void loadComments(); }, [eventId]);
    useEffect(() => {
        if (!composeRequested) return;
        setEditingId(null);
        setContent('');
        setComposerOpen(true);
        onComposeRequestHandled();
    }, [composeRequested, onComposeRequestHandled]);
    const submit = async () => {
        const value = content.trim();
        if (!value || saving) return;
        setSaving(true);
        setError('');
        try {
            const response = await fetch(
                editingId
                    ? `/api/calendar-events/${encodeURIComponent(eventId)}/comments/${encodeURIComponent(editingId)}`
                    : `/api/calendar-events/${encodeURIComponent(eventId)}/comments`,
                {
                    method: editingId ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editingId ? { content: value } : { content: value, nickname }),
                },
            );
            if (!response.ok) throw new Error(await response.text());
            setContent('');
            setEditingId(null);
            setComposerOpen(false);
            await loadComments();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '댓글을 저장하지 못했습니다.');
        } finally {
            setSaving(false);
        }
    };
    const remove = async (commentId: string) => {
        const response = await fetch(`/api/calendar-events/${encodeURIComponent(eventId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
        if (response.ok) {
            if (editingId === commentId) { setEditingId(null); setContent(''); setComposerOpen(false); }
            await loadComments();
        } else setError(await response.text() || '댓글을 삭제하지 못했습니다.');
    };
    return <section style={{ marginTop: 15, paddingTop: 12, borderTop: `1px solid ${colors.line}` }}>
        <div style={{ display: 'grid', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
            {comments.length === 0 && <small style={{ color: colors.muted }}>아직 댓글이 없습니다.</small>}
            {comments.map((comment) => {
                const isMine = nickname.trim() !== '' && comment.nickname === nickname.trim();
                return <article key={comment.id} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, padding: '4px 2px', borderBottom: `1px solid ${colors.line}` }}>
                    <b style={{ flex: '0 0 auto', color: colors.accent, fontSize: 11 }}>{comment.nickname || '익명'}</b>
                    {editingId === comment.id ? <><input aria-label="댓글 수정" autoFocus value={content} maxLength={500} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }} style={{ minWidth: 0, flex: 1, border: `1px solid ${colors.line}`, borderRadius: 3, background: 'transparent', color: colors.ink, padding: '3px 5px', fontSize: 12 }} /><span style={{ display: 'flex', flex: '0 0 auto', gap: 5 }}><button type="button" disabled={!content.trim() || saving} onClick={() => void submit()} style={{ padding: 0, border: 0, background: 'transparent', color: colors.accent, cursor: 'pointer', fontSize: 10 }}>저장</button><button type="button" onClick={() => { setEditingId(null); setContent(''); }} style={{ padding: 0, border: 0, background: 'transparent', color: colors.muted, cursor: 'pointer', fontSize: 10 }}>취소</button></span></> : <><span title={comment.content} style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `1px solid ${colors.line}`, paddingLeft: 6, fontSize: 12 }}>{comment.content}</span>{isMine && <span style={{ display: 'flex', flex: '0 0 auto', gap: 5 }}><button type="button" onClick={() => { setEditingId(comment.id); setContent(comment.content); setComposerOpen(false); }} style={{ padding: 0, border: 0, background: 'transparent', color: colors.accent, cursor: 'pointer', fontSize: 10 }}>수정</button><button type="button" onClick={() => void remove(comment.id)} style={{ padding: 0, border: 0, background: 'transparent', color: '#d9534f', cursor: 'pointer', fontSize: 10 }}>삭제</button></span>}</>}
                </article>;
            })}
        </div>
        {composerOpen && <><div style={{ display: 'flex', gap: 6, marginTop: 10 }}><input aria-label="댓글" autoFocus value={content} maxLength={500} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder={editingId ? '댓글 수정' : '댓글 작성'} style={{ minWidth: 0, flex: 1, border: `1px solid ${colors.line}`, borderRadius: 4, background: 'transparent', color: colors.ink, padding: '6px 7px', fontSize: 12 }} /><button type="button" disabled={!content.trim() || saving} onClick={() => void submit()} style={{ border: 0, borderRadius: 4, background: colors.accent, color: '#fff', cursor: saving ? 'wait' : 'pointer', padding: '6px 8px', fontSize: 11 }}>{editingId ? '수정' : '등록'}</button></div><button type="button" onClick={() => { setEditingId(null); setContent(''); setComposerOpen(false); }} style={{ marginTop: 6, padding: 0, border: 0, background: 'transparent', color: colors.muted, cursor: 'pointer', fontSize: 11 }}>취소</button></>}
        {error && <small style={{ display: 'block', marginTop: 6, color: '#d9534f' }}>{error}</small>}
    </section>;
}

const KOREAN_HOLIDAYS: Record<string, string> = {
    '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴', '2026-03-01': '삼일절', '2026-03-02': '삼일절 대체공휴일', '2026-05-01': '노동절', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날', '2026-05-25': '부처님오신날 대체공휴일', '2026-06-03': '전국동시지방선거', '2026-06-06': '현충일', '2026-07-17': '제헌절', '2026-08-15': '광복절', '2026-08-17': '광복절 대체공휴일', '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴', '2026-10-03': '개천절', '2026-10-05': '개천절 대체공휴일', '2026-10-09': '한글날', '2026-12-25': '기독탄신일',
    '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴', '2027-02-09': '설날 대체공휴일', '2027-03-01': '삼일절', '2027-05-01': '노동절', '2027-05-03': '노동절 대체공휴일', '2027-05-05': '어린이날', '2027-05-14': '부처님오신날', '2027-06-06': '현충일', '2027-07-17': '제헌절', '2027-08-15': '광복절', '2027-08-16': '광복절 대체공휴일', '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-03': '개천절', '2027-10-04': '개천절 대체공휴일', '2027-10-09': '한글날', '2027-12-25': '기독탄신일',
    '2028-01-01': '신정', '2028-01-26': '설날', '2028-01-27': '설날 연휴', '2028-01-28': '설날 연휴', '2028-03-01': '삼일절', '2028-04-12': '국회의원 선거', '2028-05-01': '노동절', '2028-05-02': '부처님오신날', '2028-05-05': '어린이날', '2028-06-06': '현충일', '2028-07-17': '제헌절', '2028-08-15': '광복절', '2028-10-02': '추석 연휴', '2028-10-03': '추석 · 개천절', '2028-10-04': '추석 연휴', '2028-10-05': '추석 대체공휴일', '2028-10-09': '한글날', '2028-12-25': '기독탄신일',
    '2029-01-01': '신정', '2029-02-12': '설날 연휴', '2029-02-13': '설날', '2029-02-14': '설날 연휴', '2029-03-01': '삼일절', '2029-05-01': '노동절', '2029-05-05': '어린이날', '2029-05-07': '어린이날 대체공휴일', '2029-05-20': '부처님오신날', '2029-05-21': '부처님오신날 대체공휴일', '2029-06-06': '현충일', '2029-07-17': '제헌절', '2029-08-15': '광복절', '2029-09-21': '추석 연휴', '2029-09-22': '추석', '2029-09-23': '추석 연휴', '2029-09-24': '추석 대체공휴일', '2029-10-03': '개천절', '2029-10-09': '한글날', '2029-12-25': '기독탄신일',
};

export default function CalendarCenter({ workspaceMode, nickname, onClose }: { workspaceMode: WorkspaceMode; nickname: string; onClose: () => void }) {
    const excel = workspaceMode === 'excel';
    const today = new Date();
    const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState(formatDate(today.getFullYear(), today.getMonth(), today.getDate()));
    const [dayPanelOpen, setDayPanelOpen] = useState(false);
    const [dayPanelPosition, setDayPanelPosition] = useState({ x: 22, y: 22 });
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [editing, setEditing] = useState<CalendarEvent | null>(null);
    const [eventPreview, setEventPreview] = useState<EventPopover | null>(null);
    const [commentComposerRequested, setCommentComposerRequested] = useState(false);
    const [commentStatuses, setCommentStatuses] = useState<Record<string, CommentStatus>>({});
    const [newCommentEventIds, setNewCommentEventIds] = useState<Set<string>>(new Set());
    const [title, setTitle] = useState('');
    const [period, setPeriod] = useState<'오전' | '오후'>('오전');
    const [hour, setHour] = useState('9');
    const [minute, setMinute] = useState('00');
    const colors = excel
        ? { bg: '#f7faf6', panel: '#ffffff', line: '#cbdacb', ink: '#18372a', muted: '#617566', accent: '#217346', soft: '#e2f0d9' }
        : { bg: '#1e1e1e', panel: '#252526', line: '#3e3e42', ink: '#d4d4d4', muted: '#a7a7a7', accent: '#4ec9b0', soft: '#2d3b38' };
    const load = async () => { const response = await fetch('/api/calendar-events'); if (response.ok) setEvents(await response.json()); };
    useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10000); return () => window.clearInterval(timer); }, []);
    const commentSeenKey = (eventId: string) => `study.calendar.lastSeenCommentAt.${nickname.trim() || 'anonymous'}.${eventId}`;
    const loadCommentStatuses = async () => {
        const response = await fetch('/api/calendar-events/comment-status');
        if (!response.ok) return;
        const statuses = await response.json() as CommentStatus[];
        const nextStatuses = Object.fromEntries(statuses.map((status) => [status.eventId, status]));
        setCommentStatuses(nextStatuses);
        setNewCommentEventIds(new Set(statuses.filter((status) => status.latestCommentAt && status.latestCommentAt > (localStorage.getItem(commentSeenKey(status.eventId)) ?? '')).map((status) => status.eventId)));
    };
    useEffect(() => { void loadCommentStatuses(); const timer = window.setInterval(() => void loadCommentStatuses(), 10000); return () => window.clearInterval(timer); }, [nickname]);
    const markCommentsSeen = (eventId: string) => {
        const latestCommentAt = commentStatuses[eventId]?.latestCommentAt;
        if (latestCommentAt) localStorage.setItem(commentSeenKey(eventId), latestCommentAt);
        setNewCommentEventIds((previous) => { const next = new Set(previous); next.delete(eventId); return next; });
    };
    useEffect(() => { setEventPreview(null); }, [selectedDate]);
    useEffect(() => { if (eventPreview) setDayPanelOpen(false); }, [eventPreview]);
    const eventsByDate = useMemo(() => {
        const grouped = events.reduce<Record<string, CalendarEvent[]>>((result, event) => { (result[event.date] ??= []).push(event); return result; }, {});
        Object.values(grouped).forEach((dailyEvents) => dailyEvents.sort((first, second) => timeOrder(first.time) - timeOrder(second.time)));
        return grouped;
    }, [events]);
    const selectedHoliday = KOREAN_HOLIDAYS[selectedDate];
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => index);
    const inputStyle = { width: '100%', boxSizing: 'border-box' as const, border: `1px solid ${colors.line}`, borderRadius: 4, background: excel ? '#ffffff' : '#3c3c3c', color: colors.ink, padding: '9px 10px', font: 'inherit' };
    const resetForm = () => { setEditing(null); setTitle(''); setPeriod('오전'); setHour('9'); setMinute('00'); };
    const getDayPanelPosition = (x: number, y: number) => ({ x: Math.max(10, Math.min(x, window.innerWidth - 394)), y: Math.max(10, Math.min(y, window.innerHeight - 520)) });
    const openDay = (date: string, rect: DOMRect) => { setEventPreview(null); setSelectedDate(date); resetForm(); setDayPanelPosition(getDayPanelPosition(rect.right + 8, rect.top)); setDayPanelOpen(true); };
    const save = async () => { if (!title.trim()) return; const time = `${period} ${hour}:${minute}`; const response = await fetch(editing ? `/api/calendar-events/${encodeURIComponent(editing.id)}` : '/api/calendar-events', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, title, time, nickname }) }); if (response.ok) { await load(); resetForm(); setDayPanelOpen(false); } };
    const beginEdit = (event: CalendarEvent) => { const match = event.time.match(/(\d{1,2}):(\d{2})/); const rawHour = match ? Number(match[1]) : 9; const isKoreanPeriod = event.time.includes('오후'); const is24Hour = !event.time.includes('오전') && !isKoreanPeriod; const nextPeriod = is24Hour ? (rawHour >= 12 ? '오후' : '오전') : (isKoreanPeriod ? '오후' : '오전'); const hour12 = is24Hour ? (rawHour % 12 || 12) : rawHour; setEditing(event); setTitle(event.title); setPeriod(nextPeriod); setHour(String(hour12)); setMinute(match && Number(match[2]) % 10 === 0 ? match[2] : '00'); };
    const remove = async (id: string) => { const response = await fetch(`/api/calendar-events/${encodeURIComponent(id)}`, { method: 'DELETE' }); if (response.ok) { await load(); if (editing?.id === id) resetForm(); } };
    const getPopoverPosition = (rect: DOMRect) => {
        const maxHeight = Math.min(620, window.innerHeight - 20);
        return {
            x: Math.max(10, Math.min(rect.right + 8, window.innerWidth - 374)),
            y: Math.max(10, Math.min(rect.top, window.innerHeight - maxHeight - 10)),
        };
    };
    const moveMonth = (amount: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));

    return <div style={{ height: '100%', overflow: 'auto', background: colors.bg, color: colors.ink, padding: excel ? 16 : 22 }}>
        <div style={{ width: '100%', margin: '0 auto', border: `1px solid ${colors.line}`, background: colors.panel }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${colors.line}`, background: excel ? '#e2f0d9' : '#2d2d30' }}><b style={{ fontSize: 16 }}>{excel ? '공유 일정' : 'SHARED CALENDAR'}</b><button type="button" onClick={onClose} style={{ border: `1px solid ${colors.line}`, borderRadius: 3, padding: '5px 9px', background: 'transparent', color: colors.ink, cursor: 'pointer' }}>닫기</button></header>
            <section style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><button type="button" onClick={() => moveMonth(-1)} style={{ border: `1px solid ${colors.line}`, background: 'transparent', color: colors.ink, cursor: 'pointer', padding: '5px 11px' }}>‹</button><b style={{ fontSize: 20 }}>{month.getFullYear()}년 {month.getMonth() + 1}월</b><button type="button" onClick={() => moveMonth(1)} style={{ border: `1px solid ${colors.line}`, background: 'transparent', color: colors.ink, cursor: 'pointer', padding: '5px 11px' }}>›</button></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderTop: `1px solid ${colors.line}`, borderLeft: `1px solid ${colors.line}` }}>
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => <div key={day} style={{ padding: 9, textAlign: 'center', borderRight: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, color: index === 0 ? '#d9534f' : index === 6 ? '#4d89c5' : colors.muted, fontSize: 12, fontWeight: 700 }}>{day}</div>)}
                    {cells.map((_, index) => {
                        const cellDate = new Date(month.getFullYear(), month.getMonth(), index - firstDay + 1); const date = formatDate(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate()); const day = cellDate.getDate(); const isCurrentMonth = cellDate.getMonth() === month.getMonth(); const holiday = KOREAN_HOLIDAYS[date]; const weekday = index % 7; const dayColor = holiday ? '#d9534f' : weekday === 0 ? '#d9534f' : weekday === 6 ? '#4d89c5' : colors.ink; const isToday = date === formatDate(today.getFullYear(), today.getMonth(), today.getDate()); const isSelected = date === selectedDate;
                        return <div key={index} role="button" tabIndex={0} onClick={() => { setSelectedDate(date); setDayPanelOpen(false); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { setSelectedDate(date); setDayPanelOpen(false); } }} style={{ position: 'relative', minHeight: 88, overflow: 'visible', textAlign: 'left', borderRight: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, padding: 8, background: isSelected ? colors.soft : 'transparent', color: dayColor, cursor: 'default', outline: 'none' }}><span style={{ position: 'absolute', top: 8, left: 8, display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 12, background: isToday ? (holiday ? '#d9534f' : colors.accent) : 'transparent', color: isToday ? '#ffffff' : dayColor, fontSize: 13, opacity: isCurrentMonth ? 1 : .42 }}>{day}</span>{isSelected && <button type="button" aria-label="일정 등록" title="일정 등록" onClick={(event) => { event.stopPropagation(); openDay(date, event.currentTarget.getBoundingClientRect()); }} style={{ position: 'absolute', top: 9, right: 9, width: 16, height: 16, border: `1px solid ${colors.line}`, borderRadius: '50%', padding: 0, background: 'transparent', color: colors.accent, cursor: 'pointer', fontSize: 14, fontWeight: 700, lineHeight: '12px' }}>+</button>}{holiday && <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 29, color: '#d9534f', fontSize: 11, fontWeight: 700, opacity: isCurrentMonth ? 1 : .42 }}>{holiday}</span>}{(eventsByDate[date] ?? []).map((event, eventIndex) => { const hasNewComment = newCommentEventIds.has(event.id); return <button key={event.id} type="button" title={hasNewComment ? '새 댓글이 있습니다' : '클릭하여 일정 상세 보기'} onClick={(mouseEvent) => { mouseEvent.stopPropagation(); markCommentsSeen(event.id); setEventPreview({ event, ...getPopoverPosition(mouseEvent.currentTarget.getBoundingClientRect()) }); }} style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', boxSizing: 'border-box', overflow: 'hidden', marginTop: holiday || eventIndex > 0 ? 4 : 29, padding: '3px 0', border: 0, background: 'transparent', color: colors.ink, fontSize: 11, textAlign: 'left', cursor: 'pointer', opacity: isCurrentMonth ? 1 : .42, fontWeight: 500 }}><span aria-label={hasNewComment ? '새 댓글' : undefined} style={{ flex: '0 0 auto', width: 7, height: 7, borderRadius: '50%', background: colorForNickname(event.nickname), animation: hasNewComment ? 'calendar-comment-unread-pulse 1.1s ease-in-out infinite' : undefined }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.time ? `${event.time} ` : ''}{event.title} ›</span></button>; })}</div>;
                    })}
                </div>
                <small style={{ display: 'block', marginTop: 10, color: colors.muted }}>날짜를 선택한 뒤 우측 상단의 + 버튼을 눌러 공유 일정을 등록하거나 관리할 수 있습니다.</small>
            </section>
        </div>
        {dayPanelOpen && !eventPreview && createPortal(<div style={{ position: 'fixed', left: dayPanelPosition.x, top: dayPanelPosition.y, zIndex: 10050, width: 'min(380px, calc(100vw - 20px))', maxHeight: 'min(500px, calc(100vh - 20px))', overflow: 'auto', border: `1px solid ${colors.line}`, borderRadius: 8, background: colors.panel, color: colors.ink, boxShadow: '0 16px 38px rgba(0,0,0,.35)' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: excel ? '#e2f0d9' : '#303034', borderBottom: `1px solid ${colors.line}` }}><div><b>{selectedDate}</b>{selectedHoliday && <small style={{ display: 'block', color: '#d9534f', marginTop: 2 }}>{selectedHoliday}</small>}</div><button type="button" onClick={() => setDayPanelOpen(false)} style={{ border: 0, background: 'transparent', color: colors.ink, cursor: 'pointer', fontSize: 20 }}>×</button></header>
            <div style={{ padding: 14 }}>
                <div style={{ display: 'grid', gap: 8 }}><b>{editing ? '일정 수정' : '새 일정 등록'}</b><label style={{ fontSize: 12, color: colors.muted }}>일정 제목<input value={title} onChange={(event) => setTitle(event.target.value)} style={{ ...inputStyle, marginTop: 4 }} /></label><label style={{ fontSize: 12, color: colors.muted }}>시간<div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 5, marginTop: 4 }}><select className={excel ? 'calendar-time-select calendar-time-select--excel' : 'calendar-time-select'} value={period} onChange={(event) => setPeriod(event.target.value as '오전' | '오후')} style={{ ...inputStyle, padding: '9px 6px' }}>{(['오전', '오후'] as const).map((value) => <option key={value} value={value}>{value}</option>)}</select><select className={excel ? 'calendar-time-select calendar-time-select--excel' : 'calendar-time-select'} value={hour} onChange={(event) => setHour(event.target.value)} style={{ ...inputStyle, padding: '9px 6px' }}>{Array.from({ length: 12 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}시</option>)}</select><select className={excel ? 'calendar-time-select calendar-time-select--excel' : 'calendar-time-select'} value={minute} onChange={(event) => setMinute(event.target.value)} style={{ ...inputStyle, padding: '9px 6px' }}>{Array.from({ length: 6 }, (_, index) => pad(index * 10)).map((value) => <option key={value} value={value}>{value}분</option>)}</select></div></label><div style={{ display: 'flex', gap: 7 }}><button type="button" onClick={() => void save()} disabled={!title.trim()} style={{ border: 0, borderRadius: 4, padding: '8px 11px', background: title.trim() ? colors.accent : colors.line, color: '#ffffff', cursor: title.trim() ? 'pointer' : 'not-allowed', fontWeight: 700 }}>{editing ? '수정 저장' : '일정 등록'}</button>{editing && <button type="button" onClick={resetForm} style={{ border: `1px solid ${colors.line}`, borderRadius: 4, padding: '8px 11px', background: 'transparent', color: colors.ink, cursor: 'pointer' }}>취소</button>}</div></div>
            </div>
        </div>, document.body)}
        {eventPreview && !dayPanelOpen && createPortal(<section style={{ position: 'fixed', left: eventPreview.x, top: eventPreview.y, zIndex: 10052, width: 'min(360px, calc(100vw - 20px))', maxHeight: 'min(620px, calc(100vh - 20px))', overflowY: 'auto', border: `1px solid ${colors.line}`, borderLeft: `4px solid ${colorForNickname(eventPreview.event.nickname)}`, borderRadius: 6, background: colors.panel, color: colors.ink, boxShadow: '0 10px 26px rgba(0,0,0,.32)' }}><header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderBottom: `1px solid ${colors.line}` }}><b style={{ fontSize: 13 }}>일정 상세</b><button type="button" onClick={() => { setCommentComposerRequested(false); setEventPreview(null); }} style={{ border: 0, background: 'transparent', color: colors.ink, cursor: 'pointer', fontSize: 18 }}>×</button></header><div style={{ padding: '11px 12px' }}><b style={{ display: 'block', fontSize: 15 }}>{eventPreview.event.title}</b><div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, color: colors.muted, fontSize: 12 }}><span>{eventPreview.event.date}</span><span>·</span><span>{eventPreview.event.time}</span></div><small style={{ display: 'block', marginTop: 8, color: colors.muted }}>작성자: {eventPreview.event.nickname || '익명'}</small><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}><button type="button" onClick={() => setCommentComposerRequested(true)} style={{ border: 0, background: 'transparent', color: colors.accent, cursor: 'pointer', padding: 0 }}>댓글 작성</button>{eventPreview.event.nickname.trim() !== '' && eventPreview.event.nickname.trim() === nickname.trim() && <span style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => { setSelectedDate(eventPreview.event.date); beginEdit(eventPreview.event); setDayPanelPosition(getDayPanelPosition(eventPreview.x, eventPreview.y)); setEventPreview(null); setDayPanelOpen(true); }} style={{ border: 0, background: 'transparent', color: colors.accent, cursor: 'pointer', padding: 0 }}>수정</button><button type="button" onClick={() => { void remove(eventPreview.event.id).then(() => setEventPreview(null)); }} style={{ border: 0, background: 'transparent', color: '#d9534f', cursor: 'pointer', padding: 0 }}>삭제</button></span>}</div><CalendarComments eventId={eventPreview.event.id} nickname={nickname} colors={colors} composeRequested={commentComposerRequested} onComposeRequestHandled={() => setCommentComposerRequested(false)} /></div></section>, document.body)}
    </div>;
}
