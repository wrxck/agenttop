import { useState, useCallback } from 'react';

import type { Session } from '../../discovery/types.js';
import type { Panel } from '../App.js';

export const useSplitPanel = () => {
  const [splitMode, setSplitMode] = useState(false);
  const [leftSession, setLeftSession] = useState<Session | null>(null);
  const [rightSession, setRightSession] = useState<Session | null>(null);
  const [leftScroll, setLeftScroll] = useState(0);
  const [rightScroll, setRightScroll] = useState(0);
  const [leftFilter, setLeftFilter] = useState('');
  const [rightFilter, setRightFilter] = useState('');
  const [leftShowDetail, setLeftShowDetail] = useState(false);
  const [rightShowDetail, setRightShowDetail] = useState(false);

  const clearSplitState = useCallback(() => {
    setSplitMode(false);
    setLeftSession(null);
    setRightSession(null);
    setLeftScroll(0);
    setRightScroll(0);
    setLeftFilter('');
    setRightFilter('');
    setLeftShowDetail(false);
    setRightShowDetail(false);
  }, []);

  const resetPanel = useCallback((side: 'left' | 'right') => {
    if (side === 'left') {
      setLeftSession(null);
      setLeftScroll(0);
      setLeftFilter('');
      setLeftShowDetail(false);
    } else {
      setRightSession(null);
      setRightScroll(0);
      setRightFilter('');
      setRightShowDetail(false);
    }
  }, []);

  const switchPanel = useCallback(
    (dir: 'next' | 'prev', setActivePanel: (p: Panel | ((p: Panel) => Panel)) => void) => {
      if (splitMode) {
        const order: Panel[] = ['sessions', 'left', 'right'];
        setActivePanel((p) => {
          const idx = order.indexOf(p);
          if (idx === -1) return 'sessions';
          return dir === 'next' ? order[(idx + 1) % order.length] : order[(idx - 1 + order.length) % order.length];
        });
      } else {
        setActivePanel((p) => (p === 'sessions' ? 'activity' : 'sessions'));
      }
    },
    [splitMode],
  );

  return {
    splitMode,
    setSplitMode,
    leftSession,
    setLeftSession,
    rightSession,
    setRightSession,
    leftScroll,
    setLeftScroll,
    rightScroll,
    setRightScroll,
    leftFilter,
    setLeftFilter,
    rightFilter,
    setRightFilter,
    leftShowDetail,
    setLeftShowDetail,
    rightShowDetail,
    setRightShowDetail,
    clearSplitState,
    resetPanel,
    switchPanel,
  };
};
