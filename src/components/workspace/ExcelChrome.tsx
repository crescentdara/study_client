import WeatherSearch from '../weather/WeatherSearch';

type OfficeIconName = 'excel' | 'save' | 'undo' | 'redo' | 'paste' | 'cut' | 'copy' | 'brush'
    | 'conditional' | 'table' | 'style' | 'insert' | 'delete' | 'format' | 'sum' | 'sort' | 'search' | 'addins'
    | 'camera' | 'switch';

function OfficeIcon({ name, size = 18 }: { name: OfficeIconName; size?: number }) {
    if (name === 'excel') {
        return (
            <svg className="office-icon excel-logo-icon" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
                <rect x="10" y="3" width="20" height="26" rx="2" fill="#21a366" />
                <path d="M18 3v26M10 10h20M10 17h20M10 24h20" stroke="#fff" strokeOpacity=".6" />
                <rect x="2" y="7" width="17" height="19" rx="1.5" fill="#107c41" />
                <path d="m7 12 7 9m0-9-7 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
        );
    }

    const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    const paths: Record<Exclude<OfficeIconName, 'excel'>, JSX.Element> = {
        save: <><path d="M4 3h13l3 3v15H4z" fill="#b54bb5" stroke="#7d2c87" strokeWidth="1.4" /><path d="M7 3v6h9V3M8 21v-7h8v7" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></>,
        undo: <><path {...common} d="M9 7 4 11l5 4" /><path {...common} d="M5 11h8a6 6 0 0 1 6 6" /></>,
        redo: <><path {...common} d="m15 7 5 4-5 4" /><path {...common} d="M19 11h-8a6 6 0 0 0-6 6" /></>,
        paste: <><path d="M5 6h14v15H5z" fill="#fff" stroke="#9b7622" strokeWidth="1.3" /><path d="M9 6V3h6v3" fill="#f4c04d" stroke="#9b7622" strokeWidth="1.5" /><path d="M8 11h8M8 15h8M8 18h5" stroke="#3f7f5b" strokeWidth="1.3" /></>,
        cut: <><circle cx="6" cy="7" r="3" fill="#d7edf9" stroke="#2780ac" strokeWidth="1.4" /><circle cx="6" cy="18" r="3" fill="#d7edf9" stroke="#2780ac" strokeWidth="1.4" /><path d="m8.5 9 11 10M8.5 16 19.5 6" fill="none" stroke="#555" strokeWidth="1.5" /></>,
        copy: <><rect x="7" y="7" width="13" height="14" rx="1" fill="#fff" stroke="#3180b7" strokeWidth="1.5" /><path d="M17 7V4H4v14h3" fill="#d9effa" stroke="#3180b7" strokeWidth="1.5" /></>,
        brush: <><path d="m5 16 10-10 4 4-10 10H5z" fill="#f7d06b" stroke="#9a6c13" strokeWidth="1.4" /><path d="M5 16c-3 1-2 4-2 5 2 0 5 0 6-2" fill="#e88932" stroke="#9a4b18" strokeWidth="1.2" /></>,
        conditional: <><rect x="3" y="4" width="18" height="16" rx="1" fill="#fff" stroke="#777" strokeWidth="1.2" /><path d="M5 5h4v14H5z" fill="#f05b61" /><path d="M10 5h4v14h-4z" fill="#ffd45c" /><path d="M15 5h4v14h-4z" fill="#62b77b" /><path d="M3 10h18M3 15h18" stroke="#fff" strokeWidth="1" /></>,
        table: <><rect x="3" y="4" width="18" height="16" rx="1" fill="#dceefa" stroke="#267db1" strokeWidth="1.3" /><path d="M3 9h18M9 9v11M15 9v11" fill="none" stroke="#267db1" strokeWidth="1.3" /><path d="M4 5h16v3H4z" fill="#2e8bc0" /></>,
        style: <><path d="M12 3 15 9l6 .8-4.5 4.3 1.2 6.2L12 17l-5.7 3.3 1.2-6.2L3 9.8 9 9z" fill="#f5ce54" stroke="#a77b12" strokeWidth="1.3" /></>,
        insert: <><rect x="3" y="4" width="15" height="16" fill="#e7f3ea" stroke="#3b8060" strokeWidth="1.3" /><path d="M3 9h15M8 9v11" stroke="#3b8060" strokeWidth="1.2" /><circle cx="19" cy="17" r="4.2" fill="#21a366" /><path d="M19 14.5v5m-2.5-2.5h5" stroke="#fff" strokeWidth="1.4" /></>,
        delete: <><rect x="3" y="4" width="15" height="16" fill="#fff0f0" stroke="#a85b5b" strokeWidth="1.3" /><path d="M3 9h15M8 9v11" stroke="#a85b5b" strokeWidth="1.2" /><circle cx="19" cy="17" r="4.2" fill="#d94b4b" /><path d="m16.7 14.7 4.6 4.6m0-4.6-4.6 4.6" stroke="#fff" strokeWidth="1.4" /></>,
        format: <><rect x="3" y="4" width="18" height="16" fill="#eef5fb" stroke="#397fa6" strokeWidth="1.3" /><path d="M3 9h18M9 9v11M15 9v11" stroke="#397fa6" strokeWidth="1.2" /><circle cx="18" cy="18" r="4" fill="#f3b34d" stroke="#9b6b1e" strokeWidth="1" /><path d="M18 15.8v4.4m-2.2-2.2h4.4" stroke="#fff" strokeWidth="1.2" /></>,
        sum: <><path d="M19 4H6l7 8-7 8h13" fill="none" stroke="#256c4a" strokeWidth="2" /></>,
        sort: <><path d="M7 4v16m0 0-3-3m3 3 3-3" stroke="#2377af" strokeWidth="1.8" fill="none" /><path d="M17 20V4m0 0-3 3m3-3 3 3" stroke="#d24c4c" strokeWidth="1.8" fill="none" /></>,
        search: <><circle cx="10" cy="10" r="6" fill="#fff" stroke="#555" strokeWidth="1.7" /><path d="m15 15 6 6" stroke="#217346" strokeWidth="2.3" /></>,
        addins: <><rect x="4" y="4" width="6" height="6" fill="#ef7651" /><rect x="14" y="4" width="6" height="6" fill="#f2b84b" /><rect x="4" y="14" width="6" height="6" fill="#57a9d3" /><path d="M17 14v7m-3.5-3.5h7" stroke="#21a366" strokeWidth="2" /></>,
        camera: <><path {...common} d="M4 7h4l1.5-2h5L16 7h4v12H4z" /><circle {...common} cx="12" cy="13" r="4" /></>,
        switch: <><rect {...common} x="3" y="5" width="18" height="14" /><path {...common} d="M7 9h10m0 0-3-3m3 3-3 3M17 15H7m0 0 3-3m-3 3 3 3" /></>,
    };
    return <svg className={`office-icon office-icon-${name}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function RibbonChevron({ size = 8 }: { size?: number }) {
    return (
        <svg className="excel-chevron" width={size} height={size} viewBox="0 0 8 8" aria-hidden="true">
            <path d="M1.25 2.75 4 5.35l2.75-2.6" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

interface ExcelChromeProps {
    onModeChange: (mode: 'vscode' | 'excel') => void;
    workbookName: string;
    activeCell: string;
    formulaText: string;
    fontFamily: string;
    onFontFamilyChange: (fontFamily: string) => void;
    onNoticeOpen?: () => void;
    onCalendarOpen?: () => void;
}

const EXCEL_FONT_OPTIONS = [
    { label: '맑은 고딕', value: '"Malgun Gothic", "맑은 고딕", sans-serif' },
    { label: 'Aptos', value: 'Aptos, "Segoe UI", sans-serif' },
    { label: 'Calibri', value: 'Calibri, "Segoe UI", sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: '굴림', value: 'Gulim, 굴림, sans-serif' },
    { label: '돋움', value: 'Dotum, 돋움, sans-serif' },
    { label: '바탕', value: 'Batang, 바탕, serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Consolas', value: 'Consolas, monospace' },
];

export default function ExcelChrome({ onModeChange, workbookName, activeCell, formulaText, fontFamily, onFontFamilyChange, onNoticeOpen, onCalendarOpen }: ExcelChromeProps) {
    return (
        <header className="excel-chrome">
            <div className="excel-titlebar">
                <div className="excel-quick-access" aria-label="빠른 실행 도구 모음">
                    <button className="excel-app-mark workspace-mode-trigger" type="button" onClick={() => onModeChange('vscode')} title="VS Code 화면으로 전환" aria-label="VS Code 화면으로 전환"><OfficeIcon name="excel" size={18} /></button>
                    <button type="button" title="통합 문서 전환" aria-label="통합 문서 전환"><OfficeIcon name="switch" size={18} /></button>
                    <button type="button" title="저장" aria-label="저장"><OfficeIcon name="save" size={18} /></button>
                    <button type="button" title="실행 취소" aria-label="실행 취소"><OfficeIcon name="undo" size={18} /></button>
                    <button type="button" title="다시 실행" aria-label="다시 실행"><OfficeIcon name="redo" size={18} /></button>
                    <button type="button" title="카메라" aria-label="카메라"><OfficeIcon name="camera" size={18} /></button>
                    <button className="excel-quick-more" type="button" aria-label="빠른 실행 도구 더 보기"><RibbonChevron /></button>
                    <div className="excel-workbook-title">
                        <strong>{workbookName} - Excel</strong>
                    </div>
                </div>
                <WeatherSearch variant="excel" />
                <div className="excel-title-controls">
                    <button className="excel-share-button" type="button">공유</button>
                    <span className="excel-account" aria-label="사용자">로그인</span>
                    <span className="excel-window-controls" aria-hidden="true"><b>—</b><b>□</b><b>×</b></span>
                </div>
            </div>

            <nav className="excel-menu" aria-label="Excel 메뉴">
                {['파일', '홈', '삽입', '그리기', '페이지 레이아웃', '수식', '데이터', '검토', '보기', '공지', '일정', '자동화', '도움말'].map(
                    (item, index) => (
                        <button key={item} type="button" className={index === 1 ? 'active' : ''} onClick={() => { if (item === '공지') onNoticeOpen?.(); if (item === '일정') onCalendarOpen?.(); }}>
                            {item}
                        </button>
                    ),
                )}
            </nav>

            <div className="excel-ribbon">
                <section className="excel-ribbon-clipboard">
                    <div className="excel-ribbon-body">
                        <button className="excel-ribbon-large" type="button"><span className="ribbon-icon"><OfficeIcon name="paste" size={27} /></span><em>붙여넣기 <RibbonChevron /></em></button>
                        <div className="excel-ribbon-stack">
                            <button type="button"><OfficeIcon name="cut" size={14} /> 잘라내기</button>
                            <button type="button"><OfficeIcon name="copy" size={14} /> 복사</button>
                            <button type="button"><OfficeIcon name="brush" size={14} /> 서식 복사</button>
                        </div>
                    </div>
                    <small>클립보드</small>
                </section>
                <section className="excel-ribbon-font">
                    <div className="excel-ribbon-body column">
                        <div className="excel-ribbon-fields">
                            <label className="excel-font-select" title="글꼴">
                                <span className="sr-only">글꼴</span>
                                <select value={fontFamily} onChange={(event) => onFontFamilyChange(event.target.value)}>
                                    {EXCEL_FONT_OPTIONS.map((font) => (
                                        <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>{font.label}</option>
                                    ))}
                                </select>
                            </label>
                            <button type="button" className="font-size">11 <RibbonChevron /></button>
                            <button type="button">A＋</button><button type="button">A−</button>
                        </div>
                        <div className="excel-ribbon-inline">
                            <button type="button"><b>굵게</b></button><button type="button"><i>기울임</i></button>
                            <button type="button"><u>밑줄</u></button><button type="button">▦ <RibbonChevron /></button>
                            <button type="button"><span className="fill-color">▰</span><RibbonChevron /></button>
                            <button type="button"><span className="text-color">가</span><RibbonChevron /></button>
                        </div>
                    </div>
                    <small>글꼴</small>
                </section>
                <section className="excel-ribbon-align">
                    <div className="excel-ribbon-body column">
                        <div className="excel-ribbon-inline">
                            <button type="button">≡</button><button type="button" className="pressed">≡</button><button type="button">≡</button>
                            <button type="button" className="wrap-text">↪ 자동 줄 바꿈</button>
                        </div>
                        <div className="excel-ribbon-inline">
                            <button type="button">⇤</button><button type="button">☰</button><button type="button">⇥</button>
                            <button type="button" className="wide">▣ 병합하고 가운데 맞춤 <RibbonChevron /></button>
                        </div>
                    </div>
                    <small>맞춤</small>
                </section>
                <section className="excel-ribbon-number">
                    <div className="excel-ribbon-body column">
                        <button type="button" className="number-format">일반 <RibbonChevron /></button>
                        <div className="excel-ribbon-inline">
                            <button type="button">₩ <RibbonChevron /></button><button type="button">%</button><button type="button">,</button>
                            <button type="button">.0←</button><button type="button">.00→</button>
                        </div>
                    </div>
                    <small>표시 형식</small>
                </section>
                <section className="excel-ribbon-style">
                    <div className="excel-ribbon-body">
                        <button className="excel-ribbon-tile" type="button"><span><OfficeIcon name="conditional" size={25} /></span><em>조건부<br />서식</em></button>
                        <button className="excel-ribbon-tile" type="button"><span><OfficeIcon name="table" size={25} /></span><em>표 서식</em></button>
                        <div className="excel-style-picker">
                            <div className="excel-style-gallery" aria-label="셀 스타일">
                                <button type="button"><span>표준</span></button><button className="style-bad" type="button"><span>나쁨</span></button><button className="style-neutral" type="button"><span>보통</span></button>
                                <button className="style-good" type="button"><span>좋음</span></button><button className="style-check" type="button"><span>경고문</span></button><button className="style-calc" type="button"><span>계산</span></button>
                            </div>
                            <button className="excel-gallery-more" type="button" aria-label="스타일 더 보기"><RibbonChevron /></button>
                        </div>
                    </div>
                    <small>스타일</small>
                </section>
                <section className="excel-ribbon-cells">
                    <div className="excel-ribbon-body">
                        <button className="excel-ribbon-tile" type="button"><span><OfficeIcon name="insert" size={25} /></span><em>삽입 <RibbonChevron /></em></button>
                        <button className="excel-ribbon-tile" type="button"><span><OfficeIcon name="delete" size={25} /></span><em>삭제 <RibbonChevron /></em></button>
                        <button className="excel-ribbon-tile" type="button"><span><OfficeIcon name="format" size={25} /></span><em>서식 <RibbonChevron /></em></button>
                    </div>
                    <small>셀</small>
                </section>
                <section className="excel-ribbon-edit">
                    <div className="excel-ribbon-body">
                        <button className="excel-ribbon-tile" type="button"><span><OfficeIcon name="sum" size={25} /></span><em>자동 합계 <RibbonChevron /></em></button>
                        <button className="excel-ribbon-tile" type="button"><span><OfficeIcon name="sort" size={25} /></span><em>정렬 및<br />필터</em></button>
                        <button className="excel-ribbon-tile" type="button"><span><OfficeIcon name="search" size={25} /></span><em>찾기 및<br />선택</em></button>
                    </div>
                    <small>편집</small>
                </section>
                <section className="excel-ribbon-addins">
                    <div className="excel-ribbon-body">
                        <button className="excel-ribbon-tile" type="button"><span><OfficeIcon name="addins" size={25} /></span><em>추가 기능<br />가져오기</em></button>
                    </div>
                    <small>추가 기능</small>
                    <button className="excel-ribbon-collapse" type="button" aria-label="리본 메뉴 접기"><RibbonChevron size={9} /></button>
                </section>
            </div>

            <div className="excel-formula-bar">
                <label>
                    <span className="sr-only">선택한 셀</span>
                    <input value={activeCell} readOnly />
                </label>
                <span className="excel-formula-drag" aria-hidden="true">⋮</span>
                <span className="excel-formula-actions" aria-hidden="true">
                    <b>×</b><b>✓</b><i>fx</i>
                </span>
                <label className="excel-formula-input">
                    <span className="sr-only">수식 입력줄</span>
                    <input value={formulaText} readOnly />
                </label>
            </div>
        </header>
    );
}
