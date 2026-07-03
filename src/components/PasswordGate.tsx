import { useEffect, useRef, useState } from 'react';

const CORRECT_PASSWORD = '2026';
const SESSION_KEY = 'sp_auth';
const BOOT_LINES = [
    'SeaBIOS (version study-1.6.4)',
    'Booting internal study shell from /dev/sda1...',
    '[    0.000000] Linux version 6.8.12-study (root@vm-host)',
    '[    0.184102] systemd[1]: Started Study Platform Login.',
    '[    0.418337] eth0: link up, 1000Mbps, full-duplex',
];
const CONNECT_LOGS = [
    '[    0.118203] random: crng init done',
    '[    0.238110] ata1.00: ATA-10: STUDY_VM_DISK, 2026, max UDMA/133',
    '[    0.390511] EXT4-fs (sda1): mounted filesystem with ordered data mode',
    '[    0.552092] systemd[1]: Reached target Basic System.',
    '[    0.684421] audit: type=1400 apparmor="STATUS" operation="profile_load"',
    '[    0.820033] net0: link becomes ready',
    'root@study-vm:~# ./auth --target lobby --mode raw',
    '[AUTH] reading password buffer',
    '[AUTH] hash matched',
    '[AUTH] session token issued',
    'root@study-vm:~# nmap -p 20124 study-gateway.local',
    '20124/tcp open  study-platform',
    'root@study-vm:~# mount -t wsfs study-gateway:/lobby /mnt/lobby',
    '[WS] opening /ws',
    '[WS] subscribing /topic/lobby',
    '[WS] subscribing /topic/chat/global',
    '[LOAD] rooms.dat',
    '[LOAD] users.cache',
    '[LOAD] games.registry',
    '[EXEC] startx /usr/bin/study-lobby',
    '[DONE] handoff to lobby shell',
];

interface Props {
    children: React.ReactNode;
}

