import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import Fokus from '../../modules/fokus';
import {
  DEFAULT_CONFIG,
  parseJson,
  type AppInfo,
  type FocusConfig,
  type FocusState,
  type HiddenItem,
} from '../core/focus';

const EMPTY: FocusState = {
  active: false,
  until: 0,
  startedAt: 0,
  sessionHidden: 0,
  listenerEnabled: false,
  dndAccess: false,
  exactAlarms: true,
  canAddTile: false,
  sdk: 0,
  config: DEFAULT_CONFIG,
};

function read(): { state: FocusState; log: HiddenItem[] } {
  if (!Fokus) return { state: EMPTY, log: [] };
  const state = parseJson<FocusState>(Fokus.getState(), EMPTY);
  return { state: { ...state, config: { ...DEFAULT_CONFIG, ...state.config } }, log: parseJson(Fokus.getLog(), []) };
}

/** Focus state from the native side, refreshed on changes (tile, timer, new hidden notifications). */
export function useFocus() {
  const [{ state, log }, setData] = useState(read);
  const [now, setNow] = useState(() => Date.now());
  const [apps, setApps] = useState<AppInfo[] | null>(null);

  const refresh = useCallback(() => {
    setData(read());
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!Fokus) return;
    const sub = Fokus.addListener('onChange', refresh);
    const app = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      sub.remove();
      app.remove();
    };
  }, [refresh]);

  // Countdown while a timed session runs; re-reading also notices the end of the session.
  useEffect(() => {
    if (!state.active) return;
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [state.active, refresh]);

  const setConfig = useCallback(
    (config: FocusConfig) => {
      if (!Fokus) return;
      setData((d) => ({ ...d, state: { ...d.state, config } }));
      Fokus.setConfig(JSON.stringify(config));
      refresh();
    },
    [refresh],
  );

  const loadApps = useCallback(async () => {
    if (!Fokus || apps) return;
    setApps(parseJson<AppInfo[]>(await Fokus.getApps(), []));
  }, [apps]);

  return { native: Fokus, state, log, now, apps, loadApps, setConfig, refresh };
}
