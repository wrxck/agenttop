import { useState, useCallback } from 'react';

export interface TextInputState {
  value: string;
  isActive: boolean;
  start: (initial?: string) => void;
  cancel: () => void;
  confirm: () => string;
  handleInput: (
    input: string,
    key: { return?: boolean; escape?: boolean; backspace?: boolean; delete?: boolean },
  ) => boolean;
}

export const useTextInput = (onConfirm?: (value: string) => void): TextInputState => {
  const [value, setValue] = useState('');
  const [isActive, setIsActive] = useState(false);

  const start = useCallback((initial = '') => {
    setValue(initial);
    setIsActive(true);
  }, []);

  const cancel = useCallback(() => {
    setValue('');
    setIsActive(false);
  }, []);

  const confirm = useCallback(() => {
    const result = value;
    setIsActive(false);
    setValue('');
    onConfirm?.(result);
    return result;
  }, [value, onConfirm]);

  const handleInput = useCallback(
    (input: string, key: { return?: boolean; escape?: boolean; backspace?: boolean; delete?: boolean }): boolean => {
      if (!isActive) return false;

      if (key.escape) {
        cancel();
        return true;
      }

      if (key.return) {
        confirm();
        return true;
      }

      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1));
        return true;
      }

      if (input && input.length === 1 && input >= ' ') {
        setValue((v) => v + input);
        return true;
      }

      return true;
    },
    [isActive, cancel, confirm],
  );

  return { value, isActive, start, cancel, confirm, handleInput };
};
