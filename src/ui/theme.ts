export const colors = {
  primary: '#61AFEF',
  secondary: '#98C379',
  accent: '#C678DD',
  warning: '#E5C07B',
  error: '#E06C75',
  critical: '#FF0000',
  muted: '#5C6370',
  text: '#ABB2BF',
  bright: '#FFFFFF',
  border: '#3E4451',
  selected: '#2C313A',
  header: '#61AFEF',
};

export const severityColors: Record<string, string> = {
  info: colors.muted,
  warn: colors.warning,
  high: colors.error,
  critical: colors.critical,
};

export const toolColors: Record<string, string> = {
  Bash: colors.error,
  Read: colors.secondary,
  Write: colors.accent,
  Edit: colors.accent,
  Grep: colors.primary,
  Glob: colors.primary,
  Task: colors.warning,
  WebFetch: colors.warning,
  WebSearch: colors.warning,
};

export const getToolColor = (toolName: string): string =>
  toolColors[toolName] || colors.text;
