import { useCallback, useEffect, useRef, useState } from 'react';

const CHECK_INTERVAL_MS = 15_000;
/** 새로고침 전에 안내를 읽을 여유 */
const RELOAD_DELAY_MS = 2_500;

/**
 * 서버 재배포를 감지해 화면을 새로 불러온다.
 *
 * 방·게임·로비 채팅 상태는 모두 서버 메모리에 있어서 재시작하면 사라진다. 그래서 열어
 * 둔 화면은 재배포 순간부터 없는 방을 붙잡고 있는 상태가 되고, 채팅창만 보고 있던
 * 사람도 끊긴 세션을 그대로 들고 있게 된다. 서버가 새로 떴다는 걸 알면 새로고침해서
 * 처음부터 다시 잡게 한다.
 *
 * 판단 기준은 서버가 뜰 때마다 바뀌는 bootId다. '연결이 끊겼다'를 기준으로 삼으면
 * 배포 중 잠깐의 끊김에도 새로고침이 반복되므로, 조회가 실패하면 아무것도 하지 않고
 * 다음 확인을 기다린다.
 *
 * @returns 새로고침이 예약됐는지 (안내를 띄우기 위한 값)
 */
export function useServerRedeployReload() {
    const [pending, setPending] = useState(false);
    /** 처음 확인한 서버의 bootId — 이 값과 달라지면 재배포된 것 */
    const bootIdRef = useRef<string | null>(null);
    const reloadingRef = useRef(false);

    const check = useCallback(async () => {
        if (reloadingRef.current) return;
        try {
            const response = await fetch('/api/server/instance', { cache: 'no-store' });
            if (!response.ok) return;
            const { bootId } = (await response.json()) as { bootId?: string };
            if (!bootId) return;
            if (bootIdRef.current === null) {
                bootIdRef.current = bootId; // 첫 조회는 기준점만 잡는다
                return;
            }
            if (bootIdRef.current === bootId) return;

            reloadingRef.current = true;
            setPending(true);
            window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
        } catch {
            // 재배포 중이라 잠깐 닿지 않는 상태 — 새로고침하지 않고 다음 확인을 기다린다
        }
    }, []);

    useEffect(() => {
        void check();
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') void check();
        }, CHECK_INTERVAL_MS);
        // 탭을 다시 열거나 네트워크가 돌아오면 그 즉시 확인한다
        const recheck = () => { if (document.visibilityState === 'visible') void check(); };
        document.addEventListener('visibilitychange', recheck);
        window.addEventListener('online', recheck);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', recheck);
            window.removeEventListener('online', recheck);
        };
    }, [check]);

    return pending;
}
