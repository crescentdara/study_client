import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkspaceMode } from './workspace/WorkspaceModeSwitch';

type CalendarEvent = { id: string; date: string; title: string; time: string; color?: string; nickname: string };
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
    const [title, setTitle] = useState('');
    const [period, setPeriod] = useState<'오전' | '오후'>('오전');
    const [hour, setHour] = useState('9');
    const [minute, setMinute] = useState('00');
    const colors = excel
        ? { bg: '#f7faf6', panel: '#ffffff', line: '#cbdacb', ink: '#18372a', muted: '#617566', accent: '#217346', soft: '#e2f0d9' }
        : { bg: '#1e1e1e', panel: '#252526', line: '#3e3e42', ink: '#d4d4d4', muted: '#a7a7a7', accent: '#4ec9b0', soft: '#2d3b38' };
    const load = async () => { const response = await fetch('/api/calendar-events'); if (response.ok) setEvents(await response.json()); };
    useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10000); return () => window.clearInterval(timer); }, []);
    useEffect(() => { setEventPreview(null); }, [selectedDate]);
    useEffect(() => { if (eventPreview) setDayPanelOpen(false); }, [eventPreview]);
    const eventsByDate = useMemo(() => {
        const grouped = events.reduce<Record<string, CalendarEvent[]>>((result, event) => { (result[event.date] ??= []).push(event); return result; }, {});
        Object.values(grouped).forEach((dailyEvents) => dailyEvents.sort((first, second) => timeOrder(first.time) - timeOrder(second.time)));
        return grouped;
    }, [events]);
    const selectedHoliday = KOREAN_HOLIDAYS[selectedDate];
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const cells = Array.from({ length: 42 }, (_, index) => index);
    const inputStyle = { width: '100%', boxSizing: 'border-box' as const, border: `1px solid ${colors.line}`, borderRadius: 4, background: excel ? '#ffffff' : '#3c3c3c', color: colors.ink, padding: '9px 10px', font: 'inherit' };
    const resetForm = () => { setEditing(null); setTitle(''); setPeriod('오전'); setHour('9'); setMinute('00'); };
    const openDay = (date: string, rect: DOMRect) => { setEventPreview(null); setSelectedDate(date); resetForm(); setDayPanelPosition({ x: Math.max(10, Math.min(rect.right + 8, window.innerWidth - 394)), y: Math.max(10, Math.min(rect.top, window.innerHeight - 520)) }); setDayPanelOpen(true); };
    const save = async () => { if (!title.trim()) return; const time = `${period} ${hour}:${minute}`; const response = await fetch(editing ? `/api/calendar-events/${encodeURIComponent(editing.id)}` : '/api/calendar-events', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, title, time, nickname }) }); if (response.ok) { await load(); resetForm(); setDayPanelOpen(false); } };
    const beginEdit = (event: CalendarEvent) => { const match = event.time.match(/(\d{1,2}):(\d{2})/); const rawHour = match ? Number(match[1]) : 9; const isKoreanPeriod = event.time.includes('오후'); const is24Hour = !event.time.includes('오전') && !isKoreanPeriod; const nextPeriod = is24Hour ? (rawHour >= 12 ? '오후' : '오전') : (isKoreanPeriod ? '오후' : '오전'); const hour12 = is24Hour ? (rawHour % 12 || 12) : rawHour; setEditing(event); setTitle(event.title); setPeriod(nextPeriod); setHour(String(hour12)); setMinute(match && Number(match[2]) % 10 === 0 ? match[2] : '00'); };
    const remove = async (id: string) => { const response = await fetch(`/api/calendar-events/${encodeURIComponent(id)}`, { method: 'DELETE' }); if (response.ok) { await load(); if (editing?.id === id) resetForm(); } };
    const getPopoverPosition = (rect: DOMRect) => ({ x: Math.max(10, Math.min(rect.right + 8, window.innerWidth - 294)), y: Math.max(10, Math.min(rect.top, window.innerHeight - 190)) });
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
                        return <div key={index} role="button" tabIndex={0} onClick={() => { setSelectedDate(date); setDayPanelOpen(false); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { setSelectedDate(date); setDayPanelOpen(false); } }} style={{ position: 'relative', minHeight: 88, overflow: 'hidden', textAlign: 'left', borderRight: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, padding: 8, background: isSelected ? colors.soft : 'transparent', color: dayColor, cursor: 'default', outline: 'none' }}><span style={{ position: 'absolute', top: 8, left: 8, display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 12, background: isToday ? (holiday ? '#d9534f' : colors.accent) : 'transparent', color: isToday ? '#ffffff' : dayColor, fontSize: 13, opacity: isCurrentMonth ? 1 : .42 }}>{day}</span>{isSelected && <button type="button" aria-label="일정 등록" title="일정 등록" onClick={(event) => { event.stopPropagation(); openDay(date, event.currentTarget.getBoundingClientRect()); }} style={{ position: 'absolute', top: 9, right: 9, width: 16, height: 16, border: `1px solid ${colors.line}`, borderRadius: '50%', padding: 0, background: 'transparent', color: colors.accent, cursor: 'pointer', fontSize: 14, fontWeight: 700, lineHeight: '12px' }}>+</button>}{holiday && <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 29, color: '#d9534f', fontSize: 11, fontWeight: 700, opacity: isCurrentMonth ? 1 : .42 }}>{holiday}</span>}{(eventsByDate[date] ?? []).slice(0, holiday ? 2 : 3).map((event, eventIndex) => <button key={event.id} type="button" title="클릭하여 일정 상세 보기" onClick={(mouseEvent) => { mouseEvent.stopPropagation(); setEventPreview({ event, ...getPopoverPosition(mouseEvent.currentTarget.getBoundingClientRect()) }); }} style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', boxSizing: 'border-box', overflow: 'hidden', marginTop: holiday || eventIndex > 0 ? 4 : 29, padding: '3px 0', border: 0, background: 'transparent', color: colors.ink, fontSize: 11, textAlign: 'left', cursor: 'pointer', opacity: isCurrentMonth ? 1 : .42, fontWeight: 500 }}><span aria-hidden="true" style={{ flex: '0 0 auto', width: 7, height: 7, borderRadius: '50%', background: colorForNickname(event.nickname) }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.time ? `${event.time} ` : ''}{event.title} ›</span></button>)}</div>;
                    })}
                </div>
                <small style={{ display: 'block', marginTop: 10, color: colors.muted }}>날짜를 선택한 뒤 우측 상단의 + 버튼을 눌러 공유 일정을 등록하거나 관리할 수 있습니다.</small>
            </section>
        </div>
        {dayPanelOpen && !eventPreview && createPortal(<div style={{ position: 'fixed', left: dayPanelPosition.x, top: dayPanelPosition.y, zIndex: 10050, width: 'min(380px, calc(100vw - 20px))', maxHeight: 'min(500px, calc(100vh - 20px))', overflow: 'auto', border: `1px solid ${colors.line}`, borderRadius: 8, background: colors.panel, color: colors.ink, boxShadow: '0 16px 38px rgba(0,0,0,.35)' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: excel ? '#e2f0d9' : '#303034', borderBottom: `1px solid ${colors.line}` }}><div><b>{selectedDate}</b>{selectedHoliday && <small style={{ display: 'block', color: '#d9534f', marginTop: 2 }}>{selectedHoliday}</small>}</div><button type="button" onClick={() => setDayPanelOpen(false)} style={{ border: 0, background: 'transparent', color: colors.ink, cursor: 'pointer', fontSize: 20 }}>×</button></header>
            <div style={{ padding: 14 }}>
                <div style={{ display: 'grid', gap: 8 }}><b>{editing ? '일정 수정' : '새 일정 등록'}</b><label style={{ fontSize: 12, color: colors.muted }}>일정 제목<input value={title} onChange={(event) => setTitle(event.target.value)} style={{ ...inputStyle, marginTop: 4 }} /></label><label style={{ fontSize: 12, color: colors.muted }}>시간<div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 5, marginTop: 4 }}><select value={period} onChange={(event) => setPeriod(event.target.value as '오전' | '오후')} style={{ ...inputStyle, padding: '9px 6px' }}>{(['오전', '오후'] as const).map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={hour} onChange={(event) => setHour(event.target.value)} style={{ ...inputStyle, padding: '9px 6px' }}>{Array.from({ length: 12 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}시</option>)}</select><select value={minute} onChange={(event) => setMinute(event.target.value)} style={{ ...inputStyle, padding: '9px 6px' }}>{Array.from({ length: 6 }, (_, index) => pad(index * 10)).map((value) => <option key={value} value={value}>{value}분</option>)}</select></div></label><div style={{ display: 'flex', gap: 7 }}><button type="button" onClick={() => void save()} disabled={!title.trim()} style={{ border: 0, borderRadius: 4, padding: '8px 11px', background: title.trim() ? colors.accent : colors.line, color: '#ffffff', cursor: title.trim() ? 'pointer' : 'not-allowed', fontWeight: 700 }}>{editing ? '수정 저장' : '일정 등록'}</button>{editing && <button type="button" onClick={resetForm} style={{ border: `1px solid ${colors.line}`, borderRadius: 4, padding: '8px 11px', background: 'transparent', color: colors.ink, cursor: 'pointer' }}>취소</button>}</div></div>
            </div>
        </div>, document.body)}
        {eventPreview && !dayPanelOpen && createPortal(<section style={{ position: 'fixed', left: eventPreview.x, top: eventPreview.y, zIndex: 10052, width: 'min(280px, calc(100vw - 20px))', border: `1px solid ${colors.line}`, borderLeft: `4px solid ${colorForNickname(eventPreview.event.nickname)}`, borderRadius: 6, background: colors.panel, color: colors.ink, boxShadow: '0 10px 26px rgba(0,0,0,.32)' }}><header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderBottom: `1px solid ${colors.line}` }}><b style={{ fontSize: 13 }}>일정 상세</b><button type="button" onClick={() => setEventPreview(null)} style={{ border: 0, background: 'transparent', color: colors.ink, cursor: 'pointer', fontSize: 18 }}>×</button></header><div style={{ padding: '11px 12px' }}><b style={{ display: 'block', fontSize: 15 }}>{eventPreview.event.title}</b><div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, color: colors.muted, fontSize: 12 }}><span>{eventPreview.event.date}</span><span>·</span><span>{eventPreview.event.time}</span></div><small style={{ display: 'block', marginTop: 8, color: colors.muted }}>작성자: {eventPreview.event.nickname || '익명'}</small>{eventPreview.event.nickname.trim() !== '' && eventPreview.event.nickname.trim() === nickname.trim() && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button type="button" onClick={() => { setSelectedDate(eventPreview.event.date); beginEdit(eventPreview.event); setDayPanelPosition({ x: eventPreview.x, y: eventPreview.y }); setEventPreview(null); setDayPanelOpen(true); }} style={{ border: 0, background: 'transparent', color: colors.accent, cursor: 'pointer', padding: 0 }}>수정</button><button type="button" onClick={() => { void remove(eventPreview.event.id).then(() => setEventPreview(null)); }} style={{ border: 0, background: 'transparent', color: '#d9534f', cursor: 'pointer', padding: 0 }}>삭제</button></div>}</div></section>, document.body)}
    </div>;
}
