import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import type { Session, ToolCall, ToolResult, ActivityEvent } from '../../discovery/types.js';
import { Watcher } from '../../ingestion/watcher.js';

const MAX_EVENTS = 200;
const DEBOUNCE_MS = 80;

export const useActivityStream = (session: Session | Session[] | null, allUsers: boolean): ActivityEvent[] => {
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [results, setResults] = useState<ToolResult[]>([]);
  const watcherRef = useRef<Watcher | null>(null);
  const pendingCallsRef = useRef<ToolCall[]>([]);
  const pendingResultsRef = useRef<ToolResult[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessions = session === null ? [] : Array.isArray(session) ? session : [session];
  const sessionKey = sessions
    .map((s) => s.sessionId)
    .sort()
    .join(',');
  const sessionIdSet = new Set(sessions.map((s) => s.sessionId));

  const flush = useCallback(() => {
    flushTimerRef.current = null;
    const pc = pendingCallsRef.current;
    const pr = pendingResultsRef.current;
    if (pc.length > 0) {
      const batch = pc.splice(0);
      setCalls((prev) => [...prev, ...batch].slice(-MAX_EVENTS));
    }
    if (pr.length > 0) {
      const batch = pr.splice(0);
      setResults((prev) => [...prev, ...batch].slice(-MAX_EVENTS * 2));
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flush, DEBOUNCE_MS);
    }
  }, [flush]);

  useEffect(() => {
    setCalls([]);
    setResults([]);
    pendingCallsRef.current = [];
    pendingResultsRef.current = [];

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
      pendingCallsRef.current.push(...matched);
      scheduleFlush();
    };

    const resultHandler = (newResults: ToolResult[]) => {
      const matched = newResults.filter((r) => sessionIdSet.has(r.sessionId));
      if (matched.length === 0) return;
      pendingResultsRef.current.push(...matched);
      scheduleFlush();
    };

    const watcher = new Watcher(callHandler, allUsers, undefined, undefined, resultHandler);
    watcherRef.current = watcher;
    watcher.start();

    return () => {
      cancelled = true;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
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
