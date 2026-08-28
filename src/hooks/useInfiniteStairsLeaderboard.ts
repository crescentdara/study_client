import { useCallback, useEffect, useState } from 'react';

export interface InfiniteStairsRecord {
    rank: number;
    nickname: string;
    best: number;
    games: number;
    lastScore: number;
}

export function useInfiniteStairsLeaderboard(limit = 10) {
    const [records, setRecords] = useState<InfiniteStairsRecord[]>([]);
    const [weekStart, setWeekStart] = useState('');
    const [failed, setFailed] = useState(false);

    const reload = useCallback(async () => {
        try {
            const response = await fetch(`/api/infinite-stairs/leaderboard?limit=${limit}`);
            if (!response.ok) throw new Error('leaderboard request failed');
            const data: { records?: InfiniteStairsRecord[]; weekStart?: string } = await response.json();
            setRecords(Array.isArray(data.records) ? data.records : []);
            setWeekStart(data.weekStart ?? '');
            setFailed(false);
        } catch {
            setFailed(true);
        }
    }, [limit]);

    useEffect(() => { void reload(); }, [reload]);
    return { records, weekStart, failed, reload };
}
