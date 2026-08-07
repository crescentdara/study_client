import { useEffect, useRef, useState } from 'react';

const TRASH_BOUNDS = {
    left: 42,
    bottom: 34,
    width: 42,
    height: 52,
};

const HOVER_EVENT = 'study:desk-trash-hover';
const DROP_EVENT = 'study:desk-trash-drop';

export function isOverDeskTrash(clientX: number, clientY: number) {
    const top = window.innerHeight - TRASH_BOUNDS.bottom - TRASH_BOUNDS.height;
    return clientX >= TRASH_BOUNDS.left
        && clientX <= TRASH_BOUNDS.left + TRASH_BOUNDS.width
        && clientY >= top
        && clientY <= top + TRASH_BOUNDS.height;
}

export function signalTrashHover(active: boolean) {
    window.dispatchEvent(new CustomEvent(HOVER_EVENT, { detail: active }));
}

export function signalTrashDrop() {
    window.dispatchEvent(new Event(DROP_EVENT));
}

function DeskTrashBin() {
    const [active, setActive] = useState(false);
    const [dropping, setDropping] = useState(false);
    const dropTimerRef = useRef<number | null>(null);

    useEffect(() => {
        const handleHover = (event: Event) => setActive(Boolean((event as CustomEvent<boolean>).detail));
        const handleDrop = () => {
            setActive(false);
            setDropping(true);
            if (dropTimerRef.current) window.clearTimeout(dropTimerRef.current);
            dropTimerRef.current = window.setTimeout(() => setDropping(false), 420);
        };
        window.addEventListener(HOVER_EVENT, handleHover);
        window.addEventListener(DROP_EVENT, handleDrop);
        return () => {
            window.removeEventListener(HOVER_EVENT, handleHover);
            window.removeEventListener(DROP_EVENT, handleDrop);
            if (dropTimerRef.current) window.clearTimeout(dropTimerRef.current);
        };
    }, []);

    return (
        <div
            className={`desk-trash-bin ${active ? 'active' : ''} ${dropping ? 'dropping' : ''}`}
            style={{ left: TRASH_BOUNDS.left, bottom: TRASH_BOUNDS.bottom }}
            aria-label="쓰레기통"
        >
            <span className="trash-bin-lid"><i /></span>
            <span className="trash-bin-body"><i /><i /><i /><b>휴지통</b></span>
            <small>여기에 버리기</small>
        </div>
    );
}

export default DeskTrashBin;
