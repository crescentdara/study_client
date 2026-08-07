import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWeather, parseWeatherQuery, WeatherResult } from './weatherApi';

export function useWeatherSearch() {
    const [result, setResult] = useState<WeatherResult | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const requestRef = useRef<AbortController | null>(null);

    const clear = useCallback(() => {
        requestRef.current?.abort();
        requestRef.current = null;
        setResult(null);
        setError('');
        setLoading(false);
    }, []);

    const search = useCallback(async (query: string) => {
        const location = parseWeatherQuery(query);
        if (!location) {
            setResult(null);
            setError('지역명 뒤에 “날씨”를 붙여주세요. 예: 부산날씨');
            return;
        }

        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            setResult(await fetchWeather(location, controller.signal));
        } catch (caught) {
            if (controller.signal.aborted) return;
            setError(caught instanceof Error ? caught.message : '날씨 정보를 불러오지 못했습니다.');
        } finally {
            if (requestRef.current === controller) {
                requestRef.current = null;
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => () => requestRef.current?.abort(), []);

    return { result, error, loading, search, clear };
}
