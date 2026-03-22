import { useInput } from 'ink';

import type { KeybindingsConfig } from '../../config/store.js';
import type { Session, SessionGroup } from '../../discovery/types.js';
import type { TextInputState } from './useTextInput.js';
import type { Panel } from '../App.js';

type InputMode = 'normal' | 'nickname' | 'filter';

const matchKey = (binding: string, input: string, key: Record<string, unknown>): boolean => {
  if (binding === 'tab') return Boolean(key.tab);
  if (binding === 'shift+tab') return Boolean(key.shift && key.tab);
  if (binding === 'enter') return Boolean(key.return);
  return input === binding;
};

export interface KeyHandlerDeps {
  kb: KeybindingsConfig;
  activePanel: Panel;
  splitMode: boolean;
  inputMode: InputMode;
  showSetup: boolean;
  showSettings: boolean;
  showDetail: boolean;
  showEventDetail: boolean;
  leftShowDetail: boolean;
  rightShowDetail: boolean;
  confirmAction: unknown;
  selectedSession: Session | null;
  selectedGroup: SessionGroup | null;
  toggleExpand: (groupKey: string) => void;
  leftSession: Session | null;
  rightSession: Session | null;
  leftScroll: number;
  rightScroll: number;
  leftFilter: string;
  rightFilter: string;
  filter: string;
  activityFilter: string;
  viewingArchive: boolean;
  archivedIds: Set<string>;
  maxScroll: number;
  leftMaxScroll: number;
  rightMaxScroll: number;
  activityEventCount: number;
  selectedEventIndex: number;
  showUpdateModal: boolean;
  updateInfo: { available: boolean; latest?: string } | null;

  exit: () => void;
  selectNext: () => void;
  selectPrev: () => void;
  refresh: () => void;
  switchPanel: (dir: 'next' | 'prev') => void;
  clearSplitState: () => void;
  resetPanel: (side: 'left' | 'right') => void;
  getActiveFilter: () => string;

  setActivePanel: (p: Panel | ((p: Panel) => Panel)) => void;
  setInputMode: (m: InputMode) => void;
  setFilter: (v: string) => void;
  setActivityFilter: (v: string) => void;
  setLeftFilter: (v: string) => void;
  setRightFilter: (v: string) => void;
  setShowDetail: (v: boolean) => void;
  setLeftShowDetail: (v: boolean | ((d: boolean) => boolean)) => void;
  setRightShowDetail: (v: boolean | ((d: boolean) => boolean)) => void;
  setShowSettings: (v: boolean) => void;
  showAlertRules: boolean;
  setShowAlertRules: (v: boolean) => void;
  setViewingArchive: (v: boolean | ((v: boolean) => boolean)) => void;
  setSplitMode: (v: boolean) => void;
  setLeftSession: (v: Session | null) => void;
  setRightSession: (v: Session | null) => void;
  setLeftScroll: (v: number | ((s: number) => number)) => void;
  setRightScroll: (v: number | ((s: number) => number)) => void;
  setActivityScroll: (v: number | ((s: number) => number)) => void;
  setSelectedEventIndex: (v: number | ((i: number) => number)) => void;
  setShowEventDetail: (v: boolean) => void;
  setConfirmAction: (v: { title: string; message: string; onConfirm: () => void } | null) => void;
  setUpdateStatus: (v: string) => void;
  setSidebarWidth: (v: number | ((w: number) => number)) => void;

  nicknameInput: TextInputState;
  filterInput: TextInputState;

  onClearNickname: (sessionId: string) => void;
  onArchive: (sessionId: string) => void;
  onUnarchive: (sessionId: string) => void;
  onDelete: (sess: Session) => void;
  onUpdate: () => void;
}

