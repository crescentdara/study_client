import { useEffect, useMemo, useState } from 'react';
import { AppleBoxRecord, CreateRoomRequest, Room, StudyType, TetrisRankRow } from '../../types';
import { useAppleLeaderboard, useAppleRankOpen } from '../../hooks/useAppleLeaderboard';
import { useTetrisLeaderboard, useTetrisRankOpen, tierLabel } from '../../hooks/useTetrisLeaderboard';

interface ExcelLobbyProps {
    nickname: string;
    sessionId: string;
    rooms: Room[];
    loading: boolean;
    profileEditing: boolean;
    lobbyError: string;
    fetchRooms: () => void;
    onJoinRoom: (room: Room) => void;
    onJoin: (roomId: string) => void;
    onClearLobbyError: () => void;
    onCellSelect: (address: string, value: string) => void;
    onRangeSelect: (startAddress: string, endAddress: string) => void;
}

// 재고 실사 대조(사과게임)는 업무 시트로 등록하지 않는다 — 좌측 🍎 버튼으로 바로 시작
const STUDY_TYPES: StudyType[] = [
    'BASEBALL', 'BINGO', 'OMOK', 'TETRIS', 'CATCHMIND', 'OLDMAID',
    'WORD_CHAIN', 'RUMMIKUB', 'DAVINCI_CODE', 'RUSH_HOUR', 'UBONGO', 'ALKKAGI',
];

const BUSINESS_LABELS: Record<StudyType, string> = {
    BASEBALL: '숫자야구',
    BINGO: '빙고',
    OMOK: '오목',
    TETRIS: '테트리스',
    OLDMAID: '도둑잡기',
    INCIDENT_AVOID: '장애물 피하기',
    BREAKOUT: '벽돌깨기',
    CATCHMIND: '캐치마인드',
    WORD_CHAIN: '끝말잇기',
    RUMMIKUB: '루미큐브',
    DAVINCI_CODE: '다빈치 코드',
    RUSH_HOUR: '러시아워',
    UBONGO: '우봉고',
    ALKKAGI: '알까기',
    APPLE_BOX: '재고 실사 대조',
};

