import { useState, useEffect } from 'react';

import { checkForUpdate } from '../../updates.js';
import type { UpdateInfo } from '../../updates.js';

export const useUpdateChecker = (
  disabled: boolean,
  checkOnLaunch: boolean,
  checkInterval: number,
): UpdateInfo | null => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (disabled || !checkOnLaunch) return;
    try {
      const i = checkForUpdate();
      if (i.available) setUpdateInfo(i);
    } catch {
      /* */
    }
    const iv = setInterval(() => {
      try {
        const i = checkForUpdate();
        if (i.available) setUpdateInfo(i);
      } catch {
        /* */
      }
    }, checkInterval);
    return () => clearInterval(iv);
  }, []);

  return updateInfo;
};
