import { useState, useEffect, useRef } from 'react';

import type { Alert, AlertSeverity, SecurityEvent } from '../../discovery/types.js';
import { SecurityEngine } from '../../analysis/security.js';
import { Watcher } from '../../ingestion/watcher.js';

const MAX_ALERTS = 100;

export const useAlerts = (enabled: boolean, alertLevel: AlertSeverity, allUsers: boolean) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const engineRef = useRef(new SecurityEngine(alertLevel));
  const watcherRef = useRef<Watcher | null>(null);

  useEffect(() => {
    if (!enabled) return;

    engineRef.current = new SecurityEngine(alertLevel);

    const securityHandler = (events: SecurityEvent[]) => {
      const newAlerts: Alert[] = [];
      for (const event of events) {
        newAlerts.push(...engineRef.current.analyzeEvent(event));
      }
      if (newAlerts.length > 0) {
        setAlerts((prev) => [...prev, ...newAlerts].slice(-MAX_ALERTS));
      }
    };

    const watcher = new Watcher(() => {}, allUsers, securityHandler);
    watcherRef.current = watcher;
    watcher.start();

    return () => {
      watcher.stop();
      watcherRef.current = null;
    };
  }, [enabled, alertLevel, allUsers]);

  const clearAlerts = () => setAlerts([]);

  return { alerts, clearAlerts };
};
