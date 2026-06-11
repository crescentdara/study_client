import { useState, useEffect, useRef } from 'react';

const COLORS = ['#569cd6', '#4ec9b0', '#ce9178', '#dcdcaa', '#9cdcfe', '#c586c0', '#b5cea8'];

// 난이도별 가중치: [단어, 가중치] — 가중치 높을수록 더 자주 등장
const WEIGHTED_WORDS: [string, number][] = [
    // ── 쉬움 (짧은 JS 키워드) ─────────────────────────────── weight 4
    ['let', 4], ['var', 4], ['const', 4], ['async', 4], ['await', 4],
    ['fetch', 4], ['class', 4], ['throw', 4], ['catch', 4], ['yield', 4],
    ['typeof', 4], ['delete', 4], ['return', 4], ['switch', 4], ['import', 4],
    ['export', 4], ['static', 4], ['extends', 4], ['instanceof', 3],

    // ── 보통 (메서드명) ───────────────────────────────────── weight 3
    ['parseInt', 3], ['parseFloat', 3], ['isNaN', 3], ['isFinite', 3],
    ['clearTimeout', 3], ['clearInterval', 3], ['setTimeout', 3], ['setInterval', 3],
    ['encodeURIComponent', 2], ['decodeURIComponent', 2],
    ['structuredClone', 2], ['requestAnimationFrame', 1],

    // ── console ───────────────────────────────────────────── weight 3
    ['console.log', 3], ['console.error', 3], ['console.warn', 3],
    ['console.table', 2], ['console.dir', 3], ['console.time', 3],
    ['console.assert', 2], ['console.group', 2],

    // ── Array ─────────────────────────────────────────────── weight 3
    ['Array.from', 3], ['Array.isArray', 3], ['Array.of', 3],
    ['.map', 3], ['.filter', 3], ['.reduce', 3], ['.forEach', 3],
    ['.find', 3], ['.findIndex', 3], ['.includes', 3], ['.indexOf', 3],
    ['.flat', 3], ['.flatMap', 3], ['.every', 3], ['.some', 3],
    ['.sort', 3], ['.reverse', 3], ['.slice', 3], ['.splice', 3],
    ['.concat', 3], ['.join', 3], ['.push', 3], ['.pop', 3],
    ['.shift', 3], ['.unshift', 3], ['.fill', 3], ['.copyWithin', 2],
    ['.at', 3], ['.entries', 3], ['.keys', 3], ['.values', 3],

    // ── Object ────────────────────────────────────────────── weight 3
    ['Object.keys', 3], ['Object.values', 3], ['Object.entries', 3],
    ['Object.assign', 3], ['Object.freeze', 3], ['Object.create', 3],
    ['Object.defineProperty', 1], ['Object.fromEntries', 2],
    ['Object.getPrototypeOf', 1], ['Object.hasOwn', 2],

    // ── JSON / Math ───────────────────────────────────────── weight 3
    ['JSON.parse', 3], ['JSON.stringify', 3],
    ['Math.floor', 3], ['Math.ceil', 3], ['Math.round', 3],
    ['Math.random', 3], ['Math.max', 3], ['Math.min', 3],
    ['Math.abs', 3], ['Math.sqrt', 3], ['Math.pow', 3],
    ['Math.trunc', 2], ['Math.sign', 2], ['Math.log', 3],

    // ── Promise ───────────────────────────────────────────── weight 2
    ['Promise.all', 2], ['Promise.race', 2], ['Promise.resolve', 2],
    ['Promise.reject', 2], ['Promise.allSettled', 1], ['Promise.any', 2],
    ['.then', 3], ['.catch', 3], ['.finally', 3],

    // ── String ────────────────────────────────────────────── weight 3
    ['.toString', 3], ['.toUpperCase', 2], ['.toLowerCase', 2],
    ['.trim', 3], ['.trimStart', 2], ['.trimEnd', 2],
    ['.split', 3], ['.replace', 3], ['.replaceAll', 2],
    ['.startsWith', 2], ['.endsWith', 2], ['.includes', 3],
    ['.padStart', 2], ['.padEnd', 2], ['.repeat', 3],
    ['.charAt', 3], ['.charCodeAt', 2], ['.substring', 2],
    ['.indexOf', 3], ['.lastIndexOf', 2], ['.match', 3],
    ['.matchAll', 2], ['.search', 3], ['.slice', 3],

    // ── DOM / Web API ─────────────────────────────────────── weight 2
    ['querySelector', 2], ['querySelectorAll', 1],
    ['getElementById', 2], ['getElementsByClassName', 1],
    ['addEventListener', 2], ['removeEventListener', 2],
    ['dispatchEvent', 2], ['createElement', 2],
    ['appendChild', 2], ['removeChild', 2], ['replaceChild', 2],
    ['getAttribute', 2], ['setAttribute', 2], ['removeAttribute', 2],
    ['classList.add', 2], ['classList.remove', 2], ['classList.toggle', 2],
    ['localStorage.getItem', 1], ['localStorage.setItem', 1],
    ['sessionStorage.getItem', 1], ['sessionStorage.setItem', 1],
    ['history.pushState', 1], ['location.reload', 1],

    // ── Number / 기타 ─────────────────────────────────────── weight 2
    ['Number.isNaN', 2], ['Number.isInteger', 2], ['Number.isFinite', 2],
    ['Number.parseInt', 2], ['Number.parseFloat', 2],
    ['.toFixed', 3], ['.toPrecision', 2],
    ['Symbol.iterator', 1], ['Symbol.toPrimitive', 1],
    ['Reflect.apply', 1], ['Reflect.ownKeys', 1],
    ['WeakMap', 2], ['WeakSet', 2], ['WeakRef', 1],
    ['Proxy', 2], ['Reflect', 2], ['Generator', 1],
];