export const useKeyHandler = (deps: KeyHandlerDeps): void => {
  const d = deps;

  useInput((input, key) => {
    if (d.showSetup || d.showSettings || d.confirmAction || d.showUpdateModal) return;

    if (d.inputMode === 'nickname') {
      d.nicknameInput.handleInput(input, key);
      return;
    }
    if (d.inputMode === 'filter') {
      if (key.escape) {
        if (d.activePanel === 'sessions') d.setFilter('');
        else if (d.activePanel === 'left') d.setLeftFilter('');
        else if (d.activePanel === 'right') d.setRightFilter('');
        else d.setActivityFilter('');
        d.setInputMode('normal');
        d.filterInput.cancel();
        return;
      }
      d.filterInput.handleInput(input, key);
      return;
    }

    if (matchKey(d.kb.quit, input, key)) {
      d.exit();
      return;
    }

    if (d.showEventDetail) {
      if (key.escape || key.return || key.leftArrow) d.setShowEventDetail(false);
      return;
    }

    if (d.showDetail && !d.splitMode) {
      if (key.escape || key.return || key.leftArrow) d.setShowDetail(false);
      return;
    }
    if (d.splitMode && (d.leftShowDetail || d.rightShowDetail)) {
      if (key.escape || key.return) {
        if (d.activePanel === 'left') d.setLeftShowDetail(false);
        else if (d.activePanel === 'right') d.setRightShowDetail(false);
        else {
          d.setLeftShowDetail(false);
          d.setRightShowDetail(false);
        }
        return;
      }
      if (key.leftArrow) {
        if (d.activePanel === 'left') d.setLeftShowDetail(false);
        else if (d.activePanel === 'right') d.setRightShowDetail(false);
        return;
      }
    }

    if (matchKey(d.kb.split, input, key)) {
      if (d.splitMode) {
        d.clearSplitState();
      } else {
        d.setSplitMode(true);
        d.setLeftSession(d.selectedSession);
        d.setActivePanel('left');
      }
      return;
    }

    if (d.splitMode && d.activePanel === 'sessions' && d.selectedSession) {
      if (matchKey(d.kb.pinLeft, input, key)) {
        d.resetPanel('left');
        d.setLeftSession(d.selectedSession);
        return;
      }
      if (matchKey(d.kb.pinRight, input, key)) {
        d.resetPanel('right');
        d.setRightSession(d.selectedSession);
        return;
      }
    }

    if (d.splitMode && matchKey(d.kb.swapPanels, input, key)) {
      const tmpLs = d.leftSession;
      const tmpRs = d.rightSession;
      d.setLeftSession(tmpRs);
      d.setRightSession(tmpLs);
      const tmpScroll = d.leftScroll;
      d.setLeftScroll(d.rightScroll);
      d.setRightScroll(tmpScroll);
      const tmpFilt = d.leftFilter;
      d.setLeftFilter(d.rightFilter);
      d.setRightFilter(tmpFilt);
      const tmpDetail = d.leftShowDetail;
      d.setLeftShowDetail(d.rightShowDetail);
      d.setRightShowDetail(tmpDetail);
      return;
    }

    if (d.splitMode && matchKey(d.kb.closePanel, input, key)) {
      if (d.activePanel === 'left') {
        d.resetPanel('left');
        if (!d.rightSession) d.clearSplitState();
      } else if (d.activePanel === 'right') {
        d.resetPanel('right');
        if (!d.leftSession) d.clearSplitState();
      }
      return;
    }

    if (matchKey(d.kb.detail, input, key) && d.activePanel === 'sessions' && d.selectedGroup) {
      d.toggleExpand(d.selectedGroup.key);
      return;
    }

    if (matchKey(d.kb.detail, input, key) && d.selectedSession) {
      if (d.splitMode) {
        if (d.activePanel === 'left') {
          d.setLeftShowDetail((v) => !v);
          return;
        }
        if (d.activePanel === 'right') {
          d.setRightShowDetail((v) => !v);
          return;
        }
        if (d.activePanel === 'sessions') {
          if (!d.leftSession) {
            d.setLeftSession(d.selectedSession);
            d.setLeftShowDetail(true);
            d.setActivePanel('left');
          } else if (!d.rightSession) {
            d.setRightSession(d.selectedSession);
            d.setRightShowDetail(true);
            d.setActivePanel('right');
          }
          return;
        }
      } else if (d.activePanel === 'sessions') {
        d.setShowDetail(true);
        return;
      }
    }

    if (matchKey(d.kb.panelNext, input, key) || key.rightArrow) {
      d.switchPanel('next');
      return;
    }
    if (matchKey(d.kb.panelPrev, input, key) || key.leftArrow) {
      d.switchPanel('prev');
      return;
    }

    if (matchKey(d.kb.nickname, input, key) && d.selectedSession) {
      d.setInputMode('nickname');
      d.nicknameInput.start(d.selectedSession.nickname || '');
      return;
    }
    if (matchKey(d.kb.clearNickname, input, key) && d.selectedSession) {
      d.onClearNickname(d.selectedSession.sessionId);
      return;
    }
    if (matchKey(d.kb.filter, input, key)) {
      d.setInputMode('filter');
      d.filterInput.start(d.getActiveFilter());
      return;
    }
    if (key.escape) {
      if (d.activePanel === 'sessions' && d.filter) {
        d.setFilter('');
        return;
      }
      if (d.activePanel === 'activity' && d.activityFilter) {
        d.setActivityFilter('');
        return;
      }
      if (d.activePanel === 'left' && d.leftFilter) {
        d.setLeftFilter('');
        return;
      }
      if (d.activePanel === 'right' && d.rightFilter) {
        d.setRightFilter('');
        return;
      }
      return;
    }
    if (matchKey(d.kb.settings, input, key)) {
      d.setShowSettings(true);
      return;
    }
    if (matchKey(d.kb.alertRules, input, key)) {
      d.setShowAlertRules(true);
      return;
    }
    if (matchKey(d.kb.viewArchive, input, key)) {
      d.setViewingArchive((v) => !v);
      return;
    }
    if (matchKey(d.kb.archive, input, key) && d.selectedSession) {
      if (d.viewingArchive) d.onUnarchive(d.selectedSession.sessionId);
      else d.onArchive(d.selectedSession.sessionId);
      return;
    }
    if (matchKey(d.kb.delete, input, key) && d.selectedSession) {
      d.onDelete(d.selectedSession);
      return;
    }
    if (matchKey(d.kb.update, input, key) && d.updateInfo?.available) {
      d.onUpdate();
      return;
    }

    if (d.activePanel === 'sessions') {
      if (matchKey(d.kb.sidebarWider, input, key)) {
        d.setSidebarWidth((w) => Math.min(w + 5, 60));
        return;
      }
      if (matchKey(d.kb.sidebarNarrower, input, key)) {
        d.setSidebarWidth((w) => Math.max(w - 5, 20));
        return;
      }
      if (matchKey(d.kb.navDown, input, key) || key.downArrow) d.selectNext();
      if (matchKey(d.kb.navUp, input, key) || key.upArrow) d.selectPrev();
    }
    if (d.activePanel === 'activity') {
      if (matchKey(d.kb.navDown, input, key) || key.downArrow) {
        d.setSelectedEventIndex((i) => Math.min(i + 1, d.activityEventCount - 1));
      }
      if (matchKey(d.kb.navUp, input, key) || key.upArrow) {
        d.setSelectedEventIndex((i) => Math.max(i - 1, 0));
      }
      if (matchKey(d.kb.scrollBottom, input, key)) {
        d.setSelectedEventIndex(d.activityEventCount - 1);
      }
      if (matchKey(d.kb.scrollTop, input, key)) {
        d.setSelectedEventIndex(0);
      }
      if (matchKey(d.kb.detail, input, key) && d.activityEventCount > 0) {
        d.setShowEventDetail(true);
      }
    }
    if (d.activePanel === 'left') {
      if (matchKey(d.kb.navUp, input, key) || key.upArrow) d.setLeftScroll((s) => Math.min(s + 1, d.leftMaxScroll));
      if (matchKey(d.kb.navDown, input, key) || key.downArrow) d.setLeftScroll((s) => Math.max(s - 1, 0));
      if (matchKey(d.kb.scrollBottom, input, key)) d.setLeftScroll(0);
      if (matchKey(d.kb.scrollTop, input, key)) d.setLeftScroll(d.leftMaxScroll);
    }
    if (d.activePanel === 'right') {
      if (matchKey(d.kb.navUp, input, key) || key.upArrow) d.setRightScroll((s) => Math.min(s + 1, d.rightMaxScroll));
      if (matchKey(d.kb.navDown, input, key) || key.downArrow) d.setRightScroll((s) => Math.max(s - 1, 0));
      if (matchKey(d.kb.scrollBottom, input, key)) d.setRightScroll(0);
      if (matchKey(d.kb.scrollTop, input, key)) d.setRightScroll(d.rightMaxScroll);
    }
  });
};
