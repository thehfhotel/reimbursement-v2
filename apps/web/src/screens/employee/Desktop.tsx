import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AppState, BundleWithDetails, Receipt, Theme } from '../../lib/types';
import { fmt, fmt0, fmtN, formatThaiDate } from '../../lib/format';
import { FONT_DISPLAY, FONT_MONO, FONT_UI } from '../../lib/theme';
import { api, receiptFormFromFields } from '../../lib/api';
import { dataUrlToFile } from '../../lib/photoUpload';
import { userNameById } from '../../lib/userNames';
import { DesktopShell, SidebarSection } from '../../components/DesktopShell';
import { Card, GhostButton, Money, PrimaryButton, StatusPill } from '../../components/primitives';
import { Icon } from '../../components/icons';
import { ReceiptPhoto, ReceiptThumb } from '../../components/Receipts';

// ── Constants for new (uploaded) receipts ────────────────────────────
const NEW_RECEIPT_COLOR = '#F5EBD9';
const NEW_RECEIPT_ACCENT = '#7E5E3A';
const NEW_RECEIPT_DATE = '2026-04-30';
const NEW_RECEIPT_MERCHANT_FALLBACK = 'ใบเสร็จใหม่';
const DEFAULT_BUNDLE_NAME = 'ค่าใช้จ่ายสัปดาห์นี้';

// Pulled from `@reimbursement/shared` to stay in sync with the rest of the app.
import { RECEIPT_CATEGORIES } from '../../lib/types';

type View = 'drafts' | 'bundle-detail';

interface DesktopEmployeeProps {
  theme: Theme;
  state: AppState;
  setState: (updater: (s: AppState) => AppState) => void;
}

