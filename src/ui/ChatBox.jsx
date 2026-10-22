import { useEffect, useRef, useState } from 'react';
import { store } from '../store.js';

// Frosted input box that types its question, like the reference's prompt field.
export function ChatBox({ text, active, status }) {
  const [shown, setShown] = useState(store.reducedMotion ? text : '');
  const [done, setDone] = useState(store.reducedMotion);
  const timer = useRef();
  useEffect(() => {
    clearInterval(timer.current);
    if (!active) return;
    if (store.reducedMotion) { setShown(text); setDone(true); return; }
    let n = 0;
    setShown(''); setDone(false);
    const start = setTimeout(() => {
      timer.current = setInterval(() => {
        n++;
        setShown(text.slice(0, n));
        if (n >= text.length) { clearInterval(timer.current); setTimeout(() => setDone(true), 500); }
      }, 42);
    }, 350);
    return () => { clearTimeout(start); clearInterval(timer.current); };
  }, [active, text]);
  return (
    <div className="chat-wrap">
      <div className="chat" aria-label={text}>
        <span className="chat-text" aria-hidden="true">{shown}<span className="caret" /></span>
        <svg className="chat-send" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M5 5.5 28 16 5 26.5l3.6-10.5L5 5.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8.6 16H28" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
      {status && (
        <p className={'chat-status' + (done ? ' is-on' : '')}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="7.5" r="4" stroke="currentColor" strokeWidth="1.4" /><path d="M3.5 21.5c1.4-4.6 4.7-6.6 8.5-6.6s7.1 2 8.5 6.6" stroke="currentColor" strokeWidth="1.4" /></svg>
          <span>{status}</span>
        </p>
      )}
    </div>
  );
}
