import { useCallback, useEffect, useRef, useState } from 'react';
import { AppleBoxRecord } from '../types';

const OPEN_STORAGE_KEY = 'study.appleRankOpen';

/**
 * 사과게임 랭킹 조회 — 주간과 누적을 함께 읽는다
 *
 * 게임 화면에서는 판 상태(gameData)에 랭킹이 함께 실려 오지만, 로비에서는 판을
 * 시작하지 않고 봐야 하므로 REST로 읽는다. 주간 랭킹은 서버에서 누적과 별도로
 * 관리되고 월요일마다 초기화된다.
 */
export function useAppleLeaderboard(limit = 10) {
    const [records, setRecords] = useState<AppleBoxRecord[]>([]);
    const [weekly, setWeekly] = useState<AppleBoxRecord[]>([]);
    const [weekStart, setWeekStart] = useState('');
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const aliveRef = useRef(true);

    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [allTime, thisWeek] = await Promise.all([
                fetch(`/api/apple/leaderboard?limit=${limit}`),
                fetch(`/api/apple/leaderboard/weekly?limit=${limit}`),
            ]);
            if (!allTime.ok || !thisWeek.ok) throw new Error('leaderboard request failed');
            const rows: AppleBoxRecord[] = await allTime.json();
            const week: { weekStart?: string; records?: AppleBoxRecord[] } = await thisWeek.json();
            if (!aliveRef.current) return;
            setRecords(Array.isArray(rows) ? rows : []);
            setWeekly(Array.isArray(week.records) ? week.records : []);
            setWeekStart(week.weekStart ?? '');
            setFailed(false);
        } catch {
            // 랭킹은 부가 정보이므로 실패해도 로비 자체는 그대로 쓸 수 있어야 한다
            if (aliveRef.current) setFailed(true);
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    }, [limit]);

    useEffect(() => { void reload(); }, [reload]);

    return { records, weekly, weekStart, loading, failed, reload };
}

/**
 * 랭킹 패널 펼침 상태
 *
 * 엑셀·VS Code 두 로비가 같은 선택을 공유하고, 새로 고침해도 유지되도록
 * localStorage에 남긴다.
 */
export function useAppleRankOpen() {
    const [open, setOpen] = useState(() => localStorage.getItem(OPEN_STORAGE_KEY) !== 'false');

    const toggle = useCallback(() => {
        setOpen((previous) => {
            const next = !previous;
            localStorage.setItem(OPEN_STORAGE_KEY, String(next));
            return next;
        });
    }, []);

    return { open, toggle };
}