const BASE_ROWS = [
    ['프론트엔드', '로비 워크시트 열 너비 및 스크롤 동기화', 'Web Core', '검토 중', '86%', '08/03', 'sticky header와 row rail 오프셋 확인'],
    ['백엔드', '게임방 목록 조회 API 응답 구조 정리', 'Platform API', '진행', '72%', '08/04', 'RoomSummary DTO 필드 호환성 유지'],
    ['QA', '엑셀·VS Code 테마 회귀 테스트', 'Quality Eng.', '진행', '68%', '08/05', 'Chrome·Edge 1440/1920 해상도 점검'],
    ['인프라', '운영 WebSocket 연결 유지율 모니터링', 'SRE', '확인 중', '91%', '08/03', 'STOMP reconnect 지표 대시보드 반영'],
    ['데이터베이스', 'room_event 인덱스 실행 계획 검토', 'Data Platform', '대기', '44%', '08/06', '운영 슬로우 쿼리 샘플 12건 수집'],
    ['배포', 'v1.8.0 릴리스 후보 변경사항 정리', 'Release Eng.', '검토 중', '83%', '08/03', 'hotfix/room-capacity 커밋 포함'],
    ['프론트엔드', '채팅 패널 가상 스크롤 적용 검토', 'Web Core', '진행', '57%', '08/07', '메시지 1,000건 기준 렌더링 측정'],
    ['백엔드', '방 입장 동시성 제어 로직 보강', 'Game Server', '진행', '76%', '08/05', '낙관적 잠금 재시도 최대 3회'],
    ['보안', '닉네임 입력값 XSS 방어 케이스 추가', 'App Security', '완료', '100%', '08/01', 'DOMPurify 우회 문자열 27종 통과'],
    ['모바일', '태블릿 가로 모드 레이아웃 대응', 'Client Platform', '대기', '35%', '08/09', '680px 이하 사이드바 정책 협의 중'],
    ['QA', '테트리스 멀티플레이 상태 동기화 검증', 'Quality Eng.', '진행', '62%', '08/06', '200ms 지연 환경에서 ghost block 확인'],
    ['인프라', '프론트 정적 자산 캐시 정책 조정', 'Cloud Infra', '검토 중', '79%', '08/04', 'hashed asset 1년·index no-cache 적용'],
    ['관측성', '클라이언트 오류 로그 샘플링 규칙 추가', 'SRE', '진행', '66%', '08/08', '동일 stack trace 5분 단위 집계'],
    ['백엔드', '사용자 세션 만료 처리 예외 보완', 'Platform API', '확인 중', '88%', '08/03', '재접속 시 이전 roomId 정리 필요'],
    ['프론트엔드', '셀 키보드 이동 및 Enter 편집 종료 구현', 'Web Core', '진행', '53%', '08/08', '방향키 선택 이동 범위 A1:I120'],
    ['데이터베이스', '채팅 메시지 보관 주기 마이그레이션', 'Data Platform', '검토 중', '71%', '08/10', 'partition drop 전 백업 검증 필요'],
    ['API', '게임별 설정값 validation 공통화', 'Game Server', '진행', '64%', '08/07', 'boardSize·digits·maxPlayers 규칙 통합'],
    ['성능', '초기 JavaScript 번들 분할 후보 조사', 'Web Core', '대기', '39%', '08/11', '게임 컴포넌트 dynamic import 우선'],
    ['빌드', 'TypeScript 5.x strict 경고 정리', 'Developer Exp.', '진행', '74%', '08/06', '미사용 legacy renderer 별도 분리'],
    ['보안', 'WebSocket origin 검증 정책 점검', 'App Security', '검토 중', '82%', '08/05', '허용 도메인 환경변수 분리 예정'],
    ['프론트엔드', '게임 아이콘 접근성 레이블 보완', 'Design System', '완료', '100%', '08/02', 'aria-label 및 focus outline 반영'],
    ['백엔드', '방 삭제 후 잔여 구독 정리', 'Game Server', '확인 중', '89%', '08/04', 'DISCONNECT 이벤트 순서 재현 완료'],
    ['QA', '숫자야구 3·4·5자리 조합 테스트', 'Quality Eng.', '진행', '77%', '08/07', '중복 숫자 거부 및 0 시작값 확인'],
    ['인프라', '개발 환경 CORS 설정 템플릿 정리', 'Cloud Infra', '완료', '100%', '08/01', 'localhost 포트 범위 문서화 완료'],
    ['디자인시스템', '엑셀 테마 색상 토큰 명세화', 'Design System', '진행', '69%', '08/08', 'selection·header·status 색상 분리'],
    ['백엔드', '랭킹 집계 배치 멱등성 보장', 'Data Service', '대기', '46%', '08/12', '중복 실행 시 score 합산 방지'],
    ['프론트엔드', '채팅 입력창 IME 조합 이벤트 수정', 'Web Core', '검토 중', '92%', '08/03', '한글 조합 중 Enter 전송 차단 확인'],
    ['모니터링', '게임방 생성 실패율 알림 임계치 조정', 'SRE', '진행', '73%', '08/09', '5분 3% 초과 시 Slack 경보'],
    ['데이터', '플레이 기록 이벤트 스키마 버전업', 'Data Platform', '확인 중', '85%', '08/06', 'v1 consumer 하위 호환 필드 유지'],
    ['QA', '루미큐브 재접속 상태 복원 시나리오', 'Quality Eng.', '대기', '33%', '08/13', '턴 진행 중 브라우저 강제 종료 포함'],
    ['프론트엔드', '공통 Toast 중복 노출 방지', 'Web Core', '진행', '61%', '08/10', '동일 key 2초 debounce 적용'],
    ['백엔드', '오목 승리 판정 경계 좌표 테스트', 'Game Server', '완료', '100%', '08/02', '가로·세로·대각선 6목 정책 확인'],
    ['문서화', '로컬 개발 및 소켓 디버깅 가이드 갱신', 'Developer Exp.', '검토 중', '78%', '08/11', '프록시·포트 충돌 해결 절차 추가'],
    ['배포', 'Blue/Green 전환 후 세션 유지 검증', 'Release Eng.', '진행', '58%', '08/14', '구버전 소켓 drain 90초 적용'],
    ['보안', '의존성 취약점 정기 스캔 조치', 'App Security', '확인 중', '87%', '08/05', '중간 위험도 4건 영향 범위 검토'],
    ['성능', '로비 100개 방 렌더링 부하 측정', 'Performance', '진행', '67%', '08/12', '메모리·commit time 기준선 기록'],
];

interface GridValue {
    text: string;
    className?: string;
    action?: () => void;
    disabled?: boolean;
    readOnly?: boolean;
    input?: boolean;
}

interface LunchMenuRow {
    id: string;
    menu: string;
    nickname: string;
    votes: number;
    winner: boolean;
}

interface LunchSnapshot {
    date: string;
    menus: LunchMenuRow[];
    voterCount: number;
    myVoteMenuId?: string;
}

interface InteractiveTaskGridProps {
    nickname: string;
    rooms: Room[];
    activePeople: number;
    onJoin: (roomId: string) => void;
    onRefresh: () => void;
    onCreate: () => void;
    loading: boolean;
    onCellSelect: (address: string, value: string) => void;
    onRangeSelect: (startAddress: string, endAddress: string) => void;
    /** 사과게임 랭킹 — 워크시트에서는 '실적 집계'처럼 보이게 끼워 넣는다 */
    appleRecords: AppleBoxRecord[];
    appleWeekly: AppleBoxRecord[];
    appleWeekStart: string;
    appleRankingFailed: boolean;
    /** 엑셀 그룹 아웃라인처럼 ＋/－ 로 접었다 펼 수 있게 */
    appleRankOpen: boolean;
    onToggleAppleRank: () => void;
    /** 테트리스 전적·티어 — '품질 평가 등급' 집계처럼 보이게 끼워 넣는다 */
    tetrisRecords: TetrisRankRow[];
    /** 서바이벌 등급은 대전과 별개 장부다 */
    tetrisSurvivalRecords: TetrisRankRow[];
    tetrisRankingFailed: boolean;
    tetrisRankOpen: boolean;
    onToggleTetrisRank: () => void;
}