export default function PasswordGate({ children }: Props) {
    const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
    const [entering, setEntering] = useState(false);
    const [readyToEnter, setReadyToEnter] = useState(false);
    const [input, setInput] = useState('');
    const [wrong, setWrong] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!unlocked && !entering) inputRef.current?.focus();
    }, [unlocked, entering]);

    useEffect(() => {
        if (!entering) return undefined;
        const timer = window.setTimeout(() => setReadyToEnter(true), CONNECT_LOGS.length * 92 + 420);
        return () => window.clearTimeout(timer);
    }, [entering]);

    useEffect(() => {
        if (!readyToEnter) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            setUnlocked(true);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [readyToEnter]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (readyToEnter) {
            setUnlocked(true);
            return;
        }
        if (entering) return;
        if (input === CORRECT_PASSWORD) {
            sessionStorage.setItem(SESSION_KEY, '1');
            setWrong(false);
            setEntering(true);
        } else {
            setWrong(true);
            setInput('');
            window.setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    if (unlocked) return <>{children}</>;

    return (
        <div className="pw-cmd-screen" onClick={() => inputRef.current?.focus()}>
            <form onSubmit={handleSubmit} className="pw-cmd-window">
                <div className="pw-cmd-titlebar">
                    <span>study-vm tty1</span>
                    <span className="pw-cmd-status">{entering ? 'JOINING' : 'LOCKED'}</span>
                </div>
                <div className="pw-cmd-body pw-cmd-stream">
                    {BOOT_LINES.map((line) => (
                        <div key={line} className="persist">{line}</div>
                    ))}
                    <div className="persist">&nbsp;</div>
                    <div className="persist dim">study-platform login: guest</div>
                    <div className="persist">&nbsp;</div>
                    {wrong && (
                        <div className="persist err">auth: permission denied</div>
                    )}
                    <div className="pw-cmd-prompt persist">
                        <span>guest@study-vm:~$</span>
                        <span>sudo join-lobby --password </span>
                        <span className="pw-mask">{input ? '*'.repeat(input.length) : ''}</span>
                        {!entering && <span className="pw-cursor" />}
                        {!entering && (
                            <input
                                ref={inputRef}
                                type="password"
                                value={input}
                                onChange={(e) => { setInput(e.target.value); setWrong(false); }}
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="password"
                            />
                        )}
                    </div>
                    {entering && CONNECT_LOGS.map((line, index) => (
                        <div
                            key={`${line}-${index}`}
                            className={line.startsWith('[DONE]') ? 'done' : line.startsWith('[AUTH]') ? 'ok' : line.startsWith('[WS]') || line.startsWith('[LOAD]') ? 'join' : ''}
                            style={{ animationDelay: `${index * 92}ms` }}
                        >
                            {line || '\u00A0'}
                        </div>
                    ))}
                    {readyToEnter && (
                        <div className="pw-enter-ready">
                            <span>guest@study-vm:~$</span>
                            <span>press ENTER to open lobby</span>
                            <span className="pw-cursor" />
                        </div>
                    )}
                </div>
            </form>
            <style>{cmdStyles}</style>
        </div>
    );
}

const cmdStyles = `
    .pw-cmd-screen {
        position: fixed;
        inset: 0;
        background:
            radial-gradient(circle at 50% 52%, rgba(0, 255, 96, .08), transparent 52%),
            linear-gradient(90deg, rgba(255,0,0,.025), transparent 12%, transparent 88%, rgba(0,80,255,.025)),
            #020402;
        display: flex;
        align-items: stretch;
        justify-content: stretch;
        padding: 0;
        font-family: Consolas, "Courier New", monospace;
        color: #b9ffbf;
        overflow: hidden;
        text-shadow: 0 0 3px rgba(64, 255, 117, .45);
    }
    .pw-cmd-screen::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
            repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 4px),
            repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0 1px, transparent 1px 7px);
        pointer-events: none;
        opacity: .38;
        mix-blend-mode: screen;
        animation: pwCmdScan 1.8s linear infinite;
    }
    .pw-cmd-screen::after {
        content: "";
        position: absolute;
        inset: -12%;
        background:
            linear-gradient(transparent 0 48%, rgba(185,255,191,.1) 49%, transparent 50%),
            radial-gradient(circle, transparent 54%, rgba(0,0,0,.35) 100%);
        pointer-events: none;
        opacity: .7;
        animation: pwCmdJitter .18s steps(2) infinite;
    }
    .pw-cmd-window {
        position: relative;
        z-index: 1;
        width: 100vw;
        height: 100vh;
        border: 0;
        background:
            linear-gradient(180deg, rgba(255,255,255,.035), transparent 20%),
            rgba(0, 7, 0, .92);
        box-shadow: inset 0 0 90px rgba(0,0,0,.85);
        display: flex;
        flex-direction: column;
        animation: pwCmdPower .22s steps(2) 1;
    }
    .pw-cmd-window.entering {
        width: 100vw;
        height: 100vh;
    }
    .pw-cmd-titlebar {
        height: 28px;
        background: #070907;
        color: #7aff87;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        font-size: 12px;
        border-bottom: 1px solid rgba(122,255,135,.28);
        user-select: none;
        text-transform: uppercase;
    }
    .pw-cmd-status {
        color: #ff4141;
        font-size: 11px;
        letter-spacing: 1px;
        animation: pwCmdBlink .7s steps(2) infinite;
    }
    .pw-cmd-body {
        flex: 1;
        padding: clamp(16px, 2vw, 28px);
        font-size: clamp(13px, 1.45vw, 18px);
        line-height: 1.38;
        overflow: hidden;
        white-space: pre-wrap;
        letter-spacing: 0;
    }
    .pw-cmd-body .dim {
        color: #76b97a;
    }
    .pw-cmd-body .err {
        color: #ff3d3d;
        margin-bottom: 4px;
        text-shadow: 0 0 5px rgba(255,61,61,.7);
        animation: pwCmdError .12s steps(2) 3;
    }
    .pw-cmd-prompt {
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px;
        color: #e6ffe8;
        flex-wrap: wrap;
    }
    .pw-cmd-prompt > span:first-child {
        color: #58ff6a;
    }
    .pw-enter-ready {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: .7em;
        color: #fff36c;
        animation: pwCmdLine .08s linear forwards;
    }
    .pw-enter-ready > span:first-child {
        color: #58ff6a;
    }
    .pw-mask {
        min-width: 8px;
        letter-spacing: 2px;
        color: #fff36c;
    }
    .pw-cursor {
        width: .72em;
        height: 1.1em;
        background: #b9ffbf;
        display: inline-block;
        box-shadow: 0 0 8px rgba(185,255,191,.75);
        animation: pwCmdBlink .7s steps(2) infinite;
    }
    .pw-cmd-prompt input {
        position: absolute;
        inset: 0;
        opacity: 0;
        border: 0;
        background: transparent;
        color: transparent;
        caret-color: transparent;
    }
    .pw-cmd-stream {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
    }
    .pw-cmd-stream div {
        opacity: 0;
        transform: translateY(12px) skewX(-1deg);
        animation: pwCmdLine .08s linear forwards;
        color: #b9ffbf;
    }
    .pw-cmd-stream div.persist {
        opacity: 1;
        transform: none;
        animation: none;
    }
    .pw-cmd-stream div.ok {
        color: #57ff69;
    }
    .pw-cmd-stream div.join {
        color: #66c7ff;
    }
    .pw-cmd-stream div.done {
        color: #fff36c;
        animation: pwCmdLine .08s linear forwards, pwCmdDone .28s steps(2) .9s 3;
    }
    @keyframes pwCmdBlink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
    }
    @keyframes pwCmdLine {
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pwCmdDone {
        0% { transform: translateX(0); }
        50% { transform: translateX(4px); }
        100% { transform: translateX(0); }
    }
    @keyframes pwCmdScan {
        from { transform: translateY(-8px); }
        to { transform: translateY(8px); }
    }
    @keyframes pwCmdJitter {
        0% { transform: translate(0, 0); }
        50% { transform: translate(1px, -1px); }
        100% { transform: translate(-1px, 1px); }
    }
    @keyframes pwCmdPower {
        0% { filter: brightness(0); transform: scaleY(.02); }
        55% { filter: brightness(2.2); transform: scaleY(1.02); }
        100% { filter: brightness(1); transform: scaleY(1); }
    }
    @keyframes pwCmdError {
        0% { transform: translateX(0); }
        50% { transform: translateX(6px); }
        100% { transform: translateX(-3px); }
    }
`;