// 가중치 전개로 실제 풀 생성
const WORD_POOL: string[] = WEIGHTED_WORDS.flatMap(([w, n]) => Array(n).fill(w));

const DESC: Record<string, string> = {
    // 키워드
    'let': '재할당 가능한 블록 스코프 변수 선언',
    'var': '함수 스코프 변수 선언 (호이스팅 발생)',
    'const': '재할당 불가 블록 스코프 상수 선언',
    'async': '비동기 함수 선언 — Promise를 반환',
    'await': 'Promise가 완료될 때까지 실행 대기',
    'fetch': 'HTTP 요청을 보내 Promise를 반환',
    'class': '객체 생성을 위한 클래스 선언',
    'throw': '에러를 강제로 발생시킴',
    'catch': 'try 블록에서 발생한 예외를 잡음',
    'yield': '제너레이터 함수에서 값을 하나씩 반환',
    'typeof': '값의 타입을 문자열로 반환',
    'delete': '객체의 프로퍼티를 삭제',
    'return': '함수에서 값을 반환하고 실행 종료',
    'switch': '여러 경우의 수를 분기 처리',
    'import': '다른 모듈에서 값/함수를 불러옴',
    'export': '현재 모듈의 값/함수를 외부에 내보냄',
    'static': '클래스 인스턴스 없이 호출 가능한 멤버',
    'extends': '다른 클래스를 상속받아 확장',
    'instanceof': '객체가 특정 클래스의 인스턴스인지 확인',
    // 전역 함수
    'parseInt': '문자열을 정수로 변환',
    'parseFloat': '문자열을 부동소수점 숫자로 변환',
    'isNaN': '값이 NaN인지 확인',
    'isFinite': '값이 유한수인지 확인',
    'clearTimeout': 'setTimeout으로 등록한 타이머를 취소',
    'clearInterval': 'setInterval로 등록한 반복 타이머를 취소',
    'setTimeout': '일정 시간 후 함수를 한 번 실행',
    'setInterval': '일정 간격마다 함수를 반복 실행',
    'encodeURIComponent': 'URI 구성 요소를 인코딩',
    'decodeURIComponent': '인코딩된 URI 구성 요소를 디코딩',
    'structuredClone': '객체를 깊은 복사(deep clone)',
    'requestAnimationFrame': '다음 화면 렌더링 전에 함수를 실행',
    // console
    'console.log': '값을 콘솔에 출력',
    'console.error': '에러 메시지를 콘솔에 빨간색으로 출력',
    'console.warn': '경고 메시지를 콘솔에 출력',
    'console.table': '배열/객체를 표 형태로 출력',
    'console.dir': '객체의 속성을 트리 형태로 출력',
    'console.time': '코드 실행 시간 측정 시작',
    'console.assert': '조건이 false일 때만 에러 메시지 출력',
    'console.group': '콘솔 출력을 그룹으로 묶어 접을 수 있게 표시',
    // Array
    'Array.from': '유사 배열/이터러블을 배열로 변환',
    'Array.isArray': '값이 배열인지 확인',
    'Array.of': '인자들로 새 배열을 생성',
    '.map': '각 요소에 함수를 적용해 새 배열 반환',
    '.filter': '조건을 만족하는 요소만 골라 새 배열 반환',
    '.reduce': '배열을 하나의 값으로 누적 계산',
    '.forEach': '각 요소에 함수를 실행 (반환값 없음)',
    '.find': '조건을 만족하는 첫 번째 요소 반환',
    '.findIndex': '조건을 만족하는 첫 번째 요소의 인덱스 반환',
    '.includes': '배열에 특정 값이 있는지 확인',
    '.indexOf': '특정 값의 첫 번째 인덱스 반환 (없으면 -1)',
    '.flat': '중첩 배열을 지정 깊이만큼 평탄화',
    '.flatMap': '.map 후 1단계 flat을 합친 것',
    '.every': '모든 요소가 조건을 만족하는지 확인',
    '.some': '하나라도 조건을 만족하는 요소가 있는지 확인',
    '.sort': '배열을 정렬 (기본값: 문자열 오름차순)',
    '.reverse': '배열 요소 순서를 뒤집음',
    '.slice': '배열의 일부를 잘라 새 배열 반환',
    '.splice': '배열 요소를 추가·제거·교체',
    '.concat': '배열을 합쳐 새 배열 반환',
    '.join': '배열 요소를 구분자로 이어 문자열로 반환',
    '.push': '배열 끝에 요소를 추가하고 길이 반환',
    '.pop': '배열 마지막 요소를 제거하고 반환',
    '.shift': '배열 첫 번째 요소를 제거하고 반환',
    '.unshift': '배열 앞에 요소를 추가하고 길이 반환',
    '.fill': '배열을 특정 값으로 채움',
    '.copyWithin': '배열 내부 요소를 다른 위치에 복사',
    '.at': '음수 인덱스를 지원하는 요소 접근',
    '.entries': '인덱스-값 쌍의 이터레이터 반환',
    '.keys': '인덱스의 이터레이터 반환',
    '.values': '값의 이터레이터 반환',
    // Object
    'Object.keys': '객체의 키 목록을 배열로 반환',
    'Object.values': '객체의 값 목록을 배열로 반환',
    'Object.entries': '객체의 [키, 값] 쌍 배열 반환',
    'Object.assign': '여러 객체를 하나로 병합',
    'Object.freeze': '객체를 동결해 수정 불가로 만듦',
    'Object.create': '지정한 프로토타입으로 새 객체 생성',
    'Object.defineProperty': '객체의 속성을 세밀하게 정의',
    'Object.fromEntries': '[키, 값] 쌍 배열을 객체로 변환',
    'Object.getPrototypeOf': '객체의 프로토타입을 반환',
    'Object.hasOwn': '객체가 해당 키를 직접 갖고 있는지 확인',
    // JSON
    'JSON.parse': 'JSON 문자열을 JavaScript 객체로 변환',
    'JSON.stringify': 'JavaScript 객체를 JSON 문자열로 변환',
    // Math
    'Math.floor': '소수점 이하를 버림 (내림)',
    'Math.ceil': '소수점 이하를 올림',
    'Math.round': '소수점 이하를 반올림',
    'Math.random': '0 이상 1 미만의 난수 반환',
    'Math.max': '인자 중 가장 큰 값 반환',
    'Math.min': '인자 중 가장 작은 값 반환',
    'Math.abs': '절댓값 반환',
    'Math.sqrt': '제곱근 반환',
    'Math.pow': '거듭제곱 반환',
    'Math.trunc': '소수점 이하를 제거 (0 방향으로 버림)',
    'Math.sign': '값의 부호를 -1, 0, 1로 반환',
    'Math.log': '자연로그(ln) 값 반환',
    // Promise
    'Promise.all': '모든 Promise가 완료될 때까지 대기',
    'Promise.race': '가장 먼저 완료된 Promise 결과 반환',
    'Promise.resolve': '성공 상태의 Promise 즉시 생성',
    'Promise.reject': '실패 상태의 Promise 즉시 생성',
    'Promise.allSettled': '모든 Promise의 성공/실패 결과를 모아 반환',
    'Promise.any': '하나라도 성공하면 그 결과 반환',
    '.then': 'Promise 성공 시 실행할 콜백 등록',
    '.finally': 'Promise 성공/실패 관계없이 항상 실행',
    // String
    '.toString': '값을 문자열로 변환',
    '.toUpperCase': '문자열을 모두 대문자로 변환',
    '.toLowerCase': '문자열을 모두 소문자로 변환',
    '.trim': '문자열 앞뒤 공백 제거',
    '.trimStart': '문자열 앞쪽 공백 제거',
    '.trimEnd': '문자열 뒤쪽 공백 제거',
    '.split': '구분자를 기준으로 문자열을 배열로 분할',
    '.replace': '첫 번째로 일치하는 부분을 교체',
    '.replaceAll': '일치하는 모든 부분을 교체',
    '.startsWith': '문자열이 특정 문자로 시작하는지 확인',
    '.endsWith': '문자열이 특정 문자로 끝나는지 확인',
    '.padStart': '문자열 앞을 지정 길이까지 채움',
    '.padEnd': '문자열 뒤를 지정 길이까지 채움',
    '.repeat': '문자열을 지정 횟수만큼 반복',
    '.charAt': '특정 인덱스의 문자 반환',
    '.charCodeAt': '특정 인덱스 문자의 UTF-16 코드 반환',
    '.substring': '두 인덱스 사이의 부분 문자열 반환',
    '.lastIndexOf': '특정 값의 마지막 인덱스 반환',
    '.match': '정규식과 일치하는 결과 배열 반환',
    '.matchAll': '정규식과 일치하는 모든 결과 이터레이터 반환',
    '.search': '정규식과 처음 일치하는 인덱스 반환',
    // DOM
    'querySelector': 'CSS 선택자로 첫 번째 요소 반환',
    'querySelectorAll': 'CSS 선택자와 일치하는 모든 요소 반환',
    'getElementById': 'id로 DOM 요소를 찾아 반환',
    'getElementsByClassName': '클래스명으로 DOM 요소들을 반환',
    'addEventListener': '요소에 이벤트 리스너를 등록',
    'removeEventListener': '등록된 이벤트 리스너를 제거',
    'dispatchEvent': '요소에 이벤트를 직접 발생시킴',
    'createElement': '지정한 태그의 새 DOM 요소 생성',
    'appendChild': '부모 요소의 자식 끝에 노드 추가',
    'removeChild': '부모 요소에서 자식 노드를 제거',
    'replaceChild': '부모 요소의 자식 노드를 다른 노드로 교체',
    'getAttribute': '요소의 속성 값을 문자열로 반환',
    'setAttribute': '요소의 속성 값을 설정',
    'removeAttribute': '요소의 속성을 제거',
    'classList.add': '요소에 클래스 추가',
    'classList.remove': '요소에서 클래스 제거',
    'classList.toggle': '클래스가 없으면 추가, 있으면 제거',
    'localStorage.getItem': '로컬스토리지에서 값을 읽어옴',
    'localStorage.setItem': '로컬스토리지에 값을 저장',
    'sessionStorage.getItem': '세션스토리지에서 값을 읽어옴',
    'sessionStorage.setItem': '세션스토리지에 값을 저장',
    'history.pushState': '브라우저 히스토리에 새 항목 추가',
    'location.reload': '현재 페이지를 새로고침',
    // Number / 기타
    'Number.isNaN': '값이 정확히 NaN인지 확인 (전역 isNaN보다 엄격)',
    'Number.isInteger': '값이 정수인지 확인',
    'Number.isFinite': '값이 유한수인지 확인 (전역 isFinite보다 엄격)',
    'Number.parseInt': '문자열을 정수로 변환 (전역 parseInt와 동일)',
    'Number.parseFloat': '문자열을 부동소수점으로 변환',
    '.toFixed': '소수점 이하 자릿수를 고정해 문자열로 반환',
    '.toPrecision': '유효 숫자 자릿수를 지정해 문자열로 반환',
    'Symbol.iterator': '객체의 기본 이터레이터를 정의하는 심볼',
    'Symbol.toPrimitive': '객체의 원시값 변환 방식을 정의하는 심볼',
    'Reflect.apply': '함수를 특정 this와 인자로 호출',
    'Reflect.ownKeys': '객체의 모든 자체 키 배열 반환 (심볼 포함)',
    'WeakMap': '키가 약한 참조인 Map (GC 대상)',
    'WeakSet': '약한 참조로 객체를 저장하는 Set',
    'WeakRef': '객체에 대한 약한 참조 생성',
    'Proxy': '객체의 기본 동작을 가로채 커스터마이징',
    'Reflect': '객체의 기본 동작을 그대로 수행하는 내장 객체',
    'Generator': '이터레이터를 생성하는 특수 함수',
};

