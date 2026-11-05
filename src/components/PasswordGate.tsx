import { useEffect, useRef, useState } from 'react';

interface Props {
    children: React.ReactNode;
}

export default function PasswordGate({ children }: Props) {
    const [unlocked, setUnlocked] = useState(false);
    const [checking, setChecking] = useState(true);
    const [showLogin, setShowLogin] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const tapRef = useRef({ count: 0, lastTap: 0 });

    useEffect(() => {
        if (unlocked) return undefined;
        const originalTitle = document.title;
        const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        const originalIcon = icon?.getAttribute('href');
        document.title = '404 Not Found';
        icon?.setAttribute('href', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>');
        return () => {
            document.title = originalTitle;
            if (icon && originalIcon !== null && originalIcon !== undefined) icon.setAttribute('href', originalIcon);
        };
    }, [unlocked]);

    useEffect(() => {
        fetch('/api/auth/session').then(response => {
            if (response.ok) setUnlocked(true);
        }).catch(() => {}).finally(() => setChecking(false));
    }, []);

    useEffect(() => {
        if (showLogin) inputRef.current?.focus();
    }, [showLogin]);

    useEffect(() => {
        if (unlocked || checking || showLogin) return undefined;
        let typed = '';
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
            typed = (typed + event.key.toLowerCase()).slice(-4);
            if (typed === '1234') {
                event.preventDefault();
                setShowLogin(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [checking, showLogin, unlocked]);

    const handleCornerTap = () => {
        const now = Date.now();
        const count = now - tapRef.current.lastTap < 1500 ? tapRef.current.count + 1 : 1;
        tapRef.current = { count, lastTap: now };
        if (count >= 5) {
            tapRef.current = { count: 0, lastTap: 0 };
            setShowLogin(true);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: input }),
            });
            if (response.ok) {
                setInput('');
                setUnlocked(true);
            } else if (response.status === 401) {
                setInput('');
                setError('비밀번호가 올바르지 않습니다.');
                inputRef.current?.focus();
            } else {
                setError('서버에 연결할 수 없습니다.');
            }
        } catch {
            setError('서버에 연결할 수 없습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    if (checking) return null;
    if (unlocked) return <>{children}</>;

    return (
        <main className="nginx-gate">
            <h1>404 Not Found</h1>
            <hr />
            <div>nginx/1.30.3</div>
            {!showLogin && <div className="nginx-gate-corner" onClick={handleCornerTap} aria-hidden="true" />}
            {showLogin && (
                <form className="nginx-gate-login" onSubmit={handleSubmit}>
                    <input id="nginx-gate-password" ref={inputRef} type="text" value={input}
                        onChange={event => { setInput(event.target.value); setError(''); }}
                        autoComplete="off" spellCheck={false} aria-label="비밀번호" disabled={submitting} />
                    {error && <p role="alert">{error}</p>}
                </form>
            )}
            <style>{`
                .nginx-gate { position: fixed; inset: 0; overflow: auto; padding: 8px; background: #fff; color: #000; font-family: "Times New Roman", serif; font-size: 16px; line-height: normal; text-align: center; }
                .nginx-gate h1 { display: block; font-size: 2em; font-weight: bold; margin: .67em 0; }
                .nginx-gate hr { display: block; margin: .5em auto; border: 0; border-top: 1px solid #808080; }
                .nginx-gate-corner { position: fixed; left: 0; bottom: 0; width: 48px; height: 48px; touch-action: manipulation; }
                .nginx-gate-login { position: fixed; bottom: 6px; left: 6px; width: 40px; text-align: left; font: 8px Arial, sans-serif; }
                .nginx-gate-login input { display: block; width: 100%; padding: 0 1px; border: 1px solid #f0f0f0; border-radius: 0; outline: none; background: #fff; color: #999; font: inherit; }
                .nginx-gate-login p { margin: 4px 0 0; color: #777; font-size: 10px; }
            `}</style>
        </main>
    );
}
