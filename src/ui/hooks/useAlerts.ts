import { useState, useEffect, useRef } from 'react';

import type { Alert, AlertSeverity, SecurityEvent } from '../../discovery/types.js';
import { SecurityEngine } from '../../analysis/security.js';
import { Watcher } from '../../ingestion/watcher.js';
import { notify } from '../../notifications.js';
import { AlertLogger } from '../../alerts/logger.js';
import type { Config } from '../../config/store.js';

const MAX_ALERTS = 100;

export const useAlerts = (enabled: boolean, alertLevel: AlertSeverity, allUsers: boolean, config?: Config) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const engineRef = useRef(new SecurityEngine(alertLevel));
  const watcherRef = useRef<Watcher | null>(null);
  const loggerRef = useRef<AlertLogger | null>(null);

  useEffect(() => {
    if (!enabled) return;

    engineRef.current = new SecurityEngine(alertLevel);

    if (config?.alerts.enabled) {
      loggerRef.current = new AlertLogger(config);
    }

    const securityHandler = (events: SecurityEvent[]) => {
      const newAlerts: Alert[] = [];
      for (const event of events) {
        newAlerts.push(...engineRef.current.analyzeEvent(event));
      }
      if (newAlerts.length > 0) {
        for (const alert of newAlerts) {
          if (config) {
            notify(alert, config.notifications);
          }
          loggerRef.current?.log(alert);
        }
        setAlerts((prev) => [...prev, ...newAlerts].slice(-MAX_ALERTS));
      }
    };

    const watcher = new Watcher(() => {}, allUsers, securityHandler);
    watcherRef.current = watcher;
    watcher.start();

    return () => {
      watcher.stop();
      watcherRef.current = null;
      loggerRef.current = null;
    };
  }, [enabled, alertLevel, allUsers, config]);

  const clearAlerts = () => setAlerts([]);

  return { alerts, clearAlerts };
};
