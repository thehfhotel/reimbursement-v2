import { useState } from 'react';
import type { AppState, BundleWithDetails, Receipt, Theme } from '../../lib/types';
import type { Nav } from '../../lib/router';
import { fmt, fmtN, formatThaiDate } from '../../lib/format';
import { FONT_DISPLAY, FONT_UI } from '../../lib/theme';
import { api } from '../../lib/api';
import { AppBar } from '../../components/AppBar';
import {
  Avatar,
  Card,
  GhostButton,
  IconBtn,
  Money,
  PrimaryButton,
  SectionHeader,
  StatusPill,
} from '../../components/primitives';
import { Icon } from '../../components/icons';
import { ReceiptPhoto, ReceiptThumb } from '../../components/Receipts';

interface ReviewProps {
  theme: Theme;
  state: AppState;
  nav: Nav;
  bundleId: string;
  setState: (updater: (s: AppState) => AppState) => void;
}

export function Review({ theme, state, nav, bundleId, setState }: ReviewProps) {
  const found = state.bundles.find((x) => x.id === bundleId);
  const [b, setB] = useState<BundleWithDetails | undefined>(found);
  const [photoIdx, setPhotoIdx] = useState<number | null>(null);

  if (!b) return null;
  const items = b.receipts;
  const total = items.reduce((s, r) => s + r.amount, 0);
  const [whole, frac] = fmtN(total).split('.');

  const applyServerUpdate = (updated: BundleWithDetails) => {
    setB(updated);
    setState((s) => ({
      ...s,
      bundles: s.bundles.map((x) => (x.id === updated.id ? updated : x)),
    }));
  };

  const handleApprove = async () => {
    const updated = await api.bundles.approve(b.id);
    applyServerUpdate(updated);
  };

  const handleReject = async () => {
    const updated = await api.bundles.reject(b.id);
    applyServerUpdate(updated);
  };

  return (
    <div style={{ position: 'relative' }}>
      <AppBar
        theme={theme}
        leading={
          <IconBtn theme={theme} onClick={() => nav({ name: 'approver-home' })}>
            {Icon.back(theme.ink)}
          </IconBtn>
        }
        title="ตรวจสอบ"
      />

      <div style={{ padding: '0 20px 18px' }}>
        <StatusPill status={b.status} theme={theme} />
        <h1
          style={{
            margin: '10px 0 6px',
            fontFamily: FONT_DISPLAY,
            fontWeight: 400,
            fontSize: 32,
            lineHeight: 1.05,
            letterSpacing: -0.6,
            color: theme.ink,
          }}
        >
          {b.name}
        </h1>
        <div style={{ fontFamily: FONT_UI, fontSize: 13, color: theme.inkSoft, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            theme={theme}
            initials={b.submitter.name
              .split(' ')
              .map((s) => s[0] ?? '')
              .join('')}
            size={22}
          />
          {b.submitter.name}
        </div>
      </div>

      <div style={{ padding: '0 20px 8px' }}>
        <Card theme={theme} padding={20}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  color: theme.inkSoft,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                ยอดเบิก
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: FONT_DISPLAY,
                  fontSize: 44,
                  color: theme.ink,
                  lineHeight: 1,
                  letterSpacing: -1.2,
                }}
              >
                <span style={{ fontSize: 26, opacity: 0.5, marginRight: 4, verticalAlign: 'top' }}>฿</span>
                {whole}
                <span style={{ opacity: 0.5 }}>.{frac}</span>
              </div>
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 12, color: theme.inkSoft, textAlign: 'right' }}>
              {items.length} รายการ
              <br />
              ส่ง {formatThaiDate(b.submittedAt)}
            </div>
          </div>
          {b.note && (
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `0.5px solid ${theme.hairline}`,
                fontFamily: FONT_DISPLAY,
                fontSize: 16,
                color: theme.ink,
                fontStyle: 'italic',
              }}
            >
              "{b.note}"
            </div>
          )}
        </Card>
      </div>

      <SectionHeader theme={theme} title={`ใบเสร็จ · ${items.length}`} />
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '4px 20px 16px' }}>
        {items.map((r, i) => (
          <div
            key={r.id}
            onClick={() => setPhotoIdx(i)}
            style={{ cursor: 'pointer', flexShrink: 0 }}
          >
            <ReceiptPhoto receipt={r} height={216} slim rotate={i % 2 === 0 ? -1.5 : 1.5} />
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>
        <SectionHeader theme={theme} title="รายละเอียด" />
        <Card theme={theme} padding={0}>
          {items.map((r, i) => (
            <div
              key={r.id}
              onClick={() => setPhotoIdx(i)}
              style={{
                padding: '14px 18px',
                borderBottom: i < items.length - 1 ? `0.5px solid ${theme.hairline}` : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
              }}
            >
              <ReceiptThumb receipt={r} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 500, color: theme.ink }}>
                  {r.merchant}
                </div>
                <div style={{ fontFamily: FONT_UI, fontSize: 12, color: theme.inkSoft, marginTop: 2 }}>
                  {r.category} · {formatThaiDate(r.date)} {r.note && `· ${r.note}`}
                </div>
              </div>
              <Money value={r.amount} theme={theme} size={15} weight={500} />
            </div>
          ))}
          <div
            style={{
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              background: theme.surface2,
              borderRadius: '0 0 18px 18px',
            }}
          >
            <span style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 600, color: theme.ink }}>รวม</span>
            <Money value={total} theme={theme} size={18} accent weight={600} />
          </div>
        </Card>
      </div>

      {photoIdx !== null && (
        <PhotoLightbox
          items={items}
          index={photoIdx}
          onClose={() => setPhotoIdx(null)}
          setIndex={setPhotoIdx}
        />
      )}

      {b.status === 'pending' && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: '24px 20px 28px',
            background: `linear-gradient(180deg, transparent, ${theme.paper} 25%)`,
            display: 'flex',
            gap: 10,
          }}
        >
          <GhostButton theme={theme} onClick={handleReject}>
            ปฏิเสธ
          </GhostButton>
          <div style={{ flex: 1 }}>
            <PrimaryButton theme={theme} onClick={handleApprove}>
              อนุมัติ · {fmt(total)}
            </PrimaryButton>
          </div>
        </div>
      )}

      {b.status === 'approved' && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: '24px 20px 28px',
            background: `linear-gradient(180deg, transparent, ${theme.paper} 25%)`,
          }}
        >
          <PrimaryButton theme={theme} onClick={() => nav({ name: 'approver-pay', id: b.id })}>
            บันทึกจ่ายเงิน &amp; แนบสลิป
          </PrimaryButton>
        </div>
      )}

      {b.status === 'paid' && (
        <div style={{ padding: '12px 20px 28px' }}>
          <Card theme={theme} padding={18}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: theme.success,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {Icon.check('#fff')}
              </div>
              <span style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 600, color: theme.ink }}>
                จ่ายแล้ว {formatThaiDate(b.paidAt)}
              </span>
            </div>
            <BankReceipt theme={theme} bundle={b} />
          </Card>
        </div>
      )}
    </div>
  );
}