export function DesktopEmployee({ theme, state, setState }: DesktopEmployeeProps): JSX.Element {
  const [view, setView] = useState<View>('drafts');
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bundleName, setBundleName] = useState<string>(DEFAULT_BUNDLE_NAME);
  const [photoIdx, setPhotoIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState<boolean>(false);

  const { receipts, bundles } = state;
  const looseReceipts = receipts.filter((r) => r.bundleId === null);

  const selectedReceipts = looseReceipts.filter((r) => selected.has(r.id));
  const selectedTotal = selectedReceipts.reduce((sum, r) => sum + r.amount, 0);

  const totalsByStatus = {
    pending: bundles.filter((b) => b.status === 'pending').length,
    approved: bundles.filter((b) => b.status === 'approved').length,
    paid: bundles.filter((b) => b.status === 'paid').length,
  };

  const owed = bundles
    .filter((b) => b.status === 'pending' || b.status === 'approved')
    .reduce((sum, b) => sum + b.receipts.reduce((acc, r) => acc + r.amount, 0), 0);

  const toggleReceipt = (id: string): void => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const goToDrafts = (): void => {
    setView('drafts');
    setSelectedBundleId(null);
  };

  const openBundle = (id: string): void => {
    setSelectedBundleId(id);
    setView('bundle-detail');
  };

  const submitBundle = async (): Promise<void> => {
    setSubmitting(true);
    try {
      const created = await api.bundles.create({
        name: bundleName,
        receiptIds: [...selected],
      });
      setState((s) => ({
        ...s,
        bundles: [...s.bundles, created],
        receipts: s.receipts.map((r) =>
          created.receipts.some((cr) => cr.id === r.id) ? { ...r, bundleId: created.id } : r,
        ),
      }));
      setSelected(new Set());
      setBundleName(DEFAULT_BUNDLE_NAME);
      setJustSubmitted(created.id);
      window.setTimeout(() => setJustSubmitted(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateReceipt = async (input: NewReceiptInput): Promise<void> => {
    const photoFile = await dataUrlToFile(input.photo, 'receipt.jpg');
    const form = receiptFormFromFields(
      {
        merchant: input.merchant.trim() || NEW_RECEIPT_MERCHANT_FALLBACK,
        category: input.category,
        property: input.property,
        quantity: input.quantity,
        amount: input.amount,
        date: NEW_RECEIPT_DATE,
        note: input.note.trim() ? input.note.trim() : '',
        color: NEW_RECEIPT_COLOR,
        accent: NEW_RECEIPT_ACCENT,
        items: [['รายการที่ถ่าย', input.amount.toFixed(2)]],
        tax: '0',
      },
      photoFile,
    );
    const created = await api.receipts.create(form);
    setState((s) => ({ ...s, receipts: [created, ...s.receipts] }));
    setCreateOpen(false);
  };

  const openCreateModal = (): void => setCreateOpen(true);
  const closeCreateModal = (): void => setCreateOpen(false);

  const selectedBundle = bundles.find((b) => b.id === selectedBundleId) ?? null;

  // ── Sidebar ─────────────────────────────────────────────────────────
  const sidebar = (
    <>
      <div style={{ padding: '8px 16px 14px' }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: theme.ink, letterSpacing: -0.4 }}>
          เบิกค่าใช้จ่าย
        </div>
        <div style={{ fontFamily: FONT_UI, fontSize: 11, color: theme.inkSoft, marginTop: 2 }}>
          นิรันดร์ ก. · วิศวกรรม
        </div>
      </div>

      <DeskNavItem
        theme={theme}
        label="ฉบับร่าง"
        count={looseReceipts.length}
        active={view === 'drafts'}
        accent={looseReceipts.length > 0}
        onClick={goToDrafts}
      />

      <div style={{ height: 14 }} />
      <SidebarSectionInline theme={theme} label="คำขอของฉัน" />
      <DeskNavItem theme={theme} label="รออนุมัติ" count={totalsByStatus.pending} />
      <DeskNavItem theme={theme} label="อนุมัติแล้ว" count={totalsByStatus.approved} />
      <DeskNavItem theme={theme} label="จ่ายแล้ว" count={totalsByStatus.paid} />

      <SidebarSection theme={theme} label="ล่าสุด" />
      {bundles
        .slice(-5)
        .reverse()
        .map((b) => {
          const sum = b.receipts.reduce((acc, r) => acc + r.amount, 0);
          const statusLabel =
            b.status === 'pending' ? 'รออนุมัติ' : b.status === 'approved' ? 'อนุมัติ' : 'จ่ายแล้ว';
          const isActive = selectedBundleId === b.id;
          return (
            <div
              key={b.id}
              onClick={() => openBundle(b.id)}
              style={{
                margin: '1px 8px',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                background: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
              }}
            >
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 12,
                  color: theme.ink,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {b.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 2,
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  color: theme.inkSoft,
                }}
              >
                <span>{statusLabel}</span>
                <span style={{ fontFamily: FONT_MONO }}>฿{fmt0(sum)}</span>
              </div>
            </div>
          );
        })}
    </>
  );

  // ── Main pane ───────────────────────────────────────────────────────
  const mainContent =
    view === 'bundle-detail' && selectedBundle ? (
      <BundleDetailPane
        theme={theme}
        bundle={selectedBundle}
        onBack={goToDrafts}
      />
    ) : (
      <DraftsPane
        theme={theme}
        looseReceipts={looseReceipts}
        selected={selected}
        selectedReceipts={selectedReceipts}
        selectedTotal={selectedTotal}
        bundleName={bundleName}
        onBundleNameChange={setBundleName}
        owed={owed}
        outstandingCount={totalsByStatus.pending + totalsByStatus.approved}
        justSubmitted={justSubmitted}
        submitting={submitting}
        photoIdx={photoIdx}
        onPhotoIdxChange={setPhotoIdx}
        onToggleReceipt={toggleReceipt}
        onSubmitBundle={submitBundle}
        onCameraClick={openCreateModal}
      />
    );

  return (
    <DesktopShell theme={theme} sidebar={sidebar}>
      <div style={{ height: '100%' }}>{mainContent}</div>
      {createOpen && (
        <CreateReceiptModal
          theme={theme}
          onClose={closeCreateModal}
          onSave={handleCreateReceipt}
        />
      )}
    </DesktopShell>
  );
}

// ── Sidebar nav item (matches prototype's DeskNavItem) ────────────────
interface DeskNavItemProps {
  theme: Theme;
  label: string;
  count?: number;
  active?: boolean;
  accent?: boolean;
  onClick?: () => void;
}

function DeskNavItem({ theme, label, count, active, accent, onClick }: DeskNavItemProps) {
  return (
    <div
      onClick={onClick}
      style={{
        margin: '1px 8px',
        padding: '7px 12px',
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: FONT_UI,
        fontSize: 13,
        color: theme.ink,
        fontWeight: active ? 500 : 400,
      }}
    >
      {accent && (
        <div style={{ width: 6, height: 6, borderRadius: 3, background: theme.warn }} />
      )}
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && (
        <span
          style={{
            fontFamily: FONT_UI,
            fontSize: 11,
            color: theme.inkSoft,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// Inline section header used in addition to SidebarSection so we can match
// the exact prototype padding for "คำขอของฉัน" (no top spacing — it follows
// a manual 14px spacer rather than the default 14px top padding).
interface SidebarSectionInlineProps {
  theme: Theme;
  label: string;
}

function SidebarSectionInline({ theme, label }: SidebarSectionInlineProps) {
  return (
    <div
      style={{
        padding: '6px 16px 6px',
        fontFamily: FONT_UI,
        fontSize: 10,
        fontWeight: 600,
        color: theme.inkSofter,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  );
}

// ── Drafts pane (middle gallery + right composer + lightbox) ──────────
interface DraftsPaneProps {
  theme: Theme;
  looseReceipts: Receipt[];
  selected: Set<string>;
  selectedReceipts: Receipt[];
  selectedTotal: number;
  bundleName: string;
  onBundleNameChange: (next: string) => void;
  owed: number;
  outstandingCount: number;
  justSubmitted: string | null;
  submitting: boolean;
  photoIdx: number | null;
  onPhotoIdxChange: (next: number | null) => void;
  onToggleReceipt: (id: string) => void;
  onSubmitBundle: () => void;
  onCameraClick: () => void;
}

function DraftsPane({
  theme,
  looseReceipts,
  selected,
  selectedReceipts,
  selectedTotal,
  bundleName,
  onBundleNameChange,
  owed,
  outstandingCount,
  justSubmitted,
  submitting,
  photoIdx,
  onPhotoIdxChange,
  onToggleReceipt,
  onSubmitBundle,
  onCameraClick,
}: DraftsPaneProps) {
  const lightboxReceipt = photoIdx !== null ? looseReceipts[photoIdx] : null;

  return (
    <div style={{ display: 'flex', height: '100%', background: theme.paper }}>
      {/* MIDDLE — receipts gallery */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px 40px' }}>
        {owed > 0 && <OwedBanner theme={theme} owed={owed} outstandingCount={outstandingCount} />}

        {justSubmitted && <SubmittedToast theme={theme} />}

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT_UI,
                fontSize: 11,
                color: theme.inkSoft,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                fontWeight: 500,
              }}
            >
              ใบเสร็จที่ยังไม่ได้ส่ง
            </div>
            <h1
              style={{
                margin: '4px 0 0',
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: 32,
                lineHeight: 1.1,
                letterSpacing: -0.5,
                color: theme.ink,
              }}
            >
              ฉบับร่าง · {looseReceipts.length}
            </h1>
          </div>
          <button
            onClick={onCameraClick}
            style={{
              padding: '10px 16px',
              borderRadius: 100,
              background: theme.surface2,
              border: `0.5px solid ${theme.hairlineStrong}`,
              fontFamily: FONT_UI,
              fontSize: 13,
              color: theme.ink,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {Icon.camera(theme.ink)} ถ่ายใบเสร็จ
          </button>
        </div>

        {looseReceipts.length === 0 ? (
          <EmptyDrafts theme={theme} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            {looseReceipts.map((receipt, idx) => (
              <ReceiptCard
                key={receipt.id}
                theme={theme}
                receipt={receipt}
                isSelected={selected.has(receipt.id)}
                onToggle={() => onToggleReceipt(receipt.id)}
                onOpenPhoto={() => onPhotoIdxChange(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* RIGHT — selection / bundle composer */}
      <BundleComposer
        theme={theme}
        selectedCount={selected.size}
        selectedReceipts={selectedReceipts}
        selectedTotal={selectedTotal}
        bundleName={bundleName}
        onBundleNameChange={onBundleNameChange}
        submitting={submitting}
        onSubmit={onSubmitBundle}
        onRemoveReceipt={onToggleReceipt}
      />

      {lightboxReceipt && (
        <PhotoLightbox
          theme={theme}
          receipt={lightboxReceipt}
          onClose={() => onPhotoIdxChange(null)}
        />
      )}
    </div>
  );
}

// ── Owed banner ───────────────────────────────────────────────────────
interface OwedBannerProps {
  theme: Theme;
  owed: number;
  outstandingCount: number;
}

function OwedBanner({ theme, owed, outstandingCount }: OwedBannerProps) {
  return (
    <div
      style={{
        padding: '14px 18px',
        borderRadius: 12,
        background: theme.surface2,
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        border: `0.5px solid ${theme.hairline}`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: theme.ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.paper,
          fontFamily: FONT_DISPLAY,
          fontSize: 16,
        }}
      >
        ฿
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 11,
            color: theme.inkSoft,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          รอรับเงิน
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 24,
            color: theme.ink,
            lineHeight: 1.1,
            letterSpacing: -0.3,
          }}
        >
          ฿
          {owed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <div style={{ fontFamily: FONT_UI, fontSize: 12, color: theme.inkSoft }}>
        {outstandingCount} คำขอที่ยังไม่ได้รับ
      </div>
    </div>
  );
}

// ── Submitted toast ───────────────────────────────────────────────────
interface SubmittedToastProps {
  theme: Theme;
}

function SubmittedToast({ theme }: SubmittedToastProps) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        marginBottom: 20,
        background: '#E8F4EC',
        border: `0.5px solid ${theme.success}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: FONT_UI,
        fontSize: 13,
        color: '#0F4A2E',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          background: theme.success,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Icon.check('#fff')}
      </div>
      ส่งคำขออนุมัติเรียบร้อย — จะแจ้งเตือนเมื่อได้รับการอนุมัติ
    </div>
  );
}

// ── Empty drafts state ────────────────────────────────────────────────
interface EmptyDraftsProps {
  theme: Theme;
}

function EmptyDrafts({ theme }: EmptyDraftsProps) {
  return (
    <div
      style={{
        padding: '60px 20px',
        textAlign: 'center',
        fontFamily: FONT_UI,
        fontSize: 14,
        color: theme.inkSoft,
        border: `1px dashed ${theme.hairlineStrong}`,
        borderRadius: 16,
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 10 }}>📸</div>
      ยังไม่มีใบเสร็จที่รอส่ง
    </div>
  );
}

// ── Receipt card ──────────────────────────────────────────────────────
interface ReceiptCardProps {
  theme: Theme;
  receipt: Receipt;
  isSelected: boolean;
  onToggle: () => void;
  onOpenPhoto: () => void;
}

function ReceiptCard({ theme, receipt, isSelected, onToggle, onOpenPhoto }: ReceiptCardProps) {
  return (
    <div
      onClick={onToggle}
      style={{
        position: 'relative',
        padding: 14,
        borderRadius: 14,
        background: theme.surface,
        border: `1.5px solid ${isSelected ? theme.accent : theme.hairline}`,
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: isSelected ? theme.accent : 'rgba(255,255,255,0.9)',
          border: `1.5px solid ${isSelected ? theme.accent : theme.hairlineStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        {isSelected && Icon.check('#fff')}
      </div>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onOpenPhoto();
        }}
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 12,
          cursor: 'zoom-in',
        }}
      >
        <ReceiptPhoto receipt={receipt} height={170} />
      </div>
      <div
        style={{
          fontFamily: FONT_UI,
          fontSize: 13,
          fontWeight: 500,
          color: theme.ink,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {receipt.merchant}
      </div>
      <div
        style={{
          fontFamily: FONT_UI,
          fontSize: 11,
          color: theme.inkSoft,
          marginTop: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            marginRight: 8,
          }}
        >
          {formatThaiDate(receipt.date)}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, color: theme.ink }}>
          ฿{fmt0(receipt.amount)}
        </span>
      </div>
    </div>
  );
}

// ── Right rail bundle composer ────────────────────────────────────────
interface BundleComposerProps {
  theme: Theme;
  selectedCount: number;
  selectedReceipts: Receipt[];
  selectedTotal: number;
  bundleName: string;
  onBundleNameChange: (next: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onRemoveReceipt: (id: string) => void;
}

function BundleComposer({
  theme,
  selectedCount,
  selectedReceipts,
  selectedTotal,
  bundleName,
  onBundleNameChange,
  submitting,
  onSubmit,
  onRemoveReceipt,
}: BundleComposerProps) {
  const sectionLabelStyle: CSSProperties = {
    fontFamily: FONT_UI,
    fontSize: 11,
    color: theme.inkSoft,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: 500,
  };

  return (
    <div
      style={{
        width: 340,
        borderLeft: `0.5px solid ${theme.hairline}`,
        display: 'flex',
        flexDirection: 'column',
        background: theme.surface2,
      }}
    >
      <div style={{ padding: '24px 22px 16px' }}>
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 11,
            color: theme.inkSoft,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          คำขอใหม่
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 26,
              color: theme.ink,
              lineHeight: 1,
              letterSpacing: -0.4,
            }}
          >
            {selectedCount}
          </div>
          <div style={{ fontFamily: FONT_UI, fontSize: 12, color: theme.inkSoft }}>
            {selectedCount === 0 ? 'เลือกใบเสร็จ' : 'ใบเสร็จ'}
          </div>
        </div>
      </div>

      {selectedCount === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 28px',
            textAlign: 'center',
            fontFamily: FONT_UI,
            fontSize: 13,
            color: theme.inkSoft,
            lineHeight: 1.5,
          }}
        >
          คลิกใบเสร็จด้านซ้ายเพื่อรวมเป็นคำขออนุมัติ
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 22px' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>ชื่อคำขอ</div>
              <input
                value={bundleName}
                onChange={(e) => onBundleNameChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: theme.paper,
                  border: `0.5px solid ${theme.hairlineStrong}`,
                  fontFamily: FONT_UI,
                  fontSize: 14,
                  color: theme.ink,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontWeight: 500,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>รายการ</div>
              {selectedReceipts.map((receipt, i) => (
                <div
                  key={receipt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom:
                      i < selectedReceipts.length - 1
                        ? `0.5px solid ${theme.hairline}`
                        : 'none',
                  }}
                >
                  <ReceiptThumb receipt={receipt} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: FONT_UI,
                        fontSize: 12,
                        fontWeight: 500,
                        color: theme.ink,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {receipt.merchant}
                    </div>
                    <div style={{ fontFamily: FONT_UI, fontSize: 10, color: theme.inkSoft }}>
                      {receipt.category}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 12,
                      fontWeight: 500,
                      color: theme.ink,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ฿{fmt0(receipt.amount)}
                  </div>
                  <button
                    onClick={() => onRemoveReceipt(receipt.id)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      border: 'none',
                      background: 'transparent',
                      color: theme.inkSofter,
                      cursor: 'pointer',
                      fontSize: 16,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: '18px 22px',
              borderTop: `0.5px solid ${theme.hairline}`,
              background: theme.paper,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  color: theme.inkSoft,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                ยอดรวม
              </div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 26,
                  color: theme.ink,
                  letterSpacing: -0.4,
                  lineHeight: 1,
                }}
              >
                ฿
                {selectedTotal.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <PrimaryButton theme={theme} disabled={submitting} onClick={onSubmit}>
              {submitting ? 'กำลังส่ง...' : `ส่งอนุมัติ · ${selectedCount} ใบ`}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}

// ── Photo lightbox ────────────────────────────────────────────────────
interface PhotoLightboxProps {
  theme: Theme;
  receipt: Receipt;
  onClose: () => void;
}

function PhotoLightbox({ receipt, onClose }: PhotoLightboxProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(10,8,5,0.95)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <ReceiptPhoto receipt={receipt} height={460} />
        <button
          onClick={onClose}
          style={{
            padding: '8px 14px',
            borderRadius: 100,
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            color: '#fff',
            fontFamily: FONT_UI,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ปิด
        </button>
      </div>
    </div>
  );
}

// ── Bundle detail pane ────────────────────────────────────────────────
interface BundleDetailPaneProps {
  theme: Theme;
  bundle: BundleWithDetails;
  onBack: () => void;
}

function BundleDetailPane({ theme, bundle, onBack }: BundleDetailPaneProps) {
  const items: Receipt[] = bundle.receipts;
  const total = items.reduce((sum, r) => sum + r.amount, 0);
  const [totalWhole, totalFrac] = fmtN(total).split('.');

  return (
    <div
      style={{
        padding: '32px 40px 40px',
        overflow: 'auto',
        height: '100%',
        background: theme.paper,
        boxSizing: 'border-box',
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT_UI,
          fontSize: 13,
          color: theme.inkSoft,
          padding: 0,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ← ฉบับร่าง
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          marginBottom: 28,
        }}
      >
        <div style={{ flex: 1 }}>
          <StatusPill status={bundle.status} theme={theme} />
          <h1
            style={{
              margin: '8px 0 6px',
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: 36,
              lineHeight: 1.05,
              letterSpacing: -0.6,
              color: theme.ink,
            }}
          >
            {bundle.name}
          </h1>
          <div style={{ fontFamily: FONT_UI, fontSize: 13, color: theme.inkSoft }}>
            ส่งเมื่อ {formatThaiDate(bundle.submittedAt)} · {items.length} ใบเสร็จ
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: FONT_UI,
              fontSize: 11,
              color: theme.inkSoft,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}
          >
            ยอดรวม
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 40,
              color: theme.ink,
              lineHeight: 1,
              letterSpacing: -0.8,
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 22, opacity: 0.5, marginRight: 4, verticalAlign: 'top' }}>฿</span>
            {totalWhole}
            <span style={{ opacity: 0.5 }}>.{totalFrac}</span>
          </div>
        </div>
      </div>

      <Card theme={theme} padding={18} style={{ marginBottom: 28 }}>
        <BundleStatusBlock theme={theme} bundle={bundle} total={total} />
      </Card>

      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 11,
            color: theme.inkSoft,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          ใบเสร็จ
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 14,
          }}
        >
          {items.map((receipt) => (
            <div
              key={receipt.id}
              style={{
                padding: 14,
                borderRadius: 12,
                background: theme.surface,
                border: `0.5px solid ${theme.hairline}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <ReceiptPhoto receipt={receipt} height={170} />
              </div>
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 13,
                  fontWeight: 500,
                  color: theme.ink,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {receipt.merchant}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 3,
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  color: theme.inkSoft,
                }}
              >
                <span>{formatThaiDate(receipt.date)}</span>
                <span style={{ fontFamily: FONT_MONO, color: theme.ink, fontWeight: 500 }}>
                  ฿{fmt0(receipt.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Bundle status block (inside the Card on bundle-detail) ────────────
interface BundleStatusBlockProps {
  theme: Theme;
  bundle: BundleWithDetails;
  total: number;
}

function BundleStatusBlock({ theme, bundle, total }: BundleStatusBlockProps) {
  if (bundle.status === 'pending') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: theme.warn,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: FONT_DISPLAY,
            fontSize: 16,
          }}
        >
          ⋯
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 500, color: theme.ink }}>
            รออนุมัติจากการเงิน
          </div>
          <div style={{ fontFamily: FONT_UI, fontSize: 12, color: theme.inkSoft, marginTop: 2 }}>
            จะแจ้งเตือนเมื่อมีอัปเดต
          </div>
        </div>
      </div>
    );
  }

  if (bundle.status === 'approved') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: theme.success,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {Icon.check('#fff')}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 500, color: theme.ink }}>
            อนุมัติแล้ว · รอโอนเงิน
          </div>
          <div style={{ fontFamily: FONT_UI, fontSize: 12, color: theme.inkSoft, marginTop: 2 }}>
            {userNameById(bundle.approvedById)} อนุมัติเมื่อ {formatThaiDate(bundle.approvedAt)}
          </div>
        </div>
      </div>
    );
  }

  if (bundle.status === 'paid') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: theme.success,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {Icon.check('#fff')}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 500, color: theme.ink }}>
            จ่ายแล้ว {formatThaiDate(bundle.paidAt)}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: theme.inkSoft, marginTop: 2 }}>
            อ้างอิง · {bundle.transferRef}
          </div>
        </div>
        <Money value={bundle.transferAmount ?? total} theme={theme} size={18} accent weight={600} />
      </div>
    );
  }

  return null;
}

// ── Create receipt modal ──────────────────────────────────────────────
interface NewReceiptInput {
  photo: string;
  amount: number;
  merchant: string;
  category: string;
  property: 'hf-hotel' | 'hf-ville';
  quantity: number | null;
  note: string;
}

interface CreateReceiptModalProps {
  theme: Theme;
  onClose: () => void;
  onSave: (input: NewReceiptInput) => void;
}

function CreateReceiptModal({ theme, onClose, onSave }: CreateReceiptModalProps): JSX.Element {
  const [photo, setPhoto] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [category, setCategory] = useState<string>(RECEIPT_CATEGORIES[0]);
  const [property, setProperty] = useState<'hf-hotel' | 'hf-ville'>('hf-hotel');
  const [quantity, setQuantity] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedAmount = parseFloat(amount);
  const hasValidAmount = !Number.isNaN(parsedAmount) && parsedAmount > 0;
  const canSave = !!photo && hasValidAmount;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (dataUrl) setPhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (): void => {
    if (!canSave || !photo) return;
    onSave({
      photo,
      amount: parsedAmount,
      merchant,
      category,
      property,
      quantity: quantity ? parseInt(quantity, 10) : null,
      note,
    });
  };

  const sectionLabelStyle: CSSProperties = {
    fontFamily: FONT_UI,
    fontSize: 11,
    color: theme.inkSoft,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: 500,
    marginBottom: 8,
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    background: theme.surface,
    border: `0.5px solid ${theme.hairlineStrong}`,
    fontFamily: FONT_UI,
    fontSize: 14,
    color: theme.ink,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,8,5,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          background: theme.paper,
          borderRadius: 18,
          padding: 32,
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontFamily: FONT_UI,
              fontSize: 11,
              color: theme.inkSoft,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            ใบเสร็จใหม่
          </div>
          <h2
            style={{
              margin: '4px 0 0',
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: 26,
              lineHeight: 1.1,
              letterSpacing: -0.4,
              color: theme.ink,
            }}
          >
            เพิ่มค่าใช้จ่าย
          </h2>
          <button
            onClick={onClose}
            aria-label="ปิด"
            style={{
              position: 'absolute',
              top: 22,
              right: 22,
              width: 32,
              height: 32,
              borderRadius: 16,
              border: `0.5px solid ${theme.hairline}`,
              background: theme.surface,
              color: theme.inkSoft,
              fontFamily: FONT_UI,
              fontSize: 18,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Two-column body */}
        <div style={{ display: 'flex', gap: 22 }}>
          {/* Left — photo zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 240,
              height: 320,
              flexShrink: 0,
              background: theme.surface2,
              borderRadius: 14,
              border: photo ? 'none' : `1.5px dashed ${theme.hairlineStrong}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {photo ? (
              <>
                <img
                  src={photo}
                  alt="ใบเสร็จ"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    fontFamily: FONT_UI,
                    fontSize: 11,
                    color: theme.inkSoft,
                    background: theme.surface,
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: `0.5px solid ${theme.hairline}`,
                  }}
                >
                  เปลี่ยนรูป
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: theme.inkSoft, padding: 16 }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                  {Icon.camera(theme.inkSoft)}
                </div>
                <div
                  style={{
                    fontFamily: FONT_UI,
                    fontSize: 13,
                    fontWeight: 500,
                    color: theme.ink,
                  }}
                >
                  คลิกเพื่อเลือกรูป
                </div>
                <div style={{ fontFamily: FONT_UI, fontSize: 11, marginTop: 4 }}>
                  ใบเสร็จจากร้านค้า
                </div>
              </div>
            )}
          </div>

          {/* Right — form fields */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Amount hero */}
            <div style={{ marginBottom: 18 }}>
              <div style={sectionLabelStyle}>จำนวนเงิน</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  borderBottom: `1px solid ${theme.hairlineStrong}`,
                  paddingBottom: 8,
                }}
              >
                <span
                  style={{ fontFamily: FONT_DISPLAY, fontSize: 30, color: theme.inkSoft }}
                >
                  ฿
                </span>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  inputMode="decimal"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: FONT_DISPLAY,
                    fontSize: 40,
                    fontWeight: 400,
                    letterSpacing: -1.2,
                    color: theme.ink,
                    padding: 0,
                    lineHeight: 1.1,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT_UI,
                    fontSize: 12,
                    color: theme.inkSoft,
                    fontWeight: 500,
                  }}
                >
                  THB
                </span>
              </div>
            </div>

            {/* Merchant */}
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>ร้านค้า</div>
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="เช่น โฮมโปร, แม็คโคร"
                style={inputStyle}
              />
            </div>

            {/* Property chips */}
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>ที่พัก</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(
                  [
                    ['hf-hotel', 'HF Hotel'],
                    ['hf-ville', 'HF Ville'],
                  ] as const
                ).map(([value, label]) => {
                  const active = property === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setProperty(value)}
                      style={{
                        padding: '7px 13px',
                        borderRadius: 100,
                        background: active ? theme.ink : 'transparent',
                        color: active ? theme.paper : theme.ink,
                        border: `0.5px solid ${active ? theme.ink : theme.hairlineStrong}`,
                        fontFamily: FONT_UI,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category chips */}
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>หมวดหมู่</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RECEIPT_CATEGORIES.map((opt) => {
                  const active = category === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setCategory(opt)}
                      style={{
                        padding: '7px 13px',
                        borderRadius: 100,
                        background: active ? theme.ink : 'transparent',
                        color: active ? theme.paper : theme.ink,
                        border: `0.5px solid ${active ? theme.ink : theme.hairlineStrong}`,
                        fontFamily: FONT_UI,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity */}
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>จำนวนชิ้น (ถ้ามี)</div>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="เช่น 4"
                style={inputStyle}
              />
            </div>

            {/* Date readonly */}
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>วันที่</div>
              <div
                style={{
                  ...inputStyle,
                  background: theme.surface2,
                  color: theme.inkSoft,
                }}
              >
                วันนี้ · {formatThaiDate(NEW_RECEIPT_DATE)}
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom: 4 }}>
              <div style={sectionLabelStyle}>หมายเหตุ</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุ (ถ้ามี)"
                style={{
                  ...inputStyle,
                  minHeight: 60,
                  resize: 'none',
                  fontFamily: FONT_UI,
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 24,
            paddingTop: 18,
            borderTop: `0.5px solid ${theme.hairline}`,
          }}
        >
          <GhostButton theme={theme} onClick={onClose}>
            ยกเลิก
          </GhostButton>
          <div style={{ flex: 1 }} />
          <div style={{ minWidth: 220 }}>
            <PrimaryButton theme={theme} disabled={!canSave} onClick={handleSave}>
              บันทึก · {hasValidAmount ? fmt(parsedAmount) : '฿0.00'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
