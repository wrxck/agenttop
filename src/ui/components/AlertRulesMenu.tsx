import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

import type { Config, CustomAlertRule, SecurityRulesConfig } from '../../config/store.js';
import { colors } from '../theme.js';

interface AlertRulesMenuProps {
  config: Config;
  onClose: () => void;
  onSave: (config: Config) => void;
}

type View = 'list' | 'form';

type MatchType = CustomAlertRule['match'];
type SeverityType = CustomAlertRule['severity'];

const MATCH_OPTIONS: MatchType[] = ['input', 'output', 'toolName', 'all'];
const SEVERITY_OPTIONS: SeverityType[] = ['info', 'warn', 'high', 'critical'];

const RULE_LABELS: Record<keyof SecurityRulesConfig, string> = {
  network: 'Network detection',
  exfiltration: 'Exfiltration detection',
  sensitiveFiles: 'Sensitive files',
  shellEscape: 'Shell escape',
  injection: 'Prompt injection',
};

const BUILTIN_RULE_KEYS = Object.keys(RULE_LABELS) as (keyof SecurityRulesConfig)[];

type FormField = 'name' | 'pattern' | 'match' | 'severity' | 'message';
const FORM_FIELDS: FormField[] = ['name', 'pattern', 'match', 'severity', 'message'];

const FORM_LABELS: Record<FormField, string> = {
  name: 'Name',
  pattern: 'Pattern (regex)',
  match: 'Match target',
  severity: 'Severity',
  message: 'Message',
};

interface FormState {
  name: string;
  pattern: string;
  match: MatchType;
  severity: SeverityType;
  message: string;
}

const emptyForm = (): FormState => ({
  name: '',
  pattern: '',
  match: 'all',
  severity: 'warn',
  message: '',
});

const formFromRule = (rule: CustomAlertRule): FormState => ({
  name: rule.name,
  pattern: rule.pattern,
  match: rule.match,
  severity: rule.severity,
  message: rule.message,
});

const validatePattern = (pattern: string): string | null => {
  if (!pattern.trim()) return 'Pattern cannot be empty';
  try {
    new RegExp(pattern);
    return null;
  } catch {
    return 'Invalid regex';
  }
};

