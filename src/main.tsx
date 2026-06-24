/**
 * React 앱 진입점
 *
 * ReactDOM.createRoot(): React 18의 새 방식 (Concurrent Mode 지원)
 * document.getElementById('root'): index.html 의 <div id="root">에 마운트
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PasswordGate from './components/PasswordGate';
import './styles/global.css';  // 전역 스타일 적용

ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode: 개발 모드에서 잠재적 문제를 감지 (이중 렌더링 등)
  // 빌드(프로덕션)에서는 영향 없음
  <React.StrictMode>
    <PasswordGate>
      <App />
    </PasswordGate>
  </React.StrictMode>
);
