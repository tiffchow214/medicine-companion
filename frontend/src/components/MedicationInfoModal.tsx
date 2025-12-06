'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, AlertTriangle } from 'lucide-react';
import { fetchDrugInfo } from '@/lib/drugInfo';
import {
  getMedicationInfoCache,
  setMedicationInfoCache,
} from '@/lib/storage';

interface MedicationInfoModalProps {
  open: boolean;
  onClose: () => void;
  medicationName: string;
}

type TabType = 'general' | 'usage' | 'side-effects';

type TabContent = {
  general: string;
  usage: string;
  sideEffects: string;
};

export function MedicationInfoModal({
  open,
  onClose,
  medicationName,
}: MedicationInfoModalProps) {
  const [content, setContent] = useState<TabContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // simple cache key
  const cacheKey = medicationName.trim().toLowerCase();

  useEffect(() => {
    if (!open) return;

    console.log('[MedicationInfoModal] effect – fetching info for', medicationName);

    if (!medicationName || !cacheKey) {
      setError('Medication name is missing or invalid.');
      return;
    }

    // 1) check cache
    const cached = getMedicationInfoCache(cacheKey);

    if (cached) {
      // support new cache shape (tabbed) and old shape (single markdown)
      if (cached.general && cached.usage && cached.sideEffects) {
        setContent({
          general: cached.general,
          usage: cached.usage,
          sideEffects: cached.sideEffects,
        });
        setLoading(false);
        return;
      }

      if (cached.markdown) {
        // fallback: show same text in all tabs
        setContent({
          general: cached.markdown,
          usage: cached.markdown,
          sideEffects: cached.markdown,
        });
        setLoading(false);
        return;
      }
    }

    // 2) fetch from backend (OpenFDA)
    setLoading(true);
    setError(null);

    fetchDrugInfo(medicationName)
      .then((data) => {
        const nextContent: TabContent = {
          general: data.general_markdown,
          usage: data.usage_markdown,
          sideEffects: data.side_effects_markdown,
        };

        setContent(nextContent);

        // store in cache for next time
        setMedicationInfoCache(cacheKey, {
          url: data.source_url,
          general: nextContent.general,
          usage: nextContent.usage,
          sideEffects: nextContent.sideEffects,
          fetchedAt: new Date().toISOString(),
        });
      })
      .catch((err) => {
        console.error('[MedicationInfoModal] fetch error', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load medication information.'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, cacheKey, medicationName]);

  if (!open) return null;

  // ---------- inline styles to GUARANTEE visibility ----------
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.35)',
    display: 'flex',
    flexDirection: 'column',
  };

  const scrollAreaStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    marginTop: '16px',
    paddingRight: '8px',
  };

  // decide which markdown to show for the current tab
  let activeMarkdown: string | null = null;
  if (content) {
    if (activeTab === 'general') activeMarkdown = content.general;
    else if (activeTab === 'usage') activeMarkdown = content.usage;
    else activeMarkdown = content.sideEffects;
  }

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        {/* header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
          }}
        >
          <div>
            <h2
              id="med-info-title"
              style={{
                margin: 0,
                marginBottom: 4,
                fontSize: 28,
                fontWeight: 500,
                color: '#0f172a',
              }}
            >
              About {medicationName}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
              Powered by OpenFDA drug label data. This is NOT medical advice.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 4,
              color: '#9ca3af',
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* disclaimer */}
        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(248, 113, 113, 0.3)',
            backgroundColor: 'rgba(248, 113, 113, 0.08)',
            padding: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          <AlertTriangle size={18} style={{ marginTop: 2, color: '#b91c1c' }} />
          <p style={{ margin: 0, fontSize: 14, color: '#b91c1c' }}>
            This information is for education only. Always follow the advice of
            your doctor or pharmacist.
          </p>
        </div>

        {/* tabs */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 16,
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          {(['general', 'usage', 'side-effects'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '8px 16px',
                borderBottom:
                  activeTab === tab ? '2px solid #14b8a6' : '2px solid transparent',
                color: activeTab === tab ? '#14b8a6' : '#6b7280',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {tab === 'general'
                ? 'General'
                : tab === 'usage'
                ? 'Usage & directions'
                : 'Side effects'}
            </button>
          ))}
        </div>

        {/* content area */}
        <div style={scrollAreaStyle}>
          {loading && (
            <p
              style={{
                fontSize: 16,
                color: '#6b7280',
                textAlign: 'center',
                marginTop: 40,
              }}
            >
              Loading information...
            </p>
          )}

          {error && !loading && (
            <p style={{ fontSize: 15, color: '#b91c1c' }}>
              {error ||
                'Information not available. Please check the spelling or ask your pharmacist.'}
            </p>
          )}

          {activeMarkdown && !error && !loading && (
            <div
              style={{
                fontSize: 15,
                color: '#111827',
                lineHeight: 1.6,
              }}
            >
              {/* ReactMarkdown will render our bullet lists nicely */}
              <ReactMarkdown>{activeMarkdown}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
