import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

import type { ActivityEvent } from '../../discovery/types.js';
import { colors, getToolColor } from '../theme.js';
import { formatTime } from '../format.js';

interface ToolCallDetailProps {
  event: ActivityEvent;
  focused: boolean;
  height: number;
}

const renderBash = (event: ActivityEvent): string[] => {
  const lines: string[] = [];
  const cmd = String(event.call.toolInput.command || '');
  lines.push('$ ' + cmd);
  if (event.result) {
    lines.push('');
    lines.push(...event.result.content.split('\n'));
  }
  return lines;
};

const renderRead = (event: ActivityEvent): string[] => {
  const lines: string[] = [];
  lines.push('file: ' + String(event.call.toolInput.file_path || ''));
  if (event.call.toolInput.offset) lines.push('offset: ' + String(event.call.toolInput.offset));
  if (event.call.toolInput.limit) lines.push('limit: ' + String(event.call.toolInput.limit));
  if (event.result) {
    lines.push('');
    lines.push(...event.result.content.split('\n'));
  }
  return lines;
};

const renderWrite = (event: ActivityEvent): string[] => {
  const lines: string[] = [];
  lines.push('file: ' + String(event.call.toolInput.file_path || ''));
  const content = String(event.call.toolInput.content || '');
  if (content) {
    lines.push('');
    lines.push('--- content ---');
    lines.push(...content.split('\n'));
  }
  if (event.result) {
    lines.push('');
    lines.push('--- result ---');
    lines.push(...event.result.content.split('\n'));
  }
  return lines;
};

const renderEdit = (event: ActivityEvent): string[] => {
  const lines: string[] = [];
  lines.push('file: ' + String(event.call.toolInput.file_path || ''));
  const oldStr = String(event.call.toolInput.old_string || '');
  const newStr = String(event.call.toolInput.new_string || '');
  if (oldStr || newStr) {
    lines.push('');
    for (const l of oldStr.split('\n')) {
      lines.push('- ' + l);
    }
    lines.push('---');
    for (const l of newStr.split('\n')) {
      lines.push('+ ' + l);
    }
  }
  if (event.result) {
    lines.push('');
    lines.push('--- result ---');
    lines.push(...event.result.content.split('\n'));
  }
  return lines;
};

const renderGrepGlob = (event: ActivityEvent): string[] => {
  const lines: string[] = [];
  const pattern = String(event.call.toolInput.pattern || '');
  const path = String(event.call.toolInput.path || '');
  lines.push('pattern: ' + pattern);
  if (path) lines.push('path: ' + path);
  if (event.result) {
    lines.push('');
    lines.push(...event.result.content.split('\n'));
  }
  return lines;
};

const renderTask = (event: ActivityEvent): string[] => {
  const lines: string[] = [];
  const desc = String(event.call.toolInput.description || '');
  const prompt = String(event.call.toolInput.prompt || '');
  lines.push('description: ' + desc);
  if (prompt) {
    lines.push('');
    lines.push('--- prompt ---');
    lines.push(...prompt.split('\n'));
  }
  if (event.result) {
    lines.push('');
    lines.push('--- result ---');
    lines.push(...event.result.content.split('\n'));
  }
  return lines;
};

const renderWebFetch = (event: ActivityEvent): string[] => {
  const lines: string[] = [];
  lines.push('url: ' + String(event.call.toolInput.url || ''));
  if (event.call.toolInput.prompt) lines.push('prompt: ' + String(event.call.toolInput.prompt));
  if (event.result) {
    lines.push('');
    lines.push(...event.result.content.split('\n'));
  }
  return lines;
};

const renderWebSearch = (event: ActivityEvent): string[] => {
  const lines: string[] = [];
  lines.push('query: ' + String(event.call.toolInput.query || ''));
  if (event.result) {
    lines.push('');
    lines.push(...event.result.content.split('\n'));
  }
  return lines;
};

const renderDefault = (event: ActivityEvent): string[] => {
  const lines: string[] = [];
  lines.push('--- input ---');
  lines.push(JSON.stringify(event.call.toolInput, null, 2));
  if (event.result) {
    lines.push('');
    lines.push('--- result ---');
    lines.push(...event.result.content.split('\n'));
  }
  return lines;
};

const getDetailLines = (event: ActivityEvent): string[] => {
  switch (event.call.toolName) {
    case 'Bash':
      return renderBash(event);
    case 'Read':
      return renderRead(event);
    case 'Write':
      return renderWrite(event);
    case 'Edit':
      return renderEdit(event);
    case 'Grep':
    case 'Glob':
      return renderGrepGlob(event);
    case 'Task':
      return renderTask(event);
    case 'WebFetch':
      return renderWebFetch(event);
    case 'WebSearch':
      return renderWebSearch(event);
    default:
      return renderDefault(event);
  }
};

export const ToolCallDetail: React.FC<ToolCallDetailProps> = React.memo(({ event, focused, height }) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  const contentLines = getDetailLines(event);
  const viewportRows = height - 4; // header + footer
  const maxScroll = Math.max(0, contentLines.length - viewportRows);
  const start = Math.min(scrollOffset, maxScroll);
  const visible = contentLines.slice(start, start + viewportRows);

  useInput(
    (input, key) => {
      if (!focused) return;
      if (input === 'j' || key.downArrow) setScrollOffset((s) => Math.min(s + 1, maxScroll));
      if (input === 'k' || key.upArrow) setScrollOffset((s) => Math.max(s - 1, 0));
      if (input === 'G') setScrollOffset(maxScroll);
      if (input === 'g') setScrollOffset(0);
    },
    { isActive: focused },
  );

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      overflow="hidden"
      borderStyle="single"
      borderColor={focused ? colors.primary : colors.border}
    >
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text color={getToolColor(event.call.toolName)} bold>
            {event.call.toolName}
          </Text>
          <Text color={colors.muted}> {formatTime(event.call.timestamp)}</Text>
          <Text color={colors.muted}> {event.call.slug}</Text>
          {event.result?.isError && <Text color={colors.error}> ERROR</Text>}
        </Box>
        <Text color={colors.muted}>Esc:back j/k:scroll</Text>
      </Box>

      <Box flexDirection="column" paddingX={1}>
        {visible.map((line, i) => {
          let lineColor = colors.text;
          if (line.startsWith('- ') && event.call.toolName === 'Edit') lineColor = colors.error;
          else if (line.startsWith('+ ') && event.call.toolName === 'Edit') lineColor = colors.secondary;
          else if (line.startsWith('$ ')) lineColor = colors.bright;
          else if (line.startsWith('---')) lineColor = colors.muted;
          else if (event.result?.isError) lineColor = colors.error;

          return (
            <Text key={`${start + i}`} color={lineColor} wrap="truncate">
              {line}
            </Text>
          );
        })}
      </Box>

      {contentLines.length > viewportRows && (
        <Box paddingX={1} justifyContent="flex-end">
          <Text color={colors.muted}>
            [{start + 1}-{Math.min(start + viewportRows, contentLines.length)}/{contentLines.length}]
          </Text>
        </Box>
      )}
    </Box>
  );
});
