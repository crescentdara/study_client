import { useCallback, useEffect, useRef, useState } from 'react';
import { TetrisRankRow } from '../types';

const OPEN_STORAGE_KEY = 'study.tetrisRankOpen';

/**
 * 테트리스 티어 순위 조회
 *
 * 판 안에서는 방 상태(gameData.records)로 전적이 내려오지만, 로비에서는 방에
 * 들어가지 않고 봐야 하므로 REST(/api/tetris/leaderboard)로 읽는다.
 */
export function useTetrisLeaderboard(limit = 10) {
    const [records, setRecords] = useState<TetrisRankRow[]>([]);
    const [survival, setSurvival] = useState<TetrisRankRow[]>([]);
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
            // 대전과 서바이벌은 서로 다른 장부라 각각 조회한다
            const [versus, endurance] = await Promise.all([
                fetch(`/api/tetris/leaderboard?limit=${limit}`),
                fetch(`/api/tetris/survival/leaderboard?limit=${limit}`),
            ]);
            if (!versus.ok || !endurance.ok) throw new Error('tetris leaderboard request failed');
            const versusRows: TetrisRankRow[] = await versus.json();
            const survivalRows: TetrisRankRow[] = await endurance.json();
            if (!aliveRef.current) return;
            setRecords(Array.isArray(versusRows) ? versusRows : []);
            setSurvival(Array.isArray(survivalRows) ? survivalRows : []);
            setFailed(false);
        } catch {
            // 전적은 부가 정보이므로 실패해도 로비 자체는 그대로 쓸 수 있어야 한다
            if (aliveRef.current) setFailed(true);
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    }, [limit]);

    useEffect(() => { void reload(); }, [reload]);

    return { records, survival, loading, failed, reload };
}

/** 전적 패널 펼침 상태 — 두 로비가 공유하고 새로 고침해도 유지된다 */
export function useTetrisRankOpen() {
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

/** "SILVER III" 같은 표시용 티어 문자열 (배치 중이면 진행 수를 보여준다) */
export function tierLabel(row: TetrisRankRow) {
    if (!row.ranked) return `배치 ${row.placementGames}/${row.placementRequired}`;
    return row.division ? `${row.tier} ${row.division}` : row.tier;
}
