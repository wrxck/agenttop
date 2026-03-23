import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { getCachedSessions, subscribe, triggerRefresh } from '../../discovery/sessionsAsync.js';
import type { Session, TokenUsage, SessionGroup, VisibleItem, SessionStatus } from '../../discovery/types.js';
import { STATUS_PRIORITY } from '../../discovery/types.js';
import { getNicknames } from '../../config/store.js';

const ACTIVE_POLL_MS = 10_000;
const IDLE_POLL_MS = 30_000;

const getGroupKey = (session: Session): string => {
  if (session.cwd) {
    const parts = session.cwd.replace(/\/+$/, '').split('/');
    return parts[parts.length - 1] || session.slug;
  }
  if (session.project) {
    const parts = session.project.replace(/\/+$/, '').split('/');
    return parts[parts.length - 1] || session.slug;
  }
  return session.slug;
};

const buildGroups = (sessions: Session[], expandedKeys: Set<string>): SessionGroup[] => {
  const byKey = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = getGroupKey(s);
    const existing = byKey.get(key);
    if (existing) existing.push(s);
    else byKey.set(key, [s]);
  }

  const groups: SessionGroup[] = [];
  for (const [key, list] of byKey) {
    list.sort((a, b) => b.lastActivity - a.lastActivity);
    const totalIn = list.reduce((sum, s) => sum + s.usage.inputTokens + s.usage.cacheReadTokens, 0);
    const totalOut = list.reduce((sum, s) => sum + s.usage.outputTokens, 0);
    groups.push({
      key,
      sessions: list,
      expanded: expandedKeys.has(key),
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      latestModel: list[0].model,
      status: list.reduce((best: SessionStatus, s) => {
        return (STATUS_PRIORITY[s.status] ?? 3) < (STATUS_PRIORITY[best] ?? 3) ? s.status : best;
      }, 'inactive' as SessionStatus),
      latestActivity: list[0].lastActivity,
      earliestStart: Math.min(...list.map((s) => s.startTime)),
    });
  }

  groups.sort((a, b) => b.latestActivity - a.latestActivity);
  return groups;
};

const buildVisibleItems = (groups: SessionGroup[]): VisibleItem[] => {
  const items: VisibleItem[] = [];
  for (const group of groups) {
    if (group.sessions.length === 1) {
      items.push({ type: 'ungrouped', session: group.sessions[0] });
    } else {
      items.push({ type: 'group', group });
      if (group.expanded) {
        for (const session of group.sessions) {
          items.push({ type: 'session', session, groupKey: group.key });
        }
      }
    }
  }
  return items;
};

const enrichAndFilter = (
  found: Session[],
  usageOverrides: Map<string, TokenUsage>,
  filter: string | undefined,
  archivedIds: Set<string> | undefined,
  viewingArchive: boolean | undefined,
): Session[] => {
  const nicknames = getNicknames();

  let enriched = found.map((s) => {
    const override = usageOverrides.get(s.sessionId);
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

  if (archivedIds && archivedIds.size > 0) {
    if (viewingArchive) {
      enriched = enriched.filter((s) => archivedIds.has(s.sessionId));
    } else {
      enriched = enriched.filter((s) => !archivedIds.has(s.sessionId));
    }
  } else if (viewingArchive) {
    enriched = [];
  }

  if (filter) {
    const lower = filter.toLowerCase();
    enriched = enriched.filter(
      (s) =>
        s.slug.toLowerCase().includes(lower) ||
        s.nickname?.toLowerCase().includes(lower) ||
        s.project.toLowerCase().includes(lower) ||
        s.model.toLowerCase().includes(lower),
    );
  }

  return enriched;
};

export const useSessions = (
  allUsers: boolean,
  filter?: string,
  archivedIds?: Set<string>,
  viewingArchive?: boolean,
) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const usageOverrides = useRef(new Map<string, TokenUsage>());

  const lastSessionIdsRef = useRef('');

  const updateSessions = useCallback(
    (force?: boolean) => {
      const found = getCachedSessions();
      const filtered = enrichAndFilter(found, usageOverrides.current, filter, archivedIds, viewingArchive);
      // skip state update if session list hasn't meaningfully changed
      const key = filtered.map((s) => `${s.sessionId}:${s.status}:${s.lastActivity}`).join(',');
      if (!force && key === lastSessionIdsRef.current) return;
      lastSessionIdsRef.current = key;
      setSessions(filtered);
    },
    [filter, archivedIds, viewingArchive],
  );

  const refresh = useCallback(() => {
    updateSessions(true);
    triggerRefresh(allUsers);
  }, [allUsers, updateSessions]);

  useEffect(() => {
    // subscribe to cache updates from background refresh
    const unsubscribe = subscribe(() => updateSessions());
    return unsubscribe;
  }, [updateSessions]);

  const hasSessions = sessions.length > 0;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    // initial load
    refreshRef.current();
  }, []);

  useEffect(() => {
    // poll for session discovery updates
    const pollMs = hasSessions ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    const interval = setInterval(() => triggerRefresh(allUsers), pollMs);
    return () => clearInterval(interval);
  }, [allUsers, hasSessions]);

  const groups = useMemo(() => buildGroups(sessions, expandedKeys), [sessions, expandedKeys]);
  const visibleItems = useMemo(() => buildVisibleItems(groups), [groups]);
  const itemCountRef = useRef(visibleItems.length);
  itemCountRef.current = visibleItems.length;

  const selectedItem = visibleItems[selectedIndex] ?? null;
  const selectedSession =
    selectedItem?.type === 'ungrouped'
      ? selectedItem.session
      : selectedItem?.type === 'session'
        ? selectedItem.session
        : null;
  const selectedGroup = selectedItem?.type === 'group' ? selectedItem.group : null;

  const selectNext = useCallback(() => {
    setSelectedIndex((i) => Math.min(i + 1, Math.max(0, itemCountRef.current - 1)));
  }, []);

  const selectPrev = useCallback(() => {
    setSelectedIndex((i) => Math.max(i - 1, 0));
  }, []);

  const selectIndex = useCallback((i: number) => {
    setSelectedIndex(i);
  }, []);

  const toggleExpand = useCallback((groupKey: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
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

  return {
    sessions,
    groups,
    visibleItems,
    selectedSession,
    selectedGroup,
    selectedIndex,
    selectNext,
    selectPrev,
    selectIndex,
    toggleExpand,
    refresh,
    addUsage,
  };
};
