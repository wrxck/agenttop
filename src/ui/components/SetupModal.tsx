import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { colors } from '../theme.js';

type PromptChoice = 'yes' | 'not_now' | 'dismiss';

interface SetupStep {
  title: string;
  description: string;
}

interface SetupModalProps {
  steps: SetupStep[];
  onComplete: (results: PromptChoice[]) => void;
}

const OPTIONS: Array<{ label: string; value: PromptChoice }> = [
  { label: 'Yes', value: 'yes' },
  { label: 'Not now', value: 'not_now' },
  { label: "Don't ask again", value: 'dismiss' },
];

export const SetupModal: React.FC<SetupModalProps> = React.memo(({ steps, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(0);
  const [results, setResults] = useState<PromptChoice[]>([]);

  const step = steps[stepIndex];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedOption((i) => Math.max(0, i - 1));
    }
    if (key.downArrow) {
      setSelectedOption((i) => Math.min(OPTIONS.length - 1, i + 1));
    }
    if (key.return) {
      const choice = OPTIONS[selectedOption].value;
      const newResults = [...results, choice];
      if (stepIndex + 1 >= steps.length) {
        onComplete(newResults);
      } else {
        setResults(newResults);
        setStepIndex(stepIndex + 1);
        setSelectedOption(0);
      }
    }
  });

  if (!step) return null;

  return (
    <Box flexDirection="column" paddingX={4} paddingY={2}>
      <Box borderStyle="round" borderColor={colors.primary} flexDirection="column" paddingX={3} paddingY={1}>
        <Box marginBottom={1}>
          <Text color={colors.header} bold>
            agenttop setup ({stepIndex + 1}/{steps.length})
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color={colors.bright} bold>
            {step.title}
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color={colors.text}>{step.description}</Text>
        </Box>

        {OPTIONS.map((opt, i) => (
          <Box key={opt.value}>
            <Text color={i === selectedOption ? colors.primary : colors.muted}>
              {i === selectedOption ? '> ' : '  '}
              {opt.label}
            </Text>
          </Box>
        ))}

        <Box marginTop={1}>
          <Text color={colors.muted}>Use arrow keys + Enter to select</Text>
        </Box>
      </Box>
    </Box>
  );
});
