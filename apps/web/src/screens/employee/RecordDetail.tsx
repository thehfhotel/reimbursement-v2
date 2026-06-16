import type { AppState, Theme } from '../../lib/types';
import type { Nav } from '../../lib/router';
import { fmtN, formatThaiDate } from '../../lib/format';
import { FONT_DISPLAY, FONT_UI } from '../../lib/theme';
import { AppBar } from '../../components/AppBar';
import { Card, DetailRow, IconBtn, PrimaryButton, SectionHeader } from '../../components/primitives';
import { Icon } from '../../components/icons';
import { ReceiptPhoto } from '../../components/Receipts';

interface RecordDetailProps {
  theme: Theme;
  state: AppState;
  nav: Nav;
  recordId: string;
}

export function RecordDetail({ theme, state, nav, recordId }: RecordDetailProps) {
  const r = state.receipts.find((x) => x.id === recordId);
  if (!r) return null;
  const [whole, frac] = fmtN(r.amount).split('.');

  return (
    <div style={{ paddingBottom: 100 }}>
      <AppBar
        theme={theme}
        title="ใบเสร็จ"
        leading={
          <IconBtn theme={theme} onClick={() => nav({ name: 'home' })}>
            {Icon.back(theme.ink)}
          </IconBtn>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 20px 28px' }}>
        <ReceiptPhoto receipt={r} height={300} />
      </div>

      <div style={{ padding: '0 20px', textAlign: 'center', marginBottom: 28 }}>
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 11,
            color: theme.inkSoft,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {r.merchant}
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 64,
            fontWeight: 400,
            letterSpacing: -1.8,
            color: theme.ink,
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 36, opacity: 0.5, marginRight: 4, verticalAlign: 'top' }}>฿</span>
          {whole}
          <span style={{ opacity: 0.5 }}>.{frac}</span>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <Card theme={theme} padding={0}>
          <DetailRow theme={theme} label="หมวดหมู่" value={r.category} />
          <DetailRow theme={theme} label="วันที่" value={formatThaiDate(r.date)} />
          <DetailRow theme={theme} label="หมายเหตุ" value={r.note || '—'} />
          <DetailRow theme={theme} label="สถานะ" value="ฉบับร่าง · ยังไม่ได้รวม" last />
        </Card>

        {r.items.length > 0 && (
          <>
            <SectionHeader theme={theme} title="รายการ" />
            <Card theme={theme} padding={0}>
              {r.items.map(([label, val], i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px 18px',
                    borderBottom: i < r.items.length - 1 ? `0.5px solid ${theme.hairline}` : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: FONT_UI,
                  }}
                >
                  <span style={{ color: theme.ink, fontSize: 14 }}>{label}</span>
                  <span
                    style={{
                      color: theme.ink,
                      fontSize: 14,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ฿{val}
                  </span>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>

      <div style={{ padding: '24px 20px' }}>
        <PrimaryButton theme={theme} onClick={() => nav({ name: 'bundle-new', id: r.id })}>
          เพิ่มในชุดเบิก
        </PrimaryButton>
      </div>
    </div>
  );
}
