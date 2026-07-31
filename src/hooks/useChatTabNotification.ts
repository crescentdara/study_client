import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

const FALLBACK_FAVICON = '/favicon.png';

const getFaviconLink = () => {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
};

export function useChatTabNotification(myNickname: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const baseTitleRef = useRef(document.title);
  const faviconHrefRef = useRef(
    document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.getAttribute('href') || FALLBACK_FAVICON,
  );
  const faviconRenderRef = useRef(0);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  const notifyIncomingChat = useCallback((message: ChatMessage) => {
    if (
      document.visibilityState === 'visible'
      || message.nickname === myNickname
      || message.nickname === 'system'
    ) return;
    setUnreadCount((count) => count + 1);
  }, [myNickname]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') clearUnread();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [clearUnread]);

  useEffect(() => {
    document.title = unreadCount > 0
      ? `(${unreadCount}) 새 채팅 · ${baseTitleRef.current}`
      : baseTitleRef.current;

    const link = getFaviconLink();
    const renderId = ++faviconRenderRef.current;
    if (unreadCount === 0) {
      link.href = faviconHrefRef.current;
      return;
    }

    const image = new Image();
    image.src = faviconHrefRef.current;
    image.onload = () => {
      if (renderId !== faviconRenderRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext('2d');
      if (!context) return;

      context.drawImage(image, 0, 0, 32, 32);
      context.fillStyle = '#e74c3c';
      context.beginPath();
      context.arc(24, 8, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = 'bold 11px monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(unreadCount > 9 ? '9+' : String(unreadCount), 24, 8);
      link.href = canvas.toDataURL('image/png');
    };

    return () => {
      faviconRenderRef.current += 1;
    };
  }, [unreadCount]);

  useEffect(() => () => {
    document.title = baseTitleRef.current;
    getFaviconLink().href = faviconHrefRef.current;
  }, []);

  return { unreadCount, notifyIncomingChat, clearUnread };
}
