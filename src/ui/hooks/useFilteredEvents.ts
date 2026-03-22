import { useMemo } from 'react';

import type { ToolCall } from '../../discovery/types.js';

const applyFilter = (events: ToolCall[], filter: string): ToolCall[] => {
  if (!filter) return events;
  const lower = filter.toLowerCase();
  return events.filter(
    (e) => e.toolName.toLowerCase().includes(lower) || JSON.stringify(e.toolInput).toLowerCase().includes(lower),
  );
};

export const useFilteredEvents = (
  rawEvents: ToolCall[],
  filter: string,
): ToolCall[] => useMemo(() => applyFilter(rawEvents, filter), [rawEvents, filter]);
