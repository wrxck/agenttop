import { useState, useEffect, useRef } from 'react';

import type { Session, ToolCall } from '../../discovery/types.js';
import { Watcher } from '../../ingestion/watcher.js';

const MAX_EVENTS = 200;

export const useActivityStream = (session: Session | Session[] | null, allUsers: boolean) => {
  const [events, setEvents] = useState<ToolCall[]>([]);
  const watcherRef = useRef<Watcher | null>(null);

  const sessions = session === null ? [] : Array.isArray(session) ? session : [session];
  const sessionKey = sessions.map((s) => s.sessionId).sort().join(',');
  const sessionIdSet = new Set(sessions.map((s) => s.sessionId));

  useEffect(() => {
    setEvents([]);

    if (sessions.length === 0) return;

    const existingCalls: ToolCall[] = [];
    const tempWatcher = new Watcher(() => {}, allUsers);
    const allFiles = sessions.flatMap((s) => s.outputFiles);
    const seen = new Set<string>();
    for (const file of allFiles) {
      if (seen.has(file)) continue;
      seen.add(file);
      existingCalls.push(...tempWatcher.readExisting(file));
    }

    existingCalls.sort((a, b) => a.timestamp - b.timestamp);
    setEvents(existingCalls.slice(-MAX_EVENTS));

    const handler = (calls: ToolCall[]) => {
      const matched = calls.filter((c) => sessionIdSet.has(c.sessionId));
      if (matched.length === 0) return;
      setEvents((prev) => [...prev, ...matched].slice(-MAX_EVENTS));
    };

    const watcher = new Watcher(handler, allUsers);
    watcherRef.current = watcher;
    watcher.start();

    return () => {
      watcher.stop();
      watcherRef.current = null;
    };
  }, [sessionKey, allUsers]);

  return events;
};