const GRID_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function InteractiveTaskGrid({
    nickname, rooms, activePeople, onJoin, onRefresh, onCreate, loading, onCellSelect, onRangeSelect,
    appleRecords, appleWeekly, appleWeekStart, appleRankingFailed, appleRankOpen, onToggleAppleRank,
    tetrisRecords, tetrisSurvivalRecords, tetrisRankingFailed, tetrisRankOpen, onToggleTetrisRank,
}: InteractiveTaskGridProps) {
    const [selected, setSelected] = useState('A1');
    const [dragAnchor, setDragAnchor] = useState('A1');
    const [dragEnd, setDragEnd] = useState('A1');
    const [dragging, setDragging] = useState(false);
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [lunch, setLunch] = useState<LunchSnapshot>({ date: '', menus: [], voterCount: 0 });
    const [lunchMessage, setLunchMessage] = useState('');
    const [lunchOpen, setLunchOpen] = useState(true);

    const loadLunch = async () => {
        try {
            const response = await fetch(`/api/lunch/today?nickname=${encodeURIComponent(nickname)}`);
            if (response.ok) setLunch(await response.json());
        } catch {
            setLunchMessage('점심 메뉴 데이터를 불러오지 못했습니다.');
        }
    };

    const lunchRequest = async (url: string, body: Record<string, string>) => {
        if (!nickname.trim()) { setLunchMessage('닉네임을 먼저 입력하세요.'); return; }
        const response = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, ...body }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) { setLunchMessage(result?.message ?? '처리하지 못했습니다.'); return; }
        setLunch(result); setLunchMessage('');
    };

    const select = (address: string, value: string) => {
        setSelected(address);
        setDragAnchor(address);
        setDragEnd(address);
        onCellSelect(address, value);
        onRangeSelect(address, address);
    };

    useEffect(() => {
        const finishDrag = () => setDragging(false);
        window.addEventListener('mouseup', finishDrag);
        window.addEventListener('blur', finishDrag);
        return () => {
            window.removeEventListener('mouseup', finishDrag);
            window.removeEventListener('blur', finishDrag);
        };
    }, []);

    useEffect(() => { void loadLunch(); }, [nickname]);

    const selectionBounds = useMemo(() => {
        const parse = (address: string) => ({
            column: GRID_COLUMNS.indexOf(address.replace(/\d/g, '')),
            row: Number(address.replace(/\D/g, '')) - 1,
        });
        const start = parse(dragAnchor);
        const end = parse(dragEnd);
        return {
            left: Math.min(start.column, end.column),
            right: Math.max(start.column, end.column),
            top: Math.min(start.row, end.row),
            bottom: Math.max(start.row, end.row),
        };
    }, [dragAnchor, dragEnd]);

    const rangeClassName = (row: number, column: number) => {
        const { left, right, top, bottom } = selectionBounds;
        if (column < left || column > right || row < top || row > bottom) return '';
        return [
            'range-selected',
            row === top ? 'range-top' : '',
            row === bottom ? 'range-bottom' : '',
            column === left ? 'range-left' : '',
            column === right ? 'range-right' : '',
        ].filter(Boolean).join(' ');
    };

    const activeWorkCount = BASE_ROWS.filter((row) => row[3] !== '완료').length + rooms.length;
    const averageProgress = Math.round(
        BASE_ROWS.reduce((total, row) => total + Number.parseInt(row[4], 10), 0) / BASE_ROWS.length,
    );

    const rows: GridValue[][] = [
        [
            { text: '기준일', className: 'label', readOnly: true }, { text: '2026-07-31' },
            { text: '작성 부서', className: 'label', readOnly: true }, { text: '플랫폼개발팀' },
            { text: '작성자', className: 'label', readOnly: true }, { text: nickname || '미지정' },
            { text: '문서 상태', className: 'label', readOnly: true }, { text: '검토 중', className: 'review' },
            { text: loading ? '새로 고치는 중…' : '새로 고침', action: onRefresh, disabled: loading, readOnly: true },
        ],
        [
            { text: '전체 업무', className: 'metric-label', readOnly: true }, { text: `${BASE_ROWS.length + rooms.length}건`, className: 'metric' },
            { text: '진행 중', className: 'metric-label', readOnly: true }, { text: `${activeWorkCount}건`, className: 'metric' },
            { text: '접속 인원', className: 'metric-label', readOnly: true }, { text: `${activePeople}명`, className: 'metric' },
            { text: '평균 진행률', className: 'metric-label', readOnly: true }, { text: `${averageProgress}%`, className: 'metric' },
            { text: '신규 등록', action: onCreate, readOnly: true },
        ],
        ['No.', '업무 구분', '업무 항목', '담당', '진행 상태', '진행률', '마감', '비고', '실행'].map((text) => ({
            text, className: 'table-header', readOnly: true,
        })),
    ];

    // The workbook shell already owns row numbers, so the sheet data starts in column A.
    rows[2].shift();
    rows[2].push({ text: '검토', className: 'table-header', readOnly: true });

    rooms.forEach((room) => {
        const capacity = room.studyType === 'TETRIS' && room.mode !== 'SURVIVAL' ? 3 : room.maxPlayers;
        rows.push([
            { text: BUSINESS_LABELS[room.studyType] },
            { text: room.roomName, className: 'live-title' },
            { text: room.playerNames?.[0] || '담당 미정' },
            { text: room.status === 'WAITING' ? '접수' : '진행', className: room.status === 'WAITING' ? 'status-wait' : 'status-work' },
            { text: `${room.playerCount}/${capacity}명`, className: 'center' },
            { text: '금일', className: 'center' },
            { text: room.playerCount >= capacity ? '참여 마감' : '참여 가능' },
            { text: '열기', action: () => onJoin(room.roomId), disabled: room.playerCount >= capacity, readOnly: true },
            { text: room.status === 'WAITING' ? '대기' : '확인 중', className: 'center' },
        ]);
    });

    // ── 오늘의 점심 — 별도 카드가 아니라 기존 워크시트의 데이터 행으로 표시한다 ──
    rows.push([
        { text: `${lunchOpen ? '－' : '＋'} 점심 투표`, className: 'metric-label', action: () => setLunchOpen((value) => !value), readOnly: true },
        { text: `오늘의 메뉴 · ${lunch.date || '오늘'}`, className: 'live-title', readOnly: true },
        { text: `${lunch.voterCount}명 참여`, className: 'label', readOnly: true },
        { text: '등록자', className: 'label', readOnly: true },
        { text: '득표', className: 'label', readOnly: true },
        { text: '투표', className: 'label', readOnly: true },
        ...Array.from({ length: 3 }, () => ({ text: '', readOnly: true })),
    ]);
    if (lunchOpen && lunch.menus.length === 0) {
        rows.push([
            { text: '메뉴', className: 'note-label', readOnly: true },
            { text: '아직 등록된 메뉴가 없습니다', className: 'note', readOnly: true },
            ...Array.from({ length: 7 }, () => ({ text: '', readOnly: true })),
        ]);
    } else if (lunchOpen) {
        lunch.menus.forEach((item, index) => rows.push([
            { text: item.winner ? '👑 1위' : `${index + 1}위`, className: item.winner ? 'metric-label' : 'center', readOnly: true },
            { text: item.menu, className: item.winner ? 'live-title' : '', readOnly: true },
            { text: item.nickname, readOnly: true },
            { text: item.nickname, readOnly: true },
            { text: `${item.votes}표`, className: 'center', readOnly: true },
            { text: lunch.myVoteMenuId === item.id ? '투표 완료' : item.nickname.trim().toLowerCase() === nickname.trim().toLowerCase() ? '내 메뉴' : lunch.menus.length < 3 ? '3명 등록 필요' : '투표', action: () => void lunchRequest('/api/lunch/votes', { menuId: item.id }), disabled: Boolean(lunch.myVoteMenuId) || lunch.menus.length < 3 || item.nickname.trim().toLowerCase() === nickname.trim().toLowerCase(), readOnly: true },
            ...Array.from({ length: 3 }, () => ({ text: '', readOnly: true })),
        ]));
    }
    if (lunchOpen) {
    const lunchInputAddress = `B${rows.length + 1}`;
    rows.push([
        { text: '＋ 메뉴 등록', className: 'note-label', readOnly: true },
        { text: '', input: true },
        { text: '← 이 빈 셀을 더블클릭해 메뉴 입력', className: 'note', readOnly: true },
        { text: '', readOnly: true },
        { text: '', readOnly: true },
        { text: '등록', action: () => { const value = edits[lunchInputAddress] ?? ''; void lunchRequest('/api/lunch/menus', { menu: value }).then(() => setEdits((current) => ({ ...current, [lunchInputAddress]: '' }))); }, readOnly: true },
        ...Array.from({ length: 3 }, () => ({ text: '', readOnly: true })),
    ]);
    if (lunchMessage) rows.push([
        { text: '안내', className: 'note-label', readOnly: true }, { text: lunchMessage, className: 'note', readOnly: true }, ...Array.from({ length: 7 }, () => ({ text: '', readOnly: true })),
    ]);
    }

    // ── 사과게임 랭킹 — 접기/펼치기 되는 실적 집계 (주간 / 누적) ──────────────────
    rows.push([
        {
            text: `${appleRankOpen ? '－' : '＋'} 실적 집계`,
            className: 'metric-label',
            action: onToggleAppleRank,
            readOnly: true,
        },
        { text: '재고 실사 대조 — 담당자별 최고 처리 건수', className: 'live-title', readOnly: true },
        {
            text: appleRankOpen ? '담당자' : `주간 ${appleWeekly.length}명 · 누적 ${appleRecords.length}명`,
            className: 'label',
            readOnly: true,
        },
        { text: appleRankOpen ? '최고 건수' : '', className: 'label', readOnly: true },
        { text: appleRankOpen ? '수행 횟수' : '', className: 'label', readOnly: true },
        ...Array.from({ length: 3 }, () => ({ text: '', readOnly: true })),
        { text: appleRankOpen ? '순위' : '', className: 'label', readOnly: true },
    ]);

    if (appleRankOpen) {
        // 한 구간(주간/누적)을 같은 모양으로 그린다
        const pushRankSection = (label: string, caption: string, records: AppleBoxRecord[], emptyNote: string) => {
            rows.push([
                { text: label, className: 'metric-label', readOnly: true },
                { text: caption, className: 'note', readOnly: true },
                ...Array.from({ length: 7 }, () => ({ text: '', readOnly: true })),
            ]);
            if (appleRankingFailed) {
                rows.push([
                    { text: label },
                    { text: '실적 집계를 불러오지 못했습니다 — 새로 고침으로 다시 시도해 주세요', className: 'note' },
                    ...Array.from({ length: 7 }, () => ({ text: '' })),
                ]);
                return;
            }
            if (records.length === 0) {
                rows.push([
                    { text: label },
                    { text: emptyNote, className: 'note' },
                    ...Array.from({ length: 7 }, () => ({ text: '' })),
                ]);
                return;
            }
            records.forEach((record) => {
                const mine = record.nickname === nickname;
                rows.push([
                    { text: label },
                    { text: `${record.rank}위 · ${record.nickname}`, className: mine ? 'live-title' : '' },
                    { text: mine ? `${record.nickname} (본인)` : record.nickname },
                    { text: `${record.best}건`, className: 'center' },
                    { text: `${record.games}회`, className: 'center' },
                    ...Array.from({ length: 3 }, () => ({ text: '' })),
                    { text: `${record.rank}위`, className: 'center' },
                ]);
            });
        };

        pushRankSection(
            '주간 실적',
            `이번 주 집계 · 매주 월요일 초기화${appleWeekStart ? ` (${appleWeekStart} 기준)` : ''}`,
            appleWeekly,
            '이번 주 집계된 실적이 없습니다 — 좌측 🍎 버튼으로 참여하면 기록됩니다',
        );
        pushRankSection(
            '누적 실적',
            '전체 기간 누적 · 초기화 없음',
            appleRecords,
            '집계된 실적이 없습니다',
        );
    }

    rows.push([
        {
            text: `${tetrisRankOpen ? '－' : '＋'} 평가 등급`,
            className: 'metric-label',
            action: onToggleTetrisRank,
            readOnly: true,
        },
        { text: '공정 검사 숙련도 — 담당자별 등급 및 처리 실적', className: 'live-title', readOnly: true },
        {
            text: tetrisRankOpen
                ? '담당자'
                : `대전 ${tetrisRecords.length}명 · 대응 ${tetrisSurvivalRecords.length}명`,
            className: 'label',
            readOnly: true,
        },
        { text: tetrisRankOpen ? '등급' : '', className: 'label', readOnly: true },
        { text: tetrisRankOpen ? '평점' : '', className: 'label', readOnly: true },
        { text: tetrisRankOpen ? '처리 건수' : '', className: 'label', readOnly: true },
        { text: tetrisRankOpen ? '적합률' : '', className: 'label', readOnly: true },
        { text: '', readOnly: true },
        { text: tetrisRankOpen ? '순위' : '', className: 'label', readOnly: true },
    ]);

    if (tetrisRankOpen) {
        // 대전 등급과 유입 대응(서바이벌) 등급을 각각의 구간으로 보여준다
        const pushTetrisSection = (label: string, caption: string, records: TetrisRankRow[], emptyNote: string) => {
            rows.push([
                { text: label, className: 'metric-label', readOnly: true },
                { text: caption, className: 'note', readOnly: true },
                ...Array.from({ length: 7 }, () => ({ text: '', readOnly: true })),
            ]);
            if (tetrisRankingFailed) {
                rows.push([
                    { text: label },
                    { text: '등급 집계를 불러오지 못했습니다 — 새로 고침으로 다시 시도해 주세요', className: 'note' },
                    ...Array.from({ length: 7 }, () => ({ text: '' })),
                ]);
                return;
            }
            if (records.length === 0) {
                rows.push([
                    { text: label },
                    { text: emptyNote, className: 'note' },
                    ...Array.from({ length: 7 }, () => ({ text: '' })),
                ]);
                return;
            }
            records.forEach((row) => {
                const mine = row.nickname === nickname;
                rows.push([
                    { text: label },
                    { text: `${row.rank}위 · ${row.nickname}`, className: mine ? 'live-title' : '' },
                    { text: mine ? `${row.nickname} (본인)` : row.nickname },
                    {
                        text: tierLabel(row),
                        className: row.ranked ? 'status-done' : 'status-wait',
                    },
                    { text: `${row.ranked ? row.rp : row.rating}점`, className: 'center' },
                    { text: `${row.matches}건`, className: 'center' },
                    { text: `${row.winRate}%`, className: 'center' },
                    { text: `적합 ${row.wins} · 부적합 ${row.losses}` },
                    { text: `${row.rank}위`, className: 'center' },
                ]);
            });
        };

        pushTetrisSection(
            '대전 등급',
            '2~3명 동시 진행 기준 평가',
            tetrisRecords,
            '평가된 담당자가 없습니다 — 2인 이상 대전 시 집계됩니다',
        );
        pushTetrisSection(
            '대응 등급',
            '유입 대응 2인 이상 기준 평가 · 대전 등급과 별도',
            tetrisSurvivalRecords,
            '평가된 담당자가 없습니다 — 유입 대응을 2인 이상으로 진행하면 집계됩니다',
        );
    }

    BASE_ROWS.forEach((row) => {
        const status = row[3];
        rows.push([
            { text: row[0] }, { text: row[1] }, { text: row[2] },
            { text: status, className: status === '완료' ? 'status-done' : status === '대기' ? 'status-wait' : 'status-work' },
            { text: row[4], className: 'center' }, { text: row[5], className: 'center' }, { text: row[6] }, { text: '' },
            { text: status === '완료' ? '확인' : '검토 중', className: 'center' },
        ]);
    });

    rows.push([
        { text: '확인', className: 'note-label', readOnly: true },
        { text: '공유 전 담당자·일정·수치·외부 공개 문구 확인', className: 'note' },
        ...Array.from({ length: 7 }, () => ({ text: '' })),
    ]);
    return (
        <div className="excel-real-sheet" role="grid" aria-label="주간 운영 업무 현황 워크시트">
            {rows.map((row, rowIndex) => {
                const rowNumber = rowIndex + 1;
                return row.map((cell, columnIndex) => {
                        const address = `${GRID_COLUMNS[columnIndex]}${rowNumber}`;
                        const value = edits[address] ?? cell.text;
                        return (
                            <div
                                key={address}
                                className={`excel-grid-cell ${cell.className ?? ''} ${rangeClassName(rowIndex, columnIndex)} ${selected === address ? 'selected' : ''}`}
                                role="gridcell"
                                tabIndex={0}
                                contentEditable={!cell.readOnly && !cell.action && !cell.input}
                                suppressContentEditableWarning
                                data-address={address}
                                onFocus={() => select(address, value)}
                                onMouseDown={(event) => {
                                    if (event.button !== 0) return;
                                    if (cell.input) return;
                                    event.preventDefault();
                                    select(address, value);
                                    setDragging(true);
                                }}
                                onMouseEnter={() => {
                                    if (dragging) {
                                        setDragEnd(address);
                                        onRangeSelect(dragAnchor, address);
                                    }
                                }}
                                onDoubleClick={(event) => {
                                    if (!cell.readOnly && !cell.action) event.currentTarget.focus();
                                }}
                                onInput={(event) => {
                                    if (cell.input) return;
                                    const next = event.currentTarget.textContent ?? '';
                                    setEdits((current) => ({ ...current, [address]: next }));
                                    onCellSelect(address, next);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        event.currentTarget.blur();
                                    }
                                }}
                            >
                                {cell.action ? (
                                    <button
                                        type="button"
                                        disabled={cell.disabled}
                                        onClick={(event) => { event.stopPropagation(); cell.action?.(); }}
                                    >
                                        {cell.text}
                                    </button>
                                ) : cell.input ? (
                                    <input
                                        value={value}
                                        onFocus={() => select(address, value)}
                                        onChange={(event) => {
                                            const next = event.target.value.slice(0, 100);
                                            setEdits((current) => ({ ...current, [address]: next }));
                                            onCellSelect(address, next);
                                        }}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                                        maxLength={100}
                                        aria-label="오늘의 점심 메뉴"
                                        style={{ width: '100%', height: '100%', border: 0, outline: 'none', background: 'transparent', font: 'inherit', padding: 0 }}
                                    />
                                ) : value}
                            </div>
                        );
                    });
            })}
        </div>
    );
}

