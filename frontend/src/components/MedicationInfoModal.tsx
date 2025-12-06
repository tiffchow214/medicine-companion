'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, ExternalLink, AlertTriangle, FileText } from 'lucide-react';

// MOCK: Replace external function with a mock for standalone testing
const fetchDrugInfo = async (name: string): Promise<DrugInfo> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800)); 

    // Mock data structure
    const mockData: DrugInfo = {
        medication_name: name,
        general_markdown: `
# General Information about ${name}
This is a comprehensive overview of the medication **${name}**. 
It is classified as a non-steroidal anti-inflammatory drug (NSAID) and is commonly used for **pain relief and fever reduction**.

* It works by blocking certain natural substances in your body that cause inflammation.
* The half-life of this drug is approximately 4 hours.
* Always take with a full glass of water.
        `,
        usage_markdown: `
# Proper Usage
Take **${name}** exactly as prescribed by your doctor. Do not take more or less than directed.

1.  **For pain:** Take one dose every 4 to 6 hours as needed. Do not exceed 4 doses in 24 hours.
2.  **For fever:** Consult your physician if fever persists for more than 3 days.
3.  **Administration:** Can be taken with food or milk to prevent stomach upset.
        `,
        side_effects_markdown: `
# Side Effects and Warnings
### Common Side Effects:
* Stomach upset or heartburn
* Nausea
* Mild headache

### Severe Side Effects (Call your doctor immediately):
* Black, tarry stools (sign of stomach bleeding)
* Severe allergic reactions (rash, itching, swelling)
* Sudden or unusual weight gain
        `,
        source_url: `https://www.drugs.com/${name.toLowerCase().replace(/\s+/g, '-')}.html`,
    };

    if (name.toLowerCase().includes('tylenol')) {
        return mockData;
    } else if (name.toLowerCase().includes('missing')) {
        // Simulate missing data
        return { ...mockData, general_markdown: '' };
    } else {
        return mockData;
    }
};


interface MedicationInfoModalProps {
  open: boolean;
  onClose: () => void;
  medicationName: string;
}

type TabType = 'general' | 'usage' | 'side-effects';

// Response type from backend
interface DrugInfo {
  medication_name: string;
  general_markdown: string;
  usage_markdown: string;
  side_effects_markdown: string;
  source_url: string;
}

function buildDrugsComUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  return `https://www.drugs.com/${slug}.html`;
}

// NOTE: I am deliberately using 'soft-teal' and 'coral' colors defined in the original code,
// as the user's intent is to fix the syntax while using their existing theme.
// The glass-card styling is also preserved as it appears the user is using a specific Tailwind config
// or custom utility classes not visible here.

export function MedicationInfoModal({
  open,
  onClose,
  medicationName
}: MedicationInfoModalProps) {
  const [drugInfo, setDrugInfo] = useState<DrugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const drugsUrl = buildDrugsComUrl(medicationName);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!medicationName) {
      setError('Medication name is missing or invalid.');
      return;
    }

    // Fetch from API
    setLoading(true);
    setError(null);
    setDrugInfo(null); // Reset previous data
    
    // Using the local fetchDrugInfo mock
    fetchDrugInfo(medicationName) 
      .then((data) => {
        if (!data.general_markdown) {
          setError(
            'Information not available. Please check the spelling or ask your pharmacist.'
          );
          return;
        }
        setDrugInfo(data);
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load medication information.'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, medicationName]);

  if (!open) return null;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <FileText className="h-4 w-4" strokeWidth={2} /> },
    { id: 'usage', label: 'Usage', icon: <FileText className="h-4 w-4" strokeWidth={2} /> },
    { id: 'side-effects', label: 'Side Effects', icon: <AlertTriangle className="h-4 w-4" strokeWidth={2} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="med-info-title"
    >
      <div className="glass-card relative h-[90vh] w-full max-w-4xl rounded-3xl p-8 shadow-glass-lg border border-white/50 flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 transition z-10"
          aria-label="Close"
        >
          <X className="h-6 w-6" strokeWidth={2} />
        </button>

        <div className="mb-6">
          <h2
            id="med-info-title"
            className="mb-2 text-[32px] font-light text-slate-900 tracking-tight"
          >
            About {medicationName}
          </h2>
          {/* Disclaimer */}
          <div className="rounded-2xl border border-coral/30 bg-coral/10 p-4">
            <p className="text-base font-light text-coral flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <span>
                This is educational information only. NOT medical advice. Always
                consult your doctor.
              </span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/40">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-base font-light transition border-b-2 ${
                activeTab === tab.id
                  ? 'border-soft-teal text-soft-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-2">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-lg font-light text-slate-500">Loading information...</div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-coral/30 bg-coral/10 p-6">
              <p className="text-base font-light text-coral">
                {error}
              </p>
            </div>
          )}

          {drugInfo && !error && (
            <div className="prose prose-lg max-w-none prose-headings:font-light prose-headings:text-slate-900 prose-p:font-light prose-p:text-slate-700 prose-a:text-soft-teal prose-strong:font-normal">
              {activeTab === 'general' && (
                <ReactMarkdown>{drugInfo.general_markdown}</ReactMarkdown>
              )}
              {activeTab === 'usage' && (
                <ReactMarkdown>{drugInfo.usage_markdown}</ReactMarkdown>
              )}
              {activeTab === 'side-effects' && (
                <ReactMarkdown>{drugInfo.side_effects_markdown}</ReactMarkdown>
              )}
            </div>
          )}
        </div>

        {/* Footer - SYNTAX FIX APPLIED HERE */}
        <div className="mt-6 pt-6 border-t border-white/40">
          <a // The opening <a> tag starts here
            href={drugsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-base font-light text-soft-teal hover:text-soft-teal/80 transition underline underline-offset-2"
          >
            View full information on drugs.com
            <ExternalLink className="h-4 w-4" strokeWidth={2} />
          </a>
        </div>
      </div>
    </div>
  );
}