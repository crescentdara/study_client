import { useEffect, useMemo, useState } from 'react';
import { CreateRoomRequest, Room, StudyType } from '../../types';

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
}

const GRID_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function InteractiveTaskGrid({ nickname, rooms, activePeople, onJoin, onRefresh, onCreate, loading, onCellSelect, onRangeSelect }: InteractiveTaskGridProps) {
    const [selected, setSelected] = useState('A1');
    const [dragAnchor, setDragAnchor] = useState('A1');
    const [dragEnd, setDragEnd] = useState('A1');
    const [dragging, setDragging] = useState(false);
    const [edits, setEdits] = useState<Record<string, string>>({});

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
        const capacity = room.studyType === 'TETRIS' ? 3 : room.maxPlayers;
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
                                contentEditable={!cell.readOnly && !cell.action}
                                suppressContentEditableWarning
                                data-address={address}
                                onFocus={() => select(address, value)}
                                onMouseDown={(event) => {
                                    if (event.button !== 0) return;
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
    const [error, setError] = useState('');

    const activePeople = useMemo(
        () => new Set(rooms.flatMap((room) => room.playerNames ?? [])).size,
        [rooms],
    );

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
                maxPlayers: studyType === 'TETRIS' ? 3 : studyType === 'OMOK' ? 2 : maxPlayers,
                digits,
                boardSize: studyType === 'TETRIS' ? 20 : studyType === 'OMOK' ? 19 : studyType === 'ALKKAGI' || studyType === 'OLDMAID' ? 0 : boardSize,
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

            <div className={`excel-sheet-heading ${showCreate ? '' : 'lobby-summary-heading'}`}>
                <div>
                    <span>플랫폼개발팀</span>
                    <h1>{showCreate ? '신규 업무 등록서' : '주간 운영 업무 현황'}</h1>
                    <p>내부 검토용 · 외부 공유 금지</p>
                </div>
                <div className="excel-sheet-actions">
                    {!showCreate && (
                        <>
                            <button type="button" onClick={fetchRooms} disabled={loading}>
                                {loading ? '새로 고치는 중…' : '↻ 자료 새로고침'}
                            </button>
                            <button type="button" className="primary" onClick={() => setShowCreate(true)}>
                                ＋ 신규 업무 등록
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showCreate ? (
                <>
                    <div className="excel-sheet-meta">
                        <b>기준일</b><span>2026-07-31</span>
                        <b>작성 부서</b><span>플랫폼개발팀</span>
                        <b>작성자</b><span>{nickname || '미지정'}</span>
                        <b>문서 상태</b><span className="status-review">검토 중</span>
                    </div>
                    <div className="excel-entry-form">
                        <div className="excel-section-title">1. 기본 정보</div>
                        <label><b>업무명</b><input autoFocus value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="업무명을 입력하세요" maxLength={20} /></label>
                        <label>
                            <b>업무 구분</b>
                            <select value={studyType} onChange={(event) => configureType(event.target.value as StudyType, setStudyType, setMaxPlayers, setBoardSize, setDigits)}>
                                {STUDY_TYPES.map((type) => <option key={type} value={type}>{BUSINESS_LABELS[type]}</option>)}
                            </select>
                        </label>
                        <label><b>참여 인원</b><input type="number" min={1} max={7} value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))} /></label>
                        {studyType === 'BASEBALL' && <label><b>검산 자릿수</b><input type="number" min={3} max={5} value={digits} onChange={(event) => setDigits(Number(event.target.value))} /></label>}
                        {studyType === 'BINGO' && <label><b>체크 항목</b><input type="number" min={3} max={7} value={boardSize} onChange={(event) => setBoardSize(Number(event.target.value))} /></label>}
                        <div className="excel-form-note">
                            <b>검토 메모</b>
                            <span>등록 후 참여자를 확인하고 업무를 시작해 주세요. 작성 내용은 현재 접속자에게 즉시 반영됩니다.</span>
                        </div>
                        <div className="excel-entry-actions">
                            <button type="button" onClick={() => setShowCreate(false)}>취소</button>
                            <button type="button" className="primary" onClick={handleCreate} disabled={creating}>{creating ? '등록 중…' : '업무 등록'}</button>
                        </div>
                    </div>
                </>
            ) : (
                <InteractiveTaskGrid
                    nickname={nickname}
                    rooms={rooms}
                    activePeople={activePeople}
                    onJoin={onJoin}
                    onRefresh={fetchRooms}
                    onCreate={() => setShowCreate(true)}
                    loading={loading}
                    onCellSelect={onCellSelect}
                    onRangeSelect={onRangeSelect}
                />
            )}
        </div>
    );
}
