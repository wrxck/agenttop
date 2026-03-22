export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  error: string;
  critical: string;
  muted: string;
  text: string;
  bright: string;
  border: string;
  selected: string;
  header: string;
  waiting: string;   // yellow — waiting for user input
  stale: string;     // orange — idle/stale session
}

export interface ToolColors {
  Bash: string;
  Read: string;
  Write: string;
  Edit: string;
  Grep: string;
  Glob: string;
  Task: string;
  WebFetch: string;
  WebSearch: string;
}

export interface ThemeDefinition {
  name: string;
  colors: ThemeColors;
  toolColors: ToolColors;
  builtin?: boolean;
}

export const COLOR_KEYS: (keyof ThemeColors)[] = [
  'primary',
  'secondary',
  'accent',
  'warning',
  'error',
  'critical',
  'muted',
  'text',
  'bright',
  'border',
  'selected',
  'header',
  'waiting', 'stale',
];

export const TOOL_COLOR_KEYS: (keyof ToolColors)[] = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Grep',
  'Glob',
  'Task',
  'WebFetch',
  'WebSearch',
];

const deriveToolColors = (c: ThemeColors): ToolColors => ({
  Bash: c.error,
  Read: c.secondary,
  Write: c.accent,
  Edit: c.accent,
  Grep: c.primary,
  Glob: c.primary,
  Task: c.warning,
  WebFetch: c.warning,
  WebSearch: c.warning,
});

// Compact preset builder: [name, primary, secondary, accent, warning, error, critical,
//   muted, text, bright, border, selected, header, waiting, stale]
type PresetTuple = [
  string, string, string, string, string, string, string,
  string, string, string, string, string, string,
  string, string,
];

const fromTuple = ([
  name, primary, secondary, accent, warning, error, critical,
  muted, text, bright, border, selected, header,
  waiting, stale,
]: PresetTuple): ThemeDefinition => ({
  name,
  builtin: true,
  colors: { primary, secondary, accent, warning, error, critical, muted, text, bright, border, selected, header, waiting, stale },
  toolColors: deriveToolColors({
    primary, secondary, accent, warning, error, critical, muted, text, bright, border, selected, header, waiting, stale,
  }),
});

