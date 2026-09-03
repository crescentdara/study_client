import { FormEvent, useEffect, useRef, useState } from 'react';
import { useWeatherSearch } from './useWeatherSearch';

interface WeatherSearchProps {
    variant: 'vscode' | 'excel';
    onDrawingCommand?: (command: 'LOCK' | 'UNLOCK') => void;
}

const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
const formatForecastDate = (date: string, index: number) => {
    if (index === 0) return '오늘';
    const parsed = new Date(`${date}T00:00:00`);
    return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(parsed);
};

export default function WeatherSearch({ variant, onDrawingCommand }: WeatherSearchProps) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLFormElement>(null);
    const { result, error, loading, search, clear } = useWeatherSearch();

    useEffect(() => {
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOnOutsideClick);
        return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
    }, []);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const command = query.trim();
        if (command === '펜압수' || command === '펜압수해제') {
            onDrawingCommand?.(command === '펜압수' ? 'LOCK' : 'UNLOCK');
            setQuery('');
            clear();
            setOpen(false);
            return;
        }
        setOpen(true);
        void search(query);
    };

    const showPopover = open && (loading || Boolean(error) || Boolean(result));
    const placeholder = variant === 'excel' ? '서울날씨 · 내동네날씨' : 'study-platform · 서울날씨 · 내동네날씨';

    return (
        <form
            ref={rootRef}
            className={`weather-search weather-search--${variant} ${variant === 'excel' ? 'excel-title-search' : ''}`}
            onSubmit={submit}
            role="search"
        >
            <span className="weather-search-icon" aria-hidden="true">⌕</span>
            <input
                aria-label="지역 날씨 검색"
                value={query}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
                onFocus={() => {
                    if (loading || error || result) setOpen(true);
                }}
                onChange={(event) => {
                    setQuery(event.target.value);
                    if (loading || error || result) clear();
                    setOpen(false);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.stopPropagation();
                        setOpen(false);
                        event.currentTarget.blur();
                    }
                }}
            />
            {loading && <span className="weather-search-spinner" aria-label="날씨 조회 중" />}
            {showPopover && (
                <section className="weather-result-popover" aria-live="polite">
                    {loading && <div className="weather-result-loading">날씨 데이터를 불러오는 중…</div>}
                    {!loading && error && <div className="weather-result-error" role="alert">{error}</div>}
                    {!loading && result && (
                        <>
                            <header>
                                <span className="weather-result-icon" aria-hidden="true">{result.weatherIcon}</span>
                                <div>
                                    <strong>{result.location}</strong>
                                    <small>{result.detail || '대한민국'}</small>
                                </div>
                                <b>{formatNumber(result.temperature)}°C</b>
                            </header>
                            <section className="weather-result-section weather-current-section">
                                <h3>현재 날씨</h3>
                                <div className="weather-result-summary">
                                    <strong>{result.weatherLabel}</strong>
                                    <span>체감 {formatNumber(result.apparentTemperature)}°C</span>
                                </div>
                                <dl>
                                    <div><dt>강수확률</dt><dd>{result.precipitationProbability === null ? '-' : `${result.precipitationProbability}%`}</dd></div>
                                    <div><dt>강수량</dt><dd>{formatNumber(result.precipitation)} mm</dd></div>
                                    <div><dt>풍속</dt><dd>{formatNumber(result.windSpeed)} km/h</dd></div>
                                </dl>
                            </section>
                            <section className="weather-result-section">
                                <h3>시간별 예보 · 앞으로 12시간</h3>
                                <div className="weather-hourly-list">
                                    {result.hourly.map((forecast, index) => (
                                        <article key={forecast.time}>
                                            <time>{index === 0 ? '현재' : forecast.time.slice(11, 16)}</time>
                                            <span aria-hidden="true">{forecast.weatherIcon}</span>
                                            <strong>{formatNumber(forecast.temperature)}°</strong>
                                            <small>{forecast.precipitationProbability === null ? '-' : `💧${forecast.precipitationProbability}%`}</small>
                                        </article>
                                    ))}
                                </div>
                            </section>
                            <section className="weather-result-section">
                                <h3>일자별 예보 · 7일</h3>
                                <div className="weather-daily-list">
                                    {result.daily.map((forecast, index) => (
                                        <article key={forecast.date}>
                                            <time>{formatForecastDate(forecast.date, index)}</time>
                                            <span className="weather-daily-condition"><i aria-hidden="true">{forecast.weatherIcon}</i>{forecast.weatherLabel}</span>
                                            <strong>{formatNumber(forecast.temperatureMin)}° / <b>{formatNumber(forecast.temperatureMax)}°</b></strong>
                                            <small>{forecast.precipitationProbability === null ? '-' : `💧 ${forecast.precipitationProbability}%`}</small>
                                        </article>
                                    ))}
                                </div>
                            </section>
                            <footer>
                                <span>{result.observedAt ? `${result.observedAt.slice(11)} 기준` : '현재 기준'}</span>
                                <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>
                            </footer>
                        </>
                    )}
                </section>
            )}
        </form>
    );
}
