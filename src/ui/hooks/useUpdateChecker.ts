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

    let cancelled = false;

    const check = () => {
      checkForUpdate()
        .then((i) => {
          if (!cancelled && i.available) setUpdateInfo(i);
        })
        .catch(() => {});
    };

    check();
    const iv = setInterval(check, checkInterval);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  return updateInfo;
};
