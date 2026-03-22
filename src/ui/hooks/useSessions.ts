import { useState, useEffect, useCallback, useRef } from 'react';

import { discoverSessions } from '../../discovery/sessions.js';
import type { Session, TokenUsage } from '../../discovery/types.js';
import { getNicknames } from '../../config/store.js';

const ACTIVE_POLL_MS = 10_000;
const IDLE_POLL_MS = 30_000;

export const useSessions = (allUsers: boolean, filter?: string) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const usageOverrides = useRef(new Map<string, TokenUsage>());

  const refresh = useCallback(() => {
    const found = discoverSessions(allUsers);
    const nicknames = getNicknames();

    const enriched = found.map((s) => {
      const override = usageOverrides.current.get(s.sessionId);
      return {
        ...s,
        nickname: nicknames[s.sessionId],
        usage: override
          ? {
              inputTokens: s.usage.inputTokens + override.inputTokens,
              cacheCreationTokens: s.usage.cacheCreationTokens + override.cacheCreationTokens,
              cacheReadTokens: s.usage.cacheReadTokens + override.cacheReadTokens,
              outputTokens: s.usage.outputTokens + override.outputTokens,
            }
          : s.usage,
      };
    });

    let filtered = enriched;
    if (filter) {
      const lower = filter.toLowerCase();
      filtered = enriched.filter(
        (s) =>
          s.slug.toLowerCase().includes(lower) ||
          s.nickname?.toLowerCase().includes(lower) ||
          s.project.toLowerCase().includes(lower) ||
          s.model.toLowerCase().includes(lower),
      );
    }

    setSessions(filtered);
  }, [allUsers, filter]);

  useEffect(() => {
    refresh();
    const pollMs = sessions.length > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
  }, [refresh, sessions.length > 0]);

  const selectedSession = sessions[selectedIndex] ?? null;

  const selectNext = useCallback(() => {
    setSelectedIndex((i) => Math.min(i + 1, Math.max(0, sessions.length - 1)));
  }, [sessions.length]);

  const selectPrev = useCallback(() => {
    setSelectedIndex((i) => Math.max(i - 1, 0));
  }, []);

  const selectIndex = useCallback((i: number) => {
    setSelectedIndex(i);
  }, []);

  const addUsage = useCallback((sessionId: string, usage: TokenUsage) => {
    const existing = usageOverrides.current.get(sessionId);
    if (existing) {
      usageOverrides.current.set(sessionId, {
        inputTokens: existing.inputTokens + usage.inputTokens,
        cacheCreationTokens: existing.cacheCreationTokens + usage.cacheCreationTokens,
        cacheReadTokens: existing.cacheReadTokens + usage.cacheReadTokens,
        outputTokens: existing.outputTokens + usage.outputTokens,
      });
    } else {
      usageOverrides.current.set(sessionId, usage);
    }
  }, []);

  return { sessions, selectedSession, selectedIndex, selectNext, selectPrev, selectIndex, refresh, addUsage };
};
