import { FlexWidget, ListWidget, TextWidget, type HexColor } from 'react-native-android-widget';

import { dealLink, type WidgetRow } from '../core/widget';

export const WIDGET_NAME = 'HotDeals';

const PALETTE = {
  light: { bg: '#FFFFFF', text: '#1B1F24', muted: '#5F6B76', hot: '#C62828', line: '#E6E9ED', accent: '#2E7D32' },
  dark: { bg: '#1C2126', text: '#ECEFF1', muted: '#9AA5AF', hot: '#FF6B6B', line: '#2C333A', accent: '#66BB6A' },
} as const;

type Palette = (typeof PALETTE)['light'] | (typeof PALETTE)['dark'];

function Row({ row, c }: { row: WidgetRow; c: Palette }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: dealLink(row.id) }}
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
      }}
    >
      <FlexWidget
        style={{ width: 4, height: 30, borderRadius: 2, backgroundColor: row.storeColor as HexColor, marginRight: 8 }}
      />
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text={row.title}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 14, color: c.text, fontWeight: row.hot ? '700' : 'normal' }}
        />
        <TextWidget text={row.store} style={{ fontSize: 11, color: c.muted }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end', marginLeft: 8 }}>
        {row.price ? <TextWidget text={row.price} style={{ fontSize: 14, color: c.text, fontWeight: '700' }} /> : null}
        {row.badge ? (
          <TextWidget text={row.badge} maxLines={1} style={{ fontSize: 11, color: c.hot, fontWeight: '700' }} />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Widget({ rows, updated, c }: { rows: WidgetRow[]; updated?: string; c: Palette }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundColor: c.bg,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
      >
        <TextWidget text="🔥 Лучшие акции" style={{ fontSize: 16, fontWeight: '700', color: c.text }} />
        <FlexWidget style={{ flex: 1 }} />
        {updated ? <TextWidget text={updated} style={{ fontSize: 11, color: c.muted }} /> : null}
      </FlexWidget>
      {rows.length === 0 ? (
        <TextWidget
          clickAction="OPEN_APP"
          text="Откройте приложение, чтобы загрузить акции"
          style={{ fontSize: 13, color: c.muted, marginTop: 8 }}
        />
      ) : (
        <ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
          {rows.map((row) => (
            <Row key={row.id} row={row} c={c} />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

/** Light and dark versions; the launcher picks one by the system theme. */
export function hotDealsWidget(rows: WidgetRow[], updated?: string) {
  return {
    light: <Widget rows={rows} updated={updated} c={PALETTE.light} />,
    dark: <Widget rows={rows} updated={updated} c={PALETTE.dark} />,
  };
}
