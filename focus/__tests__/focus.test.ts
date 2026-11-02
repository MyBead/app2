import {
  DEFAULT_CONFIG,
  formatLeft,
  groupMissed,
  isAppBlocked,
  isBlocked,
  toggleBlocked,
  visibleBlockOptions,
  orderApps,
  parseJson,
  plural,
  toggleApp,
  toggleGroup,
  type AppInfo,
  type HiddenItem,
} from '../src/core/focus';

const telegram: AppInfo = { pkg: 'org.telegram.messenger', label: 'Telegram', group: 'messengers' };
const bank: AppInfo = { pkg: 'pl.bank', label: 'Bank', group: 'other' };

const item = (pkg: string, app: string, time: number, title = 't'): HiddenItem => ({
  key: `${pkg}-${time}`,
  pkg,
  app,
  title,
  text: '',
  time,
});

describe('blocking choices', () => {
  it('follows the group by default', () => {
    expect(isAppBlocked(DEFAULT_CONFIG, telegram)).toBe(true);
    expect(isAppBlocked(DEFAULT_CONFIG, bank)).toBe(false);
  });

  it('one tap on a group flips it', () => {
    const c = toggleGroup(DEFAULT_CONFIG, 'messengers');
    expect(c.blockedGroups).not.toContain('messengers');
    expect(toggleGroup(c, 'messengers').blockedGroups).toContain('messengers');
  });

  it('one tap on an app overrides its group, a second tap returns it to the group', () => {
    const once = toggleApp(DEFAULT_CONFIG, telegram);
    expect(once.apps[telegram.pkg]).toBe(false);
    expect(isAppBlocked(once, telegram)).toBe(false);
    const twice = toggleApp(once, telegram);
    expect(twice.apps).toEqual({});
    expect(isAppBlocked(twice, telegram)).toBe(true);
  });

  it('an app choice survives changes to its group', () => {
    const c = toggleGroup(toggleApp(DEFAULT_CONFIG, telegram), 'messengers');
    expect(isAppBlocked(c, telegram)).toBe(false);
    expect(isAppBlocked(toggleApp(DEFAULT_CONFIG, bank), bank)).toBe(true);
  });
});

describe('missed notifications', () => {
  it('groups by app, newest app first, newest item first', () => {
    const groups = groupMissed([item('a', 'A', 1), item('b', 'B', 5), item('a', 'A', 3)]);
    expect(groups.map((g) => [g.app, g.count])).toEqual([
      ['B', 1],
      ['A', 2],
    ]);
    expect(groups[1].items.map((i) => i.time)).toEqual([3, 1]);
  });

  it('puts apps that recently sent something first and filters by search', () => {
    const apps: AppInfo[] = [bank, telegram, { pkg: 'com.whatsapp', label: 'WhatsApp', group: 'messengers' }];
    expect(orderApps(apps, [item('com.whatsapp', 'WhatsApp', 9)], '').map((a) => a.label)).toEqual([
      'WhatsApp',
      'Bank',
      'Telegram',
    ]);
    expect(orderApps(apps, [], 'tele').map((a) => a.label)).toEqual(['Telegram']);
  });
});

describe('formatting', () => {
  it('time left', () => {
    expect(formatLeft(30_000)).toBe('меньше минуты');
    expect(formatLeft(5 * 60_000)).toBe('5 мин');
    expect(formatLeft(60 * 60_000)).toBe('1 ч');
    expect(formatLeft(65 * 60_000 - 1)).toBe('1 ч 5 мин');
  });

  it('russian plurals', () => {
    const f: [string, string, string] = ['уведомление', 'уведомления', 'уведомлений'];
    expect([1, 2, 5, 11, 21, 22, 112].map((n) => plural(n, f))).toEqual([
      'уведомление',
      'уведомления',
      'уведомлений',
      'уведомлений',
      'уведомление',
      'уведомления',
      'уведомлений',
    ]);
  });

  it('bad JSON falls back', () => {
    expect(parseJson('{', 1)).toBe(1);
    expect(parseJson(null, [])).toEqual([]);
  });
});

describe('what to block (Do Not Disturb)', () => {
  it('blocks messages and lets reminders, alarms and media through by default', () => {
    expect(isBlocked(DEFAULT_CONFIG, 'allowMessages')).toBe(true);
    expect(isBlocked(DEFAULT_CONFIG, 'allowReminders')).toBe(false);
    expect(isBlocked(DEFAULT_CONFIG, 'allowAlarms')).toBe(false);
    expect(isBlocked(DEFAULT_CONFIG, 'allowMedia')).toBe(false);
  });

  it('one tap flips a chip', () => {
    const c = toggleBlocked(DEFAULT_CONFIG, 'allowMessages');
    expect(isBlocked(c, 'allowMessages')).toBe(false);
    expect(isBlocked(toggleBlocked(c, 'allowMessages'), 'allowMessages')).toBe(true);
  });

  it('"important chats" is only offered while messages are blocked', () => {
    expect(visibleBlockOptions(DEFAULT_CONFIG).map((o) => o.key)).toContain('allowConversations');
    const open = toggleBlocked(DEFAULT_CONFIG, 'allowMessages');
    expect(visibleBlockOptions(open).map((o) => o.key)).not.toContain('allowConversations');
  });
});
