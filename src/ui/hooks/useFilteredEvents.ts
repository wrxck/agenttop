import { useMemo } from 'react';

import type { ActivityEvent } from '../../discovery/types.js';

const applyFilter = (events: ActivityEvent[], filter: string): ActivityEvent[] => {
  if (!filter) return events;
  const lower = filter.toLowerCase();
  return events.filter(
    (e) =>
      e.call.toolName.toLowerCase().includes(lower) || JSON.stringify(e.call.toolInput).toLowerCase().includes(lower),
  );
};

export const useFilteredEvents = (rawEvents: ActivityEvent[], filter: string): ActivityEvent[] =>
  useMemo(() => applyFilter(rawEvents, filter), [rawEvents, filter]);
