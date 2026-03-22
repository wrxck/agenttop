import { useState, useEffect, useRef, useMemo } from 'react';

import type { Session, ToolCall, ToolResult, ActivityEvent } from '../../discovery/types.js';
import { Watcher } from '../../ingestion/watcher.js';

const MAX_EVENTS = 200;

export const useActivityStream = (session: Session | Session[] | null, allUsers: boolean): ActivityEvent[] => {
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [results, setResults] = useState<ToolResult[]>([]);
  const watcherRef = useRef<Watcher | null>(null);

  const sessions = session === null ? [] : Array.isArray(session) ? session : [session];
  const sessionKey = sessions
    .map((s) => s.sessionId)
    .sort()
    .join(',');
  const sessionIdSet = new Set(sessions.map((s) => s.sessionId));

  useEffect(() => {
    setCalls([]);
    setResults([]);

    if (sessions.length === 0) return;

    let cancelled = false;

    const loadExisting = async () => {
      const tempWatcher = new Watcher(() => {}, allUsers);
      const allFiles = sessions.flatMap((s) => s.outputFiles);
      const seen = new Set<string>();
      const existingCalls: ToolCall[] = [];
      const existingResults: ToolResult[] = [];

      for (const file of allFiles) {
        if (cancelled) return;
        if (seen.has(file)) continue;
        seen.add(file);
        const { calls: c, results: r } = await tempWatcher.readExistingWithResultsAsync(file);
        existingCalls.push(...c);
        existingResults.push(...r);
      }

      if (cancelled) return;
      existingCalls.sort((a, b) => a.timestamp - b.timestamp);
      setCalls(existingCalls.slice(-MAX_EVENTS));
      setResults(existingResults);
    };

    loadExisting();

    const callHandler = (newCalls: ToolCall[]) => {
      const matched = newCalls.filter((c) => sessionIdSet.has(c.sessionId));
      if (matched.length === 0) return;
      setCalls((prev) => [...prev, ...matched].slice(-MAX_EVENTS));
    };

    const resultHandler = (newResults: ToolResult[]) => {
      const matched = newResults.filter((r) => sessionIdSet.has(r.sessionId));
      if (matched.length === 0) return;
      setResults((prev) => [...prev, ...matched].slice(-MAX_EVENTS * 2));
    };

    const watcher = new Watcher(callHandler, allUsers, undefined, undefined, resultHandler);
    watcherRef.current = watcher;
    watcher.start();

    return () => {
      cancelled = true;
      watcher.stop();
      watcherRef.current = null;
    };
  }, [sessionKey, allUsers]);

  return useMemo(() => {
    const resultMap = new Map<string, ToolResult>();
    for (const r of results) {
      resultMap.set(r.toolUseId, r);
    }
    return calls.map((call) => ({
      call,
      result: call.toolUseId ? resultMap.get(call.toolUseId) : undefined,
    }));
  }, [calls, results]);
};