function configureType(
    type: StudyType,
    setStudyType: (type: StudyType) => void,
    setMaxPlayers: (value: number) => void,
    setBoardSize: (value: number) => void,
    setDigits: (value: number) => void,
) {
    setStudyType(type);
    if (type === 'OMOK') { setMaxPlayers(2); setBoardSize(19); }
    else if (type === 'ALKKAGI') { setMaxPlayers(1); setBoardSize(0); }
    else if (type === 'TETRIS') { setMaxPlayers(3); setBoardSize(20); }
    else if (type === 'OLDMAID') { setMaxPlayers(4); setBoardSize(0); }
    else if (type === 'WORD_CHAIN') { setMaxPlayers(4); setDigits(7); }
    else if (type === 'RUMMIKUB' || type === 'DAVINCI_CODE') { setMaxPlayers(4); setBoardSize(0); }
    else if (type === 'RUSH_HOUR' || type === 'UBONGO') { setMaxPlayers(1); setBoardSize(0); }
}

export default function ExcelLobby({
    nickname,
    sessionId,
    rooms,
    loading,
    profileEditing,
    lobbyError,
    fetchRooms,
    onJoinRoom,
    onJoin,
    onClearLobbyError,
    onCellSelect,
    onRangeSelect,
}: ExcelLobbyProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [studyType, setStudyType] = useState<StudyType>('BASEBALL');
    const [maxPlayers, setMaxPlayers] = useState(2);
    const [digits, setDigits] = useState(3);
    const [boardSize, setBoardSize] = useState(5);
    const [creating, setCreating] = useState(false);
    // 테트리스를 대전으로 열지, 혼자 버티는 서바이벌로 열지
    const [tetrisSurvival, setTetrisSurvival] = useState(false);
    const [error, setError] = useState('');
    const [createSelection, setCreateSelection] = useState('B4');

    const appleRanking = useAppleLeaderboard(10);
    const appleRank = useAppleRankOpen();
    const tetrisRanking = useTetrisLeaderboard(10);
    const tetrisRank = useTetrisRankOpen();

    const activePeople = useMemo(
        () => new Set(rooms.flatMap((room) => room.playerNames ?? [])).size,
        [rooms],
    );

    // 시트의 '새로 고침'은 방 목록과 실적·등급 집계를 함께 갱신한다
    const handleRefresh = () => {
        fetchRooms();
        void appleRanking.reload();
        void tetrisRanking.reload();
    };

    const handleCreate = async () => {
        if (profileEditing || !nickname.trim()) {
            setError('사용자 정보를 먼저 저장해 주세요.');
            return;
        }
        setCreating(true);
        try {
            const body: CreateRoomRequest = {
                roomName: roomName.trim() || BUSINESS_LABELS[studyType],
                studyType,
                nickname: nickname.trim(),
                sessionId,
                maxPlayers: studyType === 'TETRIS'
                    ? (tetrisSurvival ? Math.max(1, Math.min(3, maxPlayers)) : 3)
                    : studyType === 'OMOK' ? 2 : maxPlayers,
                digits,
                boardSize: studyType === 'TETRIS' ? 20 : studyType === 'OMOK' ? 19 : studyType === 'ALKKAGI' || studyType === 'OLDMAID' ? 0 : boardSize,
                mode: studyType === 'TETRIS' && tetrisSurvival ? 'SURVIVAL' : '',
            };
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error(await response.text());
            onJoinRoom(await response.json());
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : '업무 시트를 만들지 못했습니다.');
        } finally {
            setCreating(false);
        }
    };

    const displayError = error || lobbyError;
    const selectCreateCell = (address: string, value: string) => {
        setCreateSelection(address);
        onCellSelect(address, value);
        onRangeSelect(address, address);
    };
    const configLabel = studyType === 'BASEBALL' ? '게임 자릿수' : studyType === 'BINGO' ? '빙고 크기' : '게임 설정';
    const configValue = studyType === 'BASEBALL' ? digits : studyType === 'BINGO' ? boardSize : 0;
    const configText = studyType === 'BASEBALL'
        ? `${digits}자리 숫자 조합 · 중복 숫자 제외`
        : studyType === 'BINGO'
          ? `${boardSize} × ${boardSize} 빙고판 자동 생성`
          : `${BUSINESS_LABELS[studyType]} 기본 규칙을 적용합니다.`;

    return (
        <div className="excel-lobby">
            {displayError && (
                <button
                    className="excel-notice error"
                    type="button"
                    onClick={() => { setError(''); onClearLobbyError(); }}
                >
                    연결된 원본 데이터를 확인하지 못했습니다. 눌러서 알림 닫기
                </button>
            )}

            {showCreate ? (
                <div className="excel-create-sheet" role="grid" aria-label="신규 게임 등록 시트">
                    <div className="excel-create-title" style={{ gridColumn: 'span 9' }}>신규 게임 등록 요청서</div>

                    <div className="excel-create-cell label">기준일</div><div className="excel-create-cell">2026-08-03</div>
                    <div className="excel-create-cell label">작성 부서</div><div className="excel-create-cell" style={{ gridColumn: 'span 2' }}>플랫폼개발팀</div>
                    <div className="excel-create-cell label">작성자</div><div className="excel-create-cell">{nickname || '미지정'}</div>
                    <div className="excel-create-cell label">문서 상태</div><div className="excel-create-cell review">검토 중</div>

                    <div className="excel-create-section" style={{ gridColumn: 'span 9' }}>1. 게임 기본 정보</div>

                    <div className="excel-create-cell label">게임 이름</div>
                    <div className={`excel-create-cell input-cell ${createSelection === 'B4' ? 'selected' : ''}`} style={{ gridColumn: 'span 4' }}>
                        <input autoFocus value={roomName} onFocus={() => selectCreateCell('B4', roomName)} onChange={(event) => { setRoomName(event.target.value); onCellSelect('B4', event.target.value); }} placeholder={`${BUSINESS_LABELS[studyType]} 방 이름을 입력하세요`} maxLength={20} />
                    </div>
                    <div className="excel-create-cell label">등록 번호</div><div className="excel-create-cell muted" style={{ gridColumn: 'span 3' }}>AUTO-ROOM-{String(rooms.length + 1).padStart(3, '0')}</div>

                    <div className="excel-create-cell label">게임 종류</div>
                    <div className={`excel-create-cell input-cell ${createSelection === 'B5' ? 'selected' : ''}`} style={{ gridColumn: 'span 3' }}>
                        <select value={studyType} onFocus={() => selectCreateCell('B5', BUSINESS_LABELS[studyType])} onChange={(event) => { const type = event.target.value as StudyType; configureType(type, setStudyType, setMaxPlayers, setBoardSize, setDigits); if (type !== 'TETRIS') setTetrisSurvival(false); onCellSelect('B5', BUSINESS_LABELS[type]); }}>
                            {STUDY_TYPES.map((type) => <option key={type} value={type}>{BUSINESS_LABELS[type]}</option>)}
                        </select>
                    </div>
                    <div className="excel-create-cell label">참여 인원</div>
                    <div className={`excel-create-cell input-cell number ${createSelection === 'F5' ? 'selected' : ''}`}>
                        <input type="number" min={1} max={7} value={maxPlayers} onFocus={() => selectCreateCell('F5', String(maxPlayers))} onChange={(event) => { setMaxPlayers(Number(event.target.value)); onCellSelect('F5', event.target.value); }} />
                    </div>
                    <div className="excel-create-cell label">공개 범위</div><div className="excel-create-cell" style={{ gridColumn: 'span 2' }}>로비 전체</div>

                    {studyType === 'TETRIS' && (
                        <>
                            <div className="excel-create-cell label">진행 방식</div>
                            <div className={`excel-create-cell input-cell ${createSelection === 'B7' ? 'selected' : ''}`} style={{ gridColumn: 'span 3' }}>
                                <select
                                    value={tetrisSurvival ? 'SURVIVAL' : 'VERSUS'}
                                    onFocus={() => selectCreateCell('B7', tetrisSurvival ? '단독 대응' : '대전')}
                                    onChange={(event) => {
                                        const survival = event.target.value === 'SURVIVAL';
                                        setTetrisSurvival(survival);
                                        setMaxPlayers(survival ? 1 : 3);
                                        onCellSelect('B7', survival ? '단독 대응' : '대전');
                                    }}
                                >
                                    <option value="VERSUS">대전 (2~3명)</option>
                                    <option value="SURVIVAL">유입 대응 (1~3명)</option>
                                </select>
                            </div>
                            <div className="excel-create-cell muted" style={{ gridColumn: 'span 5' }}>
                                {tetrisSurvival
                                    ? '유입 항목을 버티는 방식입니다. 2명 이상이면 별도 등급으로 집계됩니다.'
                                    : '2~3명이 함께 진행하며 평가 등급에 반영됩니다.'}
                            </div>
                        </>
                    )}

                    <div className="excel-create-cell label">{configLabel}</div>
                    <div className={`excel-create-cell input-cell number ${createSelection === 'B6' ? 'selected' : ''}`} style={{ gridColumn: 'span 2' }}>
                        {studyType === 'BASEBALL' || studyType === 'BINGO' ? (
                            <input type="number" min={3} max={studyType === 'BASEBALL' ? 5 : 7} value={configValue} onFocus={() => selectCreateCell('B6', String(configValue))} onChange={(event) => { const value = Number(event.target.value); if (studyType === 'BASEBALL') setDigits(value); else setBoardSize(value); onCellSelect('B6', event.target.value); }} />
                        ) : <span>기본값</span>}
                    </div>
                    <div className="excel-create-cell muted" style={{ gridColumn: 'span 2' }}>{configText}</div>
                    <div className="excel-create-cell label">서버 상태</div><div className="excel-create-cell ready" style={{ gridColumn: 'span 3' }}>● 등록 가능</div>

                    <div className="excel-create-cell label">등록 목적</div><div className="excel-create-cell" style={{ gridColumn: 'span 8' }}>개발팀 휴식 시간용 실시간 멀티플레이 게임 세션 생성</div>
                    <div className="excel-create-cell note-label">검토 메모</div><div className="excel-create-cell note" style={{ gridColumn: 'span 8' }}>등록 후 로비 목록에 즉시 반영됩니다. 게임 종류와 참여 인원을 확인한 뒤 등록해 주세요.</div>
                    {Array.from({ length: 9 }, (_, index) => <div className="excel-create-empty-cell" key={`create-spacer-${index}`} />)}

                    <div className="excel-create-status" style={{ gridColumn: 'span 6' }}>입력 셀 3개 · 필수값 자동 검증 · WebSocket 세션 준비</div>
                    <button className="excel-create-cancel" type="button" onClick={() => setShowCreate(false)}>취소</button>
                    <button className="excel-create-submit" type="button" onClick={handleCreate} disabled={creating}>{creating ? '등록 중…' : '게임 등록'}</button>
                    {Array.from({ length: 36 * 9 }, (_, index) => <div className="excel-create-empty-cell" key={`create-empty-${index}`} />)}
                </div>
            ) : (
                <InteractiveTaskGrid
                    nickname={nickname}
                    rooms={rooms}
                    activePeople={activePeople}
                    onJoin={onJoin}
                    onRefresh={handleRefresh}
                    onCreate={() => setShowCreate(true)}
                    loading={loading || appleRanking.loading || tetrisRanking.loading}
                    onCellSelect={onCellSelect}
                    onRangeSelect={onRangeSelect}
                    appleRecords={appleRanking.records}
                    appleWeekly={appleRanking.weekly}
                    appleWeekStart={appleRanking.weekStart}
                    appleRankingFailed={appleRanking.failed}
                    appleRankOpen={appleRank.open}
                    onToggleAppleRank={appleRank.toggle}
                    tetrisRecords={tetrisRanking.records}
                    tetrisSurvivalRecords={tetrisRanking.survival}
                    tetrisRankingFailed={tetrisRanking.failed}
                    tetrisRankOpen={tetrisRank.open}
                    onToggleTetrisRank={tetrisRank.toggle}
                />
            )}
        </div>
    );
}
