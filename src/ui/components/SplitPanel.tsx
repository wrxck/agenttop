import React from 'react';
import { Box } from 'ink';

import type { ActivityEvent } from '../../discovery/types.js';
import type { Session } from '../../discovery/types.js';
import type { Panel } from '../App.js';
import { colors } from '../theme.js';
import { ActivityFeed } from './ActivityFeed.js';
import { SessionDetail } from './SessionDetail.js';

interface SplitPanelProps {
  activePanel: Panel;
  leftSession: Session | null;
  rightSession: Session | null;
  leftEvents: ActivityEvent[];
  rightEvents: ActivityEvent[];
  leftScroll: number;
  rightScroll: number;
  leftFilter: string;
  rightFilter: string;
  leftShowDetail: boolean;
  rightShowDetail: boolean;
  height: number;
}

export const SplitPanel: React.FC<SplitPanelProps> = React.memo(
  ({
    activePanel,
    leftSession,
    rightSession,
    leftEvents,
    rightEvents,
    leftScroll,
    rightScroll,
    leftFilter,
    rightFilter,
    leftShowDetail,
    rightShowDetail,
    height,
  }) => {
    const left =
      leftShowDetail && leftSession ? (
        <SessionDetail session={leftSession} focused={activePanel === 'left'} height={height} />
      ) : (
        <ActivityFeed
          events={leftEvents}
          sessionSlug={leftSession?.slug ?? null}
          sessionId={leftSession?.sessionId}
          status={leftSession ? leftSession.status : undefined}
          focused={activePanel === 'left'}
          height={height}
          scrollOffset={leftScroll}
          filter={leftFilter || undefined}
        />
      );

    const right =
      rightShowDetail && rightSession ? (
        <SessionDetail session={rightSession} focused={activePanel === 'right'} height={height} />
      ) : (
        <ActivityFeed
          events={rightEvents}
          sessionSlug={rightSession?.slug ?? null}
          sessionId={rightSession?.sessionId}
          status={rightSession ? rightSession.status : undefined}
          focused={activePanel === 'right'}
          height={height}
          scrollOffset={rightScroll}
          filter={rightFilter || undefined}
        />
      );

    return (
      <Box flexDirection="row" flexGrow={1}>
        <Box
          flexGrow={1}
          borderStyle="single"
          borderRight
          borderTop={false}
          borderBottom={false}
          borderLeft={false}
          borderColor={colors.border}
        >
          {left}
        </Box>
        {right}
      </Box>
    );
  },
);
