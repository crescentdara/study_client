export type WorkspaceMode = 'vscode' | 'excel';

interface WorkspaceModeSwitchProps {
    mode: WorkspaceMode;
    onChange: (mode: WorkspaceMode) => void;
    compact?: boolean;
}

export default function WorkspaceModeSwitch({ mode, onChange, compact = false }: WorkspaceModeSwitchProps) {
    return (
        <div
            className={`workspace-mode-switch${compact ? ' compact' : ''}`}
            role="group"
            aria-label="업무 화면 선택"
        >
            <button
                type="button"
                className={mode === 'vscode' ? 'active' : ''}
                aria-pressed={mode === 'vscode'}
                onClick={() => onChange('vscode')}
                title="VS Code 업무 화면"
            >
                <span aria-hidden="true">&lt;/&gt;</span>
                {!compact && 'VS Code'}
            </button>
            <button
                type="button"
                className={mode === 'excel' ? 'active' : ''}
                aria-pressed={mode === 'excel'}
                onClick={() => onChange('excel')}
                title="Excel 업무 화면"
            >
                <span aria-hidden="true">▦</span>
                {!compact && 'Excel'}
            </button>
        </div>
    );
}