const PRESETS: PresetTuple[] = [
  [
    'one-dark',
    '#61AFEF',
    '#98C379',
    '#C678DD',
    '#E5C07B',
    '#E06C75',
    '#FF0000',
    '#5C6370',
    '#ABB2BF',
    '#FFFFFF',
    '#3E4451',
    '#2C313A',
    '#61AFEF',
    '#E5C07B', '#D19A66',
  ],
  [
    'dracula',
    '#BD93F9',
    '#50FA7B',
    '#FF79C6',
    '#F1FA8C',
    '#FF5555',
    '#FF0000',
    '#6272A4',
    '#F8F8F2',
    '#FFFFFF',
    '#44475A',
    '#383A59',
    '#BD93F9',
    '#F1FA8C', '#FFB86C',
  ],
  [
    'monokai-pro',
    '#78DCE8',
    '#A9DC76',
    '#AB9DF2',
    '#FFD866',
    '#FF6188',
    '#FF0000',
    '#727072',
    '#FCFCFA',
    '#FFFFFF',
    '#403E41',
    '#2D2A2E',
    '#78DCE8',
    '#FFD866', '#FC9867',
  ],
  [
    'solarized-dark',
    '#268BD2',
    '#859900',
    '#D33682',
    '#B58900',
    '#DC322F',
    '#FF0000',
    '#586E75',
    '#839496',
    '#FDF6E3',
    '#073642',
    '#002B36',
    '#268BD2',
    '#B58900', '#CB4B16',
  ],
  [
    'solarized-light',
    '#268BD2',
    '#859900',
    '#D33682',
    '#B58900',
    '#DC322F',
    '#FF0000',
    '#93A1A1',
    '#657B83',
    '#002B36',
    '#EEE8D5',
    '#FDF6E3',
    '#268BD2',
    '#B58900', '#CB4B16',
  ],
  [
    'nord',
    '#88C0D0',
    '#A3BE8C',
    '#B48EAD',
    '#EBCB8B',
    '#BF616A',
    '#FF0000',
    '#4C566A',
    '#D8DEE9',
    '#ECEFF4',
    '#3B4252',
    '#2E3440',
    '#88C0D0',
    '#EBCB8B', '#D08770',
  ],
  [
    'gruvbox-dark',
    '#83A598',
    '#B8BB26',
    '#D3869B',
    '#FABD2F',
    '#FB4934',
    '#FF0000',
    '#928374',
    '#EBDBB2',
    '#FBF1C7',
    '#3C3836',
    '#282828',
    '#83A598',
    '#FABD2F', '#FE8019',
  ],
  [
    'tokyo-night',
    '#7AA2F7',
    '#9ECE6A',
    '#BB9AF7',
    '#E0AF68',
    '#F7768E',
    '#FF0000',
    '#565F89',
    '#A9B1D6',
    '#C0CAF5',
    '#292E42',
    '#1A1B26',
    '#7AA2F7',
    '#E0AF68', '#FF9E64',
  ],
  [
    'catppuccin-mocha',
    '#89B4FA',
    '#A6E3A1',
    '#CBA6F7',
    '#F9E2AF',
    '#F38BA8',
    '#FF0000',
    '#6C7086',
    '#CDD6F4',
    '#FFFFFF',
    '#313244',
    '#1E1E2E',
    '#89B4FA',
    '#F9E2AF', '#FAB387',
  ],
  [
    'catppuccin-latte',
    '#1E66F5',
    '#40A02B',
    '#8839EF',
    '#DF8E1D',
    '#D20F39',
    '#FF0000',
    '#9CA0B0',
    '#4C4F69',
    '#11111B',
    '#E6E9EF',
    '#EFF1F5',
    '#1E66F5',
    '#DF8E1D', '#FE640B',
  ],
  [
    'rose-pine',
    '#9CCFD8',
    '#31748F',
    '#C4A7E7',
    '#F6C177',
    '#EB6F92',
    '#FF0000',
    '#6E6A86',
    '#E0DEF4',
    '#E0DEF4',
    '#26233A',
    '#191724',
    '#9CCFD8',
    '#F6C177', '#EA9D34',
  ],
  [
    'rose-pine-moon',
    '#9CCFD8',
    '#3E8FB0',
    '#C4A7E7',
    '#F6C177',
    '#EB6F92',
    '#FF0000',
    '#6E6A86',
    '#E0DEF4',
    '#E0DEF4',
    '#2A273F',
    '#232136',
    '#9CCFD8',
    '#F6C177', '#EA9D34',
  ],
  [
    'pastel-dark',
    '#89CFF0',
    '#77DD77',
    '#FDCFE8',
    '#FFD580',
    '#FF6961',
    '#FF0000',
    '#7B8794',
    '#D4D4D4',
    '#FFFFFF',
    '#3A3A4A',
    '#2B2B3A',
    '#89CFF0',
    '#FFD580', '#FFAA5E',
  ],
  [
    'kanagawa',
    '#7E9CD8',
    '#76946A',
    '#957FB8',
    '#E6C384',
    '#C34043',
    '#FF0000',
    '#727169',
    '#DCD7BA',
    '#FFFFFF',
    '#2A2A37',
    '#1F1F28',
    '#7E9CD8',
    '#E6C384', '#FFA066',
  ],
  [
    'everforest',
    '#7FBBB3',
    '#A7C080',
    '#D699B6',
    '#DBBC7F',
    '#E67E80',
    '#FF0000',
    '#859289',
    '#D3C6AA',
    '#FFFFFF',
    '#374145',
    '#2D353B',
    '#7FBBB3',
    '#DBBC7F', '#E69875',
  ],
];

export const BUILTIN_THEMES: ThemeDefinition[] = PRESETS.map(fromTuple);

export const getDefaultTheme = (): ThemeDefinition => BUILTIN_THEMES[0];

type CustomThemeMap = Record<string, { name: string; colors: ThemeColors; toolColors: ToolColors }>;

export const getAllThemes = (customThemes: CustomThemeMap): ThemeDefinition[] => [
  ...BUILTIN_THEMES,
  ...Object.values(customThemes).map((t) => ({ ...t, builtin: false })),
];

export const resolveTheme = (name: string, customThemes: CustomThemeMap): ThemeDefinition => {
  const builtin = BUILTIN_THEMES.find((t) => t.name === name);
  if (builtin) return builtin;
  const custom = customThemes[name];
  if (custom) return { ...custom, builtin: false };
  return getDefaultTheme();
};

export const deriveSeverityColors = (c: ThemeColors): Record<string, string> => ({
  info: c.muted,
  warn: c.warning,
  high: c.error,
  critical: c.critical,
});

export { deriveToolColors };