interface Word {
    id: number;
    text: string;
    x: number;
    y: number;
    speed: number;
    color: string;
}

interface Props {
    visible: boolean;
    registerHandler: (fn: ((word: string) => void) | null) => void;
    onClose: () => void;
    onRestart: () => void;
    onTermOutput: (line: { type: 'out' | 'err'; text: string }) => void;
}

let _nextId = 0;

export default function WordRain({ visible, registerHandler, onClose, onRestart, onTermOutput }: Props) {
    const [words, setWords] = useState<Word[]>([]);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [level, setLevel] = useState(1);
    const [gameOver, setGameOver] = useState(false);

    const wordsRef = useRef<Word[]>([]);
    const scoreRef = useRef(0);
    const livesRef = useRef(3);
    const levelRef = useRef(1);
    const gameOverRef = useRef(false);
    const pausedRef = useRef(false);
    const rafRef = useRef(0);
    const spawnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTimeRef = useRef<number | null>(null);
    const tickFnRef = useRef<((time: number) => void) | null>(null);
    const spawnFnRef = useRef<(() => void) | null>(null);
    const onTermOutputRef = useRef(onTermOutput);
    const onCloseRef = useRef(onClose);
    const onRestartRef = useRef(onRestart);

    useEffect(() => { onTermOutputRef.current = onTermOutput; }, [onTermOutput]);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    useEffect(() => { onRestartRef.current = onRestart; }, [onRestart]);

    // 숨김/표시 시 게임 루프 일시정지·재개
    useEffect(() => {
        pausedRef.current = !visible;
        if (visible && !gameOverRef.current) {
            lastTimeRef.current = null; // dt 점프 방지
            if (tickFnRef.current) rafRef.current = requestAnimationFrame(tickFnRef.current);
            if (spawnFnRef.current) spawnRef.current = setTimeout(spawnFnRef.current, 300);
        } else if (!visible) {
            cancelAnimationFrame(rafRef.current);
            if (spawnRef.current) clearTimeout(spawnRef.current);
        }
    }, [visible]);

    useEffect(() => {
        const spawnWord = () => {
            if (gameOverRef.current || pausedRef.current) return;
            const text = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
            const color = COLORS[Math.floor(Math.random() * COLORS.length)];
            const word: Word = {
                id: _nextId++,
                text,
                x: 8 + Math.random() * 76,
                y: -3,
                speed: 1.2 + levelRef.current * 0.25 + Math.random() * 0.8,
                color,
            };
            wordsRef.current = [...wordsRef.current, word];
            setWords([...wordsRef.current]);
            const delay = Math.max(3500, 14000 - levelRef.current * 150 - Math.random() * 500);
            spawnRef.current = setTimeout(spawnWord, delay);
        };
        spawnFnRef.current = spawnWord;

        const tick = (time: number) => {
            if (gameOverRef.current || pausedRef.current) return;
            const dt = lastTimeRef.current === null ? 0 : (time - lastTimeRef.current) / 1000;
            lastTimeRef.current = time;

            const next: Word[] = [];
            let missed = false;

            for (const w of wordsRef.current) {
                const ny = w.y + w.speed * dt;
                if (ny >= 100) {
                    onTermOutputRef.current({ type: 'err', text: `warn: "${w.text}" escaped — unhandled` });
                    livesRef.current = Math.max(0, livesRef.current - 1);
                    missed = true;
                } else {
                    next.push({ ...w, y: ny });
                }
            }

            wordsRef.current = next;
            setWords([...next]);

            if (missed) {
                setLives(livesRef.current);
                if (livesRef.current <= 0) {
                    gameOverRef.current = true;
                    setGameOver(true);
                    onTermOutputRef.current({ type: 'err', text: `fatal: too many unhandled identifiers — daemon terminated  (score: ${scoreRef.current} | lv.${levelRef.current})` });
                    if (spawnRef.current) clearTimeout(spawnRef.current);
                    return;
                }
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        registerHandler((word) => {
            if (gameOverRef.current) {
                if (word === 'q' || word === 'quit' || word === 'exit') {
                    onCloseRef.current();
                } else if (word === 'restart' || word === 'r') {
                    onRestartRef.current();
                }
                return;
            }
            const idx = wordsRef.current.findIndex(w => w.text === word);
            if (idx !== -1) {
                const hit = wordsRef.current[idx];
                const pts = hit.text.length * levelRef.current;
                scoreRef.current += pts;
                wordsRef.current = wordsRef.current.filter((_, i) => i !== idx);
                setWords([...wordsRef.current]);
                setScore(scoreRef.current);
                const desc = DESC[word] ? `  // ${DESC[word]}` : '';
                onTermOutputRef.current({ type: 'out', text: `info: "${word}" resolved (+${pts})${desc}` });
                const newLevel = Math.floor(scoreRef.current / 100) + 1;
                if (newLevel !== levelRef.current) {
                    levelRef.current = newLevel;
                    setLevel(newLevel);
                    onTermOutputRef.current({ type: 'out', text: `warn: load increased — optimizer level ${newLevel}` });
                }
            } else {
                onTermOutputRef.current({ type: 'err', text: `warn: "${word}" not found in scope` });
            }
        });

        tickFnRef.current = tick;
        spawnRef.current = setTimeout(spawnWord, 600);
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            registerHandler(null);
            cancelAnimationFrame(rafRef.current);
            if (spawnRef.current) clearTimeout(spawnRef.current);
        };
    }, [registerHandler]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: 'transparent', overflow: 'hidden', fontFamily: "'Consolas','Courier New',monospace" }}>

            {/* HUD — 에디터 우상단에 코드 주석처럼 표시 */}
            <div style={{ position: 'absolute', top: 8, right: 14, zIndex: 10, fontSize: '11px', color: '#6a9955', userSelect: 'none', lineHeight: '1.6' }}>
                <span>{'// '}</span>
                <span style={{ color: '#ce9178' }}>{'❤'.repeat(lives)}{'🖤'.repeat(Math.max(0, 3 - lives))}</span>
                <span style={{ color: '#555' }}>{' · '}</span>
                <span style={{ color: '#9cdcfe' }}>score</span>
                <span style={{ color: '#d4d4d4' }}>{': '}</span>
                <span style={{ color: '#b5cea8' }}>{score}</span>
                <span style={{ color: '#555' }}>{' · '}</span>
                <span style={{ color: '#9cdcfe' }}>lv</span>
                <span style={{ color: '#b5cea8' }}>{level}</span>
                <span style={{ color: '#3e3e42' }}>{' [ESC]'}</span>
            </div>

            {/* 바닥 경계선 */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: '#f44747', opacity: 0.3, zIndex: 2 }} />

            {/* 낙하 단어 */}
            {words.map(w => (
                <div
                    key={w.id}
                    style={{
                        position: 'absolute',
                        left: `${w.x}%`,
                        top: `${w.y}%`,
                        color: w.color,
                        fontSize: '13px',
                        fontWeight: 'bold',
                        userSelect: 'none',
                        textShadow: `0 0 8px ${w.color}55`,
                        transform: 'translateX(-50%)',
                        whiteSpace: 'nowrap',
                        zIndex: 3,
                        opacity: 0.92,
                    }}
                >
                    {w.text}
                </div>
            ))}

            {/* 게임오버 — VS Code 알림창 스타일 (우하단 코너) */}
            {gameOver && (
                <div style={{
                    position: 'absolute', bottom: 16, right: 16, zIndex: 20,
                    background: '#252526', border: '1px solid #3e3e42',
                    borderLeft: '3px solid #f44747',
                    padding: '10px 14px', minWidth: '220px',
                    fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px',
                }}>
                    <div style={{ color: '#f44747', marginBottom: '6px', fontWeight: 'bold' }}>● PROCESS EXITED</div>
                    <div style={{ color: '#858585', marginBottom: '2px' }}>
                        score: <span style={{ color: '#b5cea8' }}>{score}</span>
                        <span style={{ color: '#3e3e42' }}> | </span>
                        level: <span style={{ color: '#b5cea8' }}>{level}</span>
                    </div>
                    <div style={{ color: '#3e3e42', marginTop: '6px' }}>
                        <span style={{ color: '#569cd6' }}>restart</span> to play again  ·  <span style={{ color: '#569cd6' }}>q</span> to quit
                    </div>
                </div>
            )}
        </div>
    );
}
