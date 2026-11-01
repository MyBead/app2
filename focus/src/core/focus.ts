// Pure logic and labels for the focus screen (no React Native imports — covered by tests).

export type Group = 'messengers' | 'social' | 'mail' | 'shopping' | 'games' | 'sms' | 'other';
export type Callers = 'any' | 'contacts' | 'starred';

export interface FocusConfig {
  blockedGroups: Group[];
  /** Per-app choice that overrides the group: true = hide, false = let through. */
  apps: Record<string, boolean>;
  /** Do Not Disturb for everything that is not hidden; calls still ring. */
  silence: boolean;
  callers: Callers;
  repeatCallers: boolean;
  /** Session length; 0 = until turned off. */
  minutes: number;
}

export interface FocusState {
  active: boolean;
  until: number;
  startedAt: number;
  sessionHidden: number;
  listenerEnabled: boolean;
  dndAccess: boolean;
  exactAlarms: boolean;
  canAddTile: boolean;
  sdk: number;
  config: FocusConfig;
}

export interface HiddenItem {
  key: string;
  pkg: string;
  app: string;
  title: string;
  text: string;
  time: number;
}

export interface AppInfo {
  pkg: string;
  label: string;
  group: Group;
}

export const GROUPS: { id: Group; emoji: string; label: string; hint: string }[] = [
  { id: 'messengers', emoji: '💬', label: 'Мессенджеры', hint: 'Telegram, WhatsApp, Viber, Slack…' },
  { id: 'social', emoji: '📱', label: 'Соцсети и видео', hint: 'Instagram, TikTok, YouTube, VK…' },
  { id: 'mail', emoji: '✉️', label: 'Почта', hint: 'Gmail, Outlook…' },
  { id: 'shopping', emoji: '🛒', label: 'Покупки и реклама', hint: 'Allegro, OLX, Temu, доставка, новости' },
  { id: 'games', emoji: '🎮', label: 'Игры', hint: '' },
  { id: 'sms', emoji: '📨', label: 'SMS', hint: 'коды из банка тоже здесь' },
  { id: 'other', emoji: '📦', label: 'Всё остальное', hint: 'приложения не из списков выше' },
];

export const DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 25, label: '25 мин' },
  { minutes: 60, label: '1 час' },
  { minutes: 120, label: '2 часа' },
  { minutes: 0, label: 'Пока не выключу' },
];

export const CALLERS: { id: Callers; label: string }[] = [
  { id: 'any', label: 'Все' },
  { id: 'contacts', label: 'Контакты' },
  { id: 'starred', label: 'Избранные' },
];

export const DEFAULT_CONFIG: FocusConfig = {
  blockedGroups: ['messengers', 'social', 'mail', 'shopping', 'games'],
  apps: {},
  silence: true,
  callers: 'any',
  repeatCallers: true,
  minutes: 0,
};

export function groupLabel(id: Group): string {
  return GROUPS.find((g) => g.id === id)?.label ?? id;
}

/** Whether an app's notifications are hidden: its own choice first, then its group. */
export function isAppBlocked(config: FocusConfig, app: AppInfo): boolean {
  return config.apps[app.pkg] ?? config.blockedGroups.includes(app.group);
}

/** One tap on a group chip. */
export function toggleGroup(config: FocusConfig, id: Group): FocusConfig {
  const on = config.blockedGroups.includes(id);
  return {
    ...config,
    blockedGroups: on ? config.blockedGroups.filter((g) => g !== id) : [...config.blockedGroups, id],
  };
}

/**
 * One tap on an app: flips what happens to it. A choice equal to the group's is dropped,
 * so the app keeps following its group afterwards.
 */
export function toggleApp(config: FocusConfig, app: AppInfo): FocusConfig {
  const next = !isAppBlocked(config, app);
  const apps = { ...config.apps };
  if (next === config.blockedGroups.includes(app.group)) delete apps[app.pkg];
  else apps[app.pkg] = next;
  return { ...config, apps };
}

/** "осталось 1 ч 5 мин" / "осталось 3 мин" / "меньше минуты". */
export function formatLeft(ms: number): string {
  if (ms < 60_000) return 'меньше минуты';
  const total = Math.ceil(ms / 60_000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

export function formatClock(time: number): string {
  const d = new Date(time);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Russian plural: plural(5, ['уведомление', 'уведомления', 'уведомлений']). */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export interface MissedGroup {
  pkg: string;
  app: string;
  count: number;
  last: number;
  items: HiddenItem[];
}

/** Hidden notifications grouped by app, the most recent app first. */
export function groupMissed(log: HiddenItem[]): MissedGroup[] {
  const byPkg = new Map<string, MissedGroup>();
  for (const item of log) {
    let g = byPkg.get(item.pkg);
    if (!g) {
      g = { pkg: item.pkg, app: item.app, count: 0, last: 0, items: [] };
      byPkg.set(item.pkg, g);
    }
    g.count++;
    g.last = Math.max(g.last, item.time);
    g.items.push(item);
  }
  const groups = [...byPkg.values()];
  for (const g of groups) g.items.sort((a, b) => b.time - a.time);
  return groups.sort((a, b) => b.last - a.last);
}

/**
 * Apps for the per-app list: the ones that recently sent something first (they are the
 * likely distractions), then the rest alphabetically; filtered by the search text.
 */
export function orderApps(apps: AppInfo[], log: HiddenItem[], query: string): AppInfo[] {
  const recent = new Map<string, number>();
  for (const item of log) recent.set(item.pkg, Math.max(recent.get(item.pkg) ?? 0, item.time));
  const q = query.trim().toLowerCase();
  const list = q ? apps.filter((a) => a.label.toLowerCase().includes(q) || a.pkg.includes(q)) : apps;
  return [...list].sort((a, b) => {
    const ra = recent.get(a.pkg) ?? 0;
    const rb = recent.get(b.pkg) ?? 0;
    if (ra !== rb) return rb - ra;
    return a.label.localeCompare(b.label);
  });
}

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
