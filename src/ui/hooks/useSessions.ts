import { useState, useEffect, useCallback } from 'react';

import { discoverSessions } from '../../discovery/sessions.js';
import type { Session } from '../../discovery/types.js';

export const useSessions = (allUsers: boolean, pollMs = 5000) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const refresh = useCallback(() => {
    const found = discoverSessions(allUsers);
    setSessions(found);
  }, [allUsers]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
  }, [refresh, pollMs]);

  const selectedSession = sessions[selectedIndex] ?? null;

  const selectNext = useCallback(() => {
    setSelectedIndex((i) => Math.min(i + 1, sessions.length - 1));
  }, [sessions.length]);

  const selectPrev = useCallback(() => {
    setSelectedIndex((i) => Math.max(i - 1, 0));
  }, []);

  const selectIndex = useCallback((i: number) => {
    setSelectedIndex(i);
  }, []);

  return { sessions, selectedSession, selectedIndex, selectNext, selectPrev, selectIndex, refresh };
};
