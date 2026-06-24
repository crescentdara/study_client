import { useState, useEffect, useRef } from 'react';

const CORRECT_PASSWORD = '2026';
const SESSION_KEY = 'sp_auth';

interface Props {
    children: React.ReactNode;
}

export default function PasswordGate({ children }: Props) {
    const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
    const [input, setInput] = useState('');
    const [shake, setShake] = useState(false);
    const [wrong, setWrong] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!unlocked) inputRef.current?.focus();
    }, [unlocked]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input === CORRECT_PASSWORD) {
            sessionStorage.setItem(SESSION_KEY, '1');
            setUnlocked(true);
        } else {
            setWrong(true);
            setShake(true);
            setInput('');
            setTimeout(() => setShake(false), 500);
            inputRef.current?.focus();
        }
    };

    if (unlocked) return <>{children}</>;

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: '#0d0d0d',
            display: 'flex', flexDirection: 'column',
            alignItems: 'start', justifyContent: 'end',
            gap: 10, padding: 20,
            fontFamily: "'Fira Code', 'Consolas', monospace",
        }}>
            <div style={{ color: '#569cd6', fontSize: 10, letterSpacing: 2 }}>
                <span style={{ color: '#6a9955' }}>// </span>access restricted
            </div>

            <form
                onSubmit={handleSubmit}
                style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 10,
                    animation: shake ? 'pwShake 0.5s ease' : 'none',
                }}
            >
                <div style={{
                    border: `1px solid ${wrong ? '#f14c4c' : '#3e3e42'}`,
                    borderRadius: 4,
                    padding: '5px 10px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#1e1e1e',
                    transition: 'border-color 0.2s',
                }}>
                    <span style={{ color: '#569cd6', fontSize: 10 }}>{'>'}</span>
                    <input
                        ref={inputRef}
                        type="password"
                        value={input}
                        onChange={e => { setInput(e.target.value); setWrong(false); }}
                        placeholder="password"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#d4d4d4',
                            fontSize: 10,
                            width: 160,
                            fontFamily: 'inherit',
                            letterSpacing: 4,
                        }}
                        autoComplete="off"
                    />
                </div>

                {wrong && (
                    <div style={{ color: '#f14c4c', fontSize: 10 }}>
                        <span style={{ color: '#6a9955',}}>// </span>incorrect password
                    </div>
                )}

                <button
                    type="submit"
                    className="btn-primary"
                    style={{ fontSize: 10, padding: '6px 15px',}}
                >
                    .enter()
                </button>
            </form>

            <style>{`
                @keyframes pwShake {
                    0%, 100% { transform: translateX(0); }
                    20%       { transform: translateX(-8px); }
                    40%       { transform: translateX(8px); }
                    60%       { transform: translateX(-6px); }
                    80%       { transform: translateX(6px); }
                }
            `}</style>
        </div>
    );
}
