import type { Session } from './types.js';

type Listener = (sessions: Session[]) => void;

let sessions: Session[] = [];
let refreshInFlight = false;
const listeners = new Set<Listener>();

export const getCachedSessions = (): Session[] => sessions;

export const setCachedSessions = (next: Session[]): void => {
  sessions = next;
  for (const fn of listeners) fn(next);
};

export const subscribe = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const isRefreshInFlight = (): boolean => refreshInFlight;
export const setRefreshInFlight = (v: boolean): void => {
  refreshInFlight = v;
};

export interface FileMetaEntry {
  mtimeMs: number;
  size: number;
  sessionId: string;
  cwd: string;
  version: string;
  gitBranch: string;
  model: string;
  usage: import('./types.js').TokenUsage;
}

const MAX_CACHE_ENTRIES = 500;
export const fileMetaCache = new Map<string, FileMetaEntry>();

export const pruneFileMetaCache = (validPaths: Set<string>): void => {
  for (const key of fileMetaCache.keys()) {
    if (!validPaths.has(key)) fileMetaCache.delete(key);
  }
  // hard limit
  if (fileMetaCache.size > MAX_CACHE_ENTRIES) {
    const excess = fileMetaCache.size - MAX_CACHE_ENTRIES;
    const iter = fileMetaCache.keys();
    for (let i = 0; i < excess; i++) {
      const next = iter.next();
      if (!next.done) fileMetaCache.delete(next.value);
    }
  }
};
