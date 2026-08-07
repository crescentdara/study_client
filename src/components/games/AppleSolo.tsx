import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppleBoxGameData, StudyMoveRequest, StudyStateResponse } from '../../types';
import type { WorkspaceMode } from '../workspace/WorkspaceModeSwitch';
import AppleGame from './AppleGame';

/* ── 사과게임 혼자 하기 ───────────────────────────────────────────────────────
 * 사과게임은 상대를 기다릴 필요가 없어서 방(Room)을 쓰지 않는다. 버튼을 누르면
 * 그 순간 서버가 보드를 만들어 주고 바로 시작한다 — 그래서 '시작 전 대기' 상태가
 * 없고, 시작하자마자 끝나버리는 문제도 구조적으로 생기지 않는다.
 *
 * 점수는 개인 것이고, 판이 끝나면 서버가 닉네임별 최고 점수 랭킹에 저장한다.
 * 랭킹은 모두가 함께 보는 전체 순위다(파일로 남아 서버를 다시 켜도 유지된다).
 *
 * 이 컴포넌트는 REST 응답을 AppleGame이 기대하는 studyState 모양으로 바꿔주는
 * 얇은 어댑터다. 보드·드래그·랭킹 표시는 모두 AppleGame이 그대로 담당한다.
 * ──────────────────────────────────────────────────────────────────────── */

interface Props {
    nickname: string;
    workspaceMode?: WorkspaceMode;
    onCellSelect?: (address: string, value: string) => void;
    onClose: () => void;
}

interface SoloSnapshot {
    instanceId: string;
    nickname: string;
    finished: boolean;
    score: number;
    gameData: AppleBoxGameData;
}

const postJson = async (url: string, body: unknown): Promise<SoloSnapshot> => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(response.status === 410 ? 'EXPIRED' : `HTTP ${response.status}`);
    }
    return response.json();
};

export default function AppleSolo({ nickname, workspaceMode = 'vscode', onCellSelect, onClose }: Props) {
    const [snapshot, setSnapshot] = useState<SoloSnapshot | null>(null);
    const [error, setError] = useState('');
    const [starting, setStarting] = useState(false);

    const aliveRef = useRef(true);
    /** 빠르게 여러 번 정리했을 때 늦게 도착한 응답으로 되돌아가지 않도록 */
    const seqRef = useRef(0);
    // 판 중간에 프로필을 고쳐도 진행 중인 판이 다시 시작되지 않게 ref로 읽는다
    const nicknameRef = useRef(nickname);
    useEffect(() => { nicknameRef.current = nickname; }, [nickname]);

    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    const start = useCallback(async () => {
        setStarting(true);
        setError('');
        const seq = (seqRef.current += 1);
        try {
            const next = await postJson('/api/apple/start', { nickname: nicknameRef.current });
            if (!aliveRef.current || seq !== seqRef.current) return;
            setSnapshot(next);
        } catch {
            if (aliveRef.current) setError('게임을 시작하지 못했습니다. 서버 상태를 확인해 주세요.');
        } finally {
            if (aliveRef.current) setStarting(false);
        }
    }, []);

    // 열리는 순간 바로 한 판이 시작된다
    useEffect(() => { void start(); }, [start]);

    const sendMove = useCallback((move: StudyMoveRequest) => {
        const current = snapshot;
        if (!current) return;
        const seq = (seqRef.current += 1);

        const request = move.moveType === 'APPLE_FINISH'
            ? postJson('/api/apple/finish', { instanceId: current.instanceId })
            : postJson('/api/apple/clear', {
                instanceId: current.instanceId,
                ...(move.payload as Record<string, number>),
            });

        request
            .then((next) => {
                if (!aliveRef.current || seq !== seqRef.current) return;
                setSnapshot(next);
            })
            .catch((caught: Error) => {
                if (!aliveRef.current) return;
                setError(caught.message === 'EXPIRED'
                    ? '이 판은 만료됐습니다. 새로 시작해 주세요.'
                    : '서버와 통신하지 못했습니다.');
            });
    }, [snapshot]);

    const studyState: StudyStateResponse | null = useMemo(() => {
        if (!snapshot) return null;
        return {
            roomId: 'apple-solo',
            studyType: 'APPLE_BOX',
            status: snapshot.finished ? 'FINISHED' : 'PLAYING',
            message: '',
            currentTurn: 0,
            winner: 0,
            gameData: snapshot.gameData,
            playerNames: [snapshot.nickname],
        };
    }, [snapshot]);

    return (
        <div className="apple-solo">
            {error && (
                <div className="apple-solo__error">
                    <span>{error}</span>
                    <button type="button" onClick={() => void start()} disabled={starting}>
                        {starting ? '시작 중…' : '새 판 시작'}
                    </button>
                    <button type="button" onClick={onClose}>닫기</button>
                </div>
            )}
            <AppleGame
                studyState={studyState}
                sessionId="apple-solo"
                myPlayerIndex={0}
                sendMove={sendMove}
                workspaceMode={workspaceMode}
                onCellSelect={onCellSelect}
                onRestart={() => void start()}
                onClose={onClose}
                restarting={starting}
            />
        </div>
    );
}
