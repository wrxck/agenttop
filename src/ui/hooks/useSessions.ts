import { useState, useEffect, useCallback, useRef } from 'react';

import { discoverSessions } from '../../discovery/sessions.js';
import type { Session, TokenUsage, SessionGroup, VisibleItem } from '../../discovery/types.js';
import { getNicknames } from '../../config/store.js';

const ACTIVE_POLL_MS = 10_000;
const IDLE_POLL_MS = 30_000;

const getDisplayName = (session: Session): string => {
  if (session.nickname) return session.nickname;
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
  const byName = new Map<string, Session[]>();
  for (const s of sessions) {
    const name = getDisplayName(s);
    const list = byName.get(name);
    if (list) list.push(s);
    else byName.set(name, [s]);
  }

  const groups: SessionGroup[] = [];
  for (const [key, list] of byName) {
    list.sort((a, b) => b.lastActivity - a.lastActivity);
    const totalIn = list.reduce(
      (sum, s) => sum + s.usage.inputTokens + s.usage.cacheReadTokens,
      0,
    );
    const totalOut = list.reduce((sum, s) => sum + s.usage.outputTokens, 0);
    groups.push({
      key,
      sessions: list,
      expanded: expandedKeys.has(key),
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      latestModel: list[0].model,
      isActive: list.some((s) => s.pid !== null),
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

    if (archivedIds && archivedIds.size > 0) {
      if (viewingArchive) {
        filtered = filtered.filter((s) => archivedIds.has(s.sessionId));
      } else {
        filtered = filtered.filter((s) => !archivedIds.has(s.sessionId));
      }
    } else if (viewingArchive) {
      filtered = [];
    }

    if (filter) {
      const lower = filter.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.slug.toLowerCase().includes(lower) ||
          s.nickname?.toLowerCase().includes(lower) ||
          s.project.toLowerCase().includes(lower) ||
          s.model.toLowerCase().includes(lower),
      );
    }

    setSessions(filtered);
  }, [allUsers, filter, archivedIds, viewingArchive]);

  useEffect(() => {
    refresh();
    const pollMs = sessions.length > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
  }, [refresh, sessions.length > 0]);

  const groups = buildGroups(sessions, expandedKeys);
  const visibleItems = buildVisibleItems(groups);

  const selectedItem = visibleItems[selectedIndex] ?? null;
  const selectedSession =
    selectedItem?.type === 'ungrouped'
      ? selectedItem.session
      : selectedItem?.type === 'session'
        ? selectedItem.session
        : null;
  const selectedGroup =
    selectedItem?.type === 'group' ? selectedItem.group : null;

  const selectNext = useCallback(() => {
    setSelectedIndex((i) => Math.min(i + 1, Math.max(0, visibleItems.length - 1)));
  }, [visibleItems.length]);

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