interface PhotoLightboxProps {
  items: Receipt[];
  index: number;
  onClose: () => void;
  setIndex: (i: number) => void;
}

function PhotoLightbox({ items, index, onClose, setIndex }: PhotoLightboxProps) {
  const r = items[index];
  if (!r) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(10,8,5,0.96)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '54px 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: 'rgba(255,255,255,0.16)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          {Icon.close('#fff')}
        </button>
        <div style={{ fontFamily: FONT_UI, fontSize: 13, color: '#fff', opacity: 0.7 }}>
          {index + 1} / {items.length}
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <ReceiptPhoto receipt={r} height={420} />
      </div>
      <div style={{ padding: '0 20px 28px', textAlign: 'center', color: '#fff' }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 4 }}>{r.merchant}</div>
        <div style={{ fontFamily: FONT_UI, fontSize: 12, opacity: 0.6, marginBottom: 14 }}>
          {r.category} · {formatThaiDate(r.date)} · {fmt(r.amount)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button
            onClick={() => setIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            style={{
              padding: '10px 16px',
              borderRadius: 100,
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              fontFamily: FONT_UI,
              fontSize: 13,
              cursor: 'pointer',
              opacity: index === 0 ? 0.3 : 1,
            }}
          >
            ← ก่อนหน้า
          </button>
          <button
            onClick={() => setIndex(Math.min(items.length - 1, index + 1))}
            disabled={index === items.length - 1}
            style={{
              padding: '10px 16px',
              borderRadius: 100,
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              fontFamily: FONT_UI,
              fontSize: 13,
              cursor: 'pointer',
              opacity: index === items.length - 1 ? 0.3 : 1,
            }}
          >
            ถัดไป →
          </button>
        </div>
      </div>
    </div>
  );
}

interface BankReceiptProps {
  theme: Theme;
  bundle: BundleWithDetails;
}

function BankReceipt({ theme, bundle }: BankReceiptProps) {
  return (
    <div style={{ background: theme.surface2, borderRadius: 12, padding: 14, fontFamily: FONT_UI, fontSize: 13 }}>
      {bundle.transferProofPath && (
        <img
          src={bundle.transferProofPath}
          alt="หลักฐานการโอน"
          style={{ width: '100%', borderRadius: 8, marginBottom: 12, display: 'block' }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
        <span style={{ color: theme.inkSoft }}>เลขอ้างอิง</span>
        <span style={{ color: theme.ink }}>{bundle.transferRef}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
        <span style={{ color: theme.inkSoft }}>จำนวนเงิน</span>
        <span style={{ color: theme.ink }}>฿{fmtN(bundle.transferAmount ?? 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
        <span style={{ color: theme.inkSoft }}>วันที่จ่าย</span>
        <span style={{ color: theme.ink }}>{formatThaiDate(bundle.paidAt)}</span>
      </div>
    </div>
  );
}

