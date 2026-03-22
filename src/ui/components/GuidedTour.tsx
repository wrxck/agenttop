import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { colors } from '../theme.js';

interface TourStep {
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    title: 'Session list',
    body: 'The left panel shows all active Claude Code sessions. Use j/k to navigate and Enter to view details.',
  },
  {
    title: 'Activity feed',
    body: 'The right panel streams tool calls in real-time. Press Tab to switch between panels.',
  },
  {
    title: 'Split view',
    body: 'Press x to split the activity panel. Pin sessions to left (1) or right (2) panels. Press S to swap.',
  },
  {
    title: 'Filtering',
    body: 'Press / to filter sessions or activity by keyword. Works in any panel.',
  },
  {
    title: 'Session management',
    body: 'Press n to nickname a session, a to archive it, d to delete it. Press A to view archived sessions.',
  },
  {
    title: 'Security alerts',
    body: 'The alert bar highlights suspicious tool calls like network access or sensitive file reads.',
  },
  {
    title: 'Themes & settings',
    body: 'Press s to open settings. Customise keybindings, manage themes, and configure updates.',
  },
];

interface GuidedTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = React.memo(({ onComplete, onSkip }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  useInput((input, key) => {
    if (key.return || key.rightArrow) {
      if (isLast) onComplete();
      else setStepIndex((i) => i + 1);
    }
    if (key.leftArrow && stepIndex > 0) setStepIndex((i) => i - 1);
    if (input === 'q' || key.escape) onSkip();
  });

  return (
    <Box flexDirection="column" paddingX={4} paddingY={1}>
      <Box borderStyle="round" borderColor={colors.primary} flexDirection="column" paddingX={3} paddingY={1}>
        <Box marginBottom={1}>
          <Text color={colors.header} bold>
            Quick tour ({stepIndex + 1}/{STEPS.length})
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color={colors.bright} bold>
            {step.title}
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color={colors.text}>{step.body}</Text>
        </Box>
        <Text color={colors.muted}>
          {isLast ? 'Enter = finish' : 'Enter/\u2192 = next'} | {stepIndex > 0 ? '\u2190 = back | ' : ''}q = skip tour
        </Text>
      </Box>
    </Box>
  );
});
