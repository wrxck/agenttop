import { useState, useEffect, useRef } from 'react';

import type { Session, ToolCall } from '../../discovery/types.js';
import { Watcher } from '../../ingestion/watcher.js';

const MAX_EVENTS = 200;

export const useActivityStream = (session: Session | null, allUsers: boolean) => {
  const [events, setEvents] = useState<ToolCall[]>([]);
  const watcherRef = useRef<Watcher | null>(null);

  useEffect(() => {
    setEvents([]);

    if (!session) return;

    const existingCalls: ToolCall[] = [];
    const tempWatcher = new Watcher(() => {}, allUsers);
    for (const file of session.outputFiles) {
      existingCalls.push(...tempWatcher.readExisting(file));
    }
    setEvents(existingCalls.slice(-MAX_EVENTS));

    const handler = (calls: ToolCall[]) => {
      const sessionCalls = calls.filter((c) => c.sessionId === session.sessionId);
      if (sessionCalls.length === 0) return;
      setEvents((prev) => [...prev, ...sessionCalls].slice(-MAX_EVENTS));
    };

    const watcher = new Watcher(handler, allUsers);
    watcherRef.current = watcher;
    watcher.start();

    return () => {
      watcher.stop();
      watcherRef.current = null;
    };
  }, [session?.sessionId, allUsers]);

  return events;
};
