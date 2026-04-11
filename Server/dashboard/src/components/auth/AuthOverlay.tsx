import { useState, type KeyboardEvent } from 'react';

interface AuthOverlayProps {
  onSubmit: (passcode: string) => void;
  error?: boolean;
}

export function AuthOverlay({ onSubmit, error }: AuthOverlayProps) {
  const [code, setCode] = useState('');

  const handleSubmit = () => {
    if (code.trim()) onSubmit(code.trim());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="auth-overlay">
      <div className="auth-box">
        <div className="auth-title">System Locked</div>
        <div className="auth-sub">Enter passcode to access dashboard</div>
        <input
          type="password"
          className="auth-input"
          placeholder="••••••••"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="auth-error">{error ? 'Incorrect passcode' : ''}</div>
        <button className="auth-btn" onClick={handleSubmit}>
          Access Dashboard
        </button>
      </div>
    </div>
  );
}