export const AlertRulesMenu: React.FC<AlertRulesMenuProps> = React.memo(({ config, onClose, onSave }) => {
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 40;
  const [localConfig, setLocalConfig] = useState<Config>(() => JSON.parse(JSON.stringify(config)));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [view, setView] = useState<View>('list');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormState>(emptyForm());
  const [formField, setFormField] = useState<number>(0);
  const [formError, setFormError] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // index into custom rules

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  };

  // Build list items: stale timeout row + 5 built-in rules + custom rules
  // Index 0: stale timeout
  // Index 1..5: built-in rules
  // Index 6+: custom rules
  const customRules = localConfig.alerts.custom || [];
  const totalItems = 1 + BUILTIN_RULE_KEYS.length + customRules.length;

  const isStaleRow = (idx: number) => idx === 0;
  const isBuiltinRow = (idx: number) => idx >= 1 && idx <= BUILTIN_RULE_KEYS.length;
  const isCustomRow = (idx: number) => idx > BUILTIN_RULE_KEYS.length;
  const getBuiltinKey = (idx: number) => BUILTIN_RULE_KEYS[idx - 1];
  const getCustomIndex = (idx: number) => idx - BUILTIN_RULE_KEYS.length - 1;

  useInput((input, key) => {
    if (view === 'form') {
      const currentField = FORM_FIELDS[formField];

      if (key.escape) {
        setView('list');
        setFormError('');
        return;
      }

      // For match and severity fields, cycle with enter or space
      if (currentField === 'match') {
        if (key.return || input === ' ') {
          const idx = MATCH_OPTIONS.indexOf(formData.match);
          setFormData((f) => ({ ...f, match: MATCH_OPTIONS[(idx + 1) % MATCH_OPTIONS.length] }));
          return;
        }
        if (key.downArrow) {
          setFormField((f) => Math.min(f + 1, FORM_FIELDS.length - 1));
          return;
        }
        if (key.upArrow) {
          setFormField((f) => Math.max(f - 1, 0));
          return;
        }
        if (key.tab) {
          // Tab advances to next field
          if (formField < FORM_FIELDS.length - 1) {
            setFormField((f) => f + 1);
          }
          return;
        }
        return;
      }

      if (currentField === 'severity') {
        if (key.return || input === ' ') {
          const idx = SEVERITY_OPTIONS.indexOf(formData.severity);
          setFormData((f) => ({ ...f, severity: SEVERITY_OPTIONS[(idx + 1) % SEVERITY_OPTIONS.length] }));
          return;
        }
        if (key.downArrow) {
          setFormField((f) => Math.min(f + 1, FORM_FIELDS.length - 1));
          return;
        }
        if (key.upArrow) {
          setFormField((f) => Math.max(f - 1, 0));
          return;
        }
        if (key.tab) {
          if (formField < FORM_FIELDS.length - 1) {
            setFormField((f) => f + 1);
          }
          return;
        }
        return;
      }

      // Text fields: name, pattern, message
      if (key.return) {
        // Validate pattern before advancing past it
        if (currentField === 'pattern') {
          const err = validatePattern(formData.pattern);
          if (err) {
            setFormError(err);
            return;
          }
          setFormError('');
        }

        if (formField < FORM_FIELDS.length - 1) {
          setFormField((f) => f + 1);
          return;
        }

        // Last field -- save
        if (!formData.name.trim()) {
          setFormError('Name cannot be empty');
          return;
        }
        const patErr = validatePattern(formData.pattern);
        if (patErr) {
          setFormError(patErr);
          return;
        }

        const newRule: CustomAlertRule = {
          name: formData.name.trim(),
          pattern: formData.pattern,
          match: formData.match,
          severity: formData.severity,
          message: formData.message.trim(),
          enabled: true,
        };

        setLocalConfig((c) => {
          const customs = [...(c.alerts.custom || [])];
          if (editingIndex !== null) {
            newRule.enabled = customs[editingIndex].enabled;
            customs[editingIndex] = newRule;
          } else {
            customs.push(newRule);
          }
          const updated = { ...c, alerts: { ...c.alerts, custom: customs } };
          onSave(updated);
          return updated;
        });

        showToast(editingIndex !== null ? `Updated '${newRule.name}'` : `Added '${newRule.name}'`);
        setView('list');
        setFormError('');
        return;
      }

      if (key.backspace || key.delete) {
        setFormData((f) => ({ ...f, [currentField]: (f[currentField] as string).slice(0, -1) }));
        setFormError('');
        return;
      }

      if (key.upArrow) {
        setFormField((f) => Math.max(f - 1, 0));
        return;
      }
      if (key.downArrow || key.tab) {
        if (currentField === 'pattern') {
          const err = validatePattern(formData.pattern);
          if (err && formData.pattern.trim()) {
            setFormError(err);
            return;
          }
        }
        setFormField((f) => Math.min(f + 1, FORM_FIELDS.length - 1));
        return;
      }

      if (input && input.length === 1) {
        setFormData((f) => ({ ...f, [currentField]: (f[currentField] as string) + input }));
        setFormError('');
        return;
      }
      return;
    }

    // List view
    if (key.escape) {
      onSave(localConfig);
      onClose();
      return;
    }

    if (key.upArrow) {
      setSelectedIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIdx((i) => Math.min(totalItems - 1, i + 1));
      return;
    }

    // Space: toggle
    if (input === ' ') {
      if (isStaleRow(selectedIdx)) return; // no toggle on stale timeout
      if (isBuiltinRow(selectedIdx)) {
        const ruleKey = getBuiltinKey(selectedIdx);
        setLocalConfig((c) => {
          const updated = {
            ...c,
            security: { ...c.security, rules: { ...c.security.rules, [ruleKey]: !c.security.rules[ruleKey] } },
          };
          onSave(updated);
          return updated;
        });
        return;
      }
      if (isCustomRow(selectedIdx)) {
        const ci = getCustomIndex(selectedIdx);
        setLocalConfig((c) => {
          const customs = [...(c.alerts.custom || [])];
          customs[ci] = { ...customs[ci], enabled: !customs[ci].enabled };
          const updated = { ...c, alerts: { ...c.alerts, custom: customs } };
          onSave(updated);
          return updated;
        });
        return;
      }
      return;
    }

    // +/- for stale timeout
    if (isStaleRow(selectedIdx)) {
      if (input === '+' || input === '=') {
        setLocalConfig((c) => {
          const updated = { ...c, alerts: { ...c.alerts, staleTimeout: c.alerts.staleTimeout + 15 } };
          onSave(updated);
          return updated;
        });
        return;
      }
      if (input === '-' || input === '_') {
        setLocalConfig((c) => {
          const newTimeout = Math.max(15, c.alerts.staleTimeout - 15);
          const updated = { ...c, alerts: { ...c.alerts, staleTimeout: newTimeout } };
          onSave(updated);
          return updated;
        });
        return;
      }
    }

    // n: new custom rule
    if (input === 'n') {
      setFormData(emptyForm());
      setFormField(0);
      setEditingIndex(null);
      setFormError('');
      setView('form');
      return;
    }

    // e: edit selected custom rule
    if (input === 'e' && isCustomRow(selectedIdx)) {
      const ci = getCustomIndex(selectedIdx);
      const rule = customRules[ci];
      setFormData(formFromRule(rule));
      setFormField(0);
      setEditingIndex(ci);
      setFormError('');
      setView('form');
      return;
    }

    // d: delete selected custom rule
    if (input === 'd' && isCustomRow(selectedIdx)) {
      const ci = getCustomIndex(selectedIdx);
      const name = customRules[ci].name;
      setLocalConfig((c) => {
        const customs = [...(c.alerts.custom || [])];
        customs.splice(ci, 1);
        const updated = { ...c, alerts: { ...c.alerts, custom: customs } };
        onSave(updated);
        return updated;
      });
      setSelectedIdx((i) => Math.min(i, totalItems - 2));
      showToast(`Deleted '${name}'`);
      return;
    }
  });

  if (view === 'form') {
    const currentField = FORM_FIELDS[formField];
    return (
      <Box flexDirection="column" height={termHeight}>
        <Box
          borderStyle="round"
          borderColor={colors.primary}
          flexDirection="column"
          paddingX={2}
          paddingY={1}
          height={termHeight}
        >
          <Box justifyContent="space-between" marginBottom={1}>
            <Text color={colors.header} bold>
              {editingIndex !== null ? 'EDIT RULE' : 'NEW RULE'}
            </Text>
            <Text color={colors.muted}>enter:next/save esc:cancel</Text>
          </Box>

          {FORM_FIELDS.map((field, fi) => {
            const isCurrent = fi === formField;
            const value = formData[field];
            const isTextInput = field === 'name' || field === 'pattern' || field === 'message';
            const displayValue = isTextInput
              ? isCurrent
                ? `${value}_`
                : value || '(empty)'
              : field === 'match'
                ? `${value} (space to cycle)`
                : `${value} (space to cycle)`;

            return (
              <Box key={field}>
                <Text color={isCurrent ? colors.primary : colors.text}>
                  {isCurrent ? '> ' : '  '}
                  {FORM_LABELS[field]}:{' '}
                </Text>
                <Text color={isCurrent ? colors.bright : colors.muted}>{displayValue}</Text>
              </Box>
            );
          })}

          {formError && (
            <Box marginTop={1} paddingX={2}>
              <Text color={colors.error}>{formError}</Text>
            </Box>
          )}

          <Box marginTop={1} paddingX={2}>
            <Text color={colors.muted}>
              {currentField === 'match' || currentField === 'severity'
                ? 'space/enter: cycle options | up/down: move fields'
                : 'type to edit | enter: next field | up/down: move fields'}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // List view
  const contentHeight = termHeight - 6;
  const halfView = Math.floor(contentHeight / 2);
  const scrollStart = Math.max(0, Math.min(selectedIdx - halfView, totalItems - contentHeight));
  const visibleStart = Math.max(0, scrollStart);
  const visibleEnd = Math.min(totalItems, visibleStart + contentHeight);

  return (
    <Box flexDirection="column" height={termHeight}>
      <Box
        borderStyle="round"
        borderColor={colors.primary}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        height={termHeight}
      >
        <Box justifyContent="space-between" marginBottom={1}>
          <Text color={colors.header} bold>
            ALERT RULES
          </Text>
          <Text color={colors.muted}>space:toggle n:new e:edit d:delete esc:close</Text>
        </Box>

        {/* Stale timeout row */}
        {visibleStart === 0 && (
          <Box marginBottom={1}>
            <Box>
              <Text color={colors.accent} bold>
                {'  '}STALE SESSION
              </Text>
            </Box>
          </Box>
        )}

        {Array.from({ length: visibleEnd - visibleStart }, (_, vi) => {
          const idx = visibleStart + vi;
          const isSelected = idx === selectedIdx;

          if (isStaleRow(idx)) {
            const timeout = localConfig.alerts.staleTimeout;
            return (
              <Box key="stale-timeout">
                <Text color={isSelected ? colors.primary : colors.text}>
                  {isSelected ? '> ' : '  '} Stale timeout {'............ '}
                </Text>
                <Text color={colors.bright}>{timeout}s</Text>
                <Text color={colors.muted}> (+/-)</Text>
              </Box>
            );
          }

          if (isBuiltinRow(idx)) {
            const ruleKey = getBuiltinKey(idx);
            const label = RULE_LABELS[ruleKey];
            const enabled = localConfig.security.rules[ruleKey];
            // Show header before first built-in
            const showHeader = idx === 1 && visibleStart <= 1;
            return (
              <React.Fragment key={`builtin-${ruleKey}`}>
                {showHeader && (
                  <Box marginTop={1}>
                    <Text color={colors.accent} bold>
                      {'  '}BUILT-IN RULES
                    </Text>
                  </Box>
                )}
                <Box>
                  <Text color={isSelected ? colors.primary : colors.text}>
                    {isSelected ? '> ' : '  '} {label} {'.'.repeat(Math.max(2, 28 - label.length))}{' '}
                  </Text>
                  <Text color={enabled ? colors.secondary : colors.error}>{enabled ? 'ON' : 'OFF'}</Text>
                </Box>
              </React.Fragment>
            );
          }

          if (isCustomRow(idx)) {
            const ci = getCustomIndex(idx);
            const rule = customRules[ci];
            // Show header before first custom
            const showHeader = ci === 0;
            return (
              <React.Fragment key={`custom-${ci}`}>
                {showHeader && (
                  <Box marginTop={1}>
                    <Text color={colors.accent} bold>
                      {'  '}CUSTOM RULES
                    </Text>
                  </Box>
                )}
                <Box>
                  <Text color={isSelected ? colors.primary : colors.text}>
                    {isSelected ? '> ' : '  '} {rule.name}{' '}
                  </Text>
                  <Text color={colors.muted}>/{rule.pattern}/ </Text>
                  <Text color={rule.enabled ? colors.secondary : colors.error}>{rule.enabled ? 'ON' : 'OFF'}</Text>
                </Box>
              </React.Fragment>
            );
          }

          return null;
        })}

        {toast && (
          <Box marginTop={1} paddingX={2}>
            <Text color={colors.warning}>{toast}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});
