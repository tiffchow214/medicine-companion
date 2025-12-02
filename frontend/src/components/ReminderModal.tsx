'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, XCircle, Clock, X } from 'lucide-react';
import type { DoseInstance, Medication } from '@/lib/medicationTypes';
import { playReminderAudio } from '@/lib/audioClient';
import { generatePersonalizedReminder } from '@/lib/reminderVoice';

interface ReminderModalProps {
  open: boolean;
  onClose: () => void;
  dose: DoseInstance;
  medication: Medication;
  userName: string;
  onTaken: () => void;
  onSkipped: (reason?: string) => void;
  onSnoozed: (minutes: number) => void;
}

export function ReminderModal({
  open,
  onClose,
  dose,
  medication,
  userName,
  onTaken,
  onSkipped,
  onSnoozed,
}: ReminderModalProps) {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [personalizedMessage, setPersonalizedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Generate personalized reminder message
      generatePersonalizedReminder(medication)
        .then((message) => {
          setPersonalizedMessage(message);
          // Play audio with personalized message
          setAudioPlaying(true);
          return playReminderAudio(userName, medication, message);
        })
        .then(() => {
          setAudioPlaying(false);
        })
        .catch((err) => {
          console.error('Reminder error:', err);
          setAudioPlaying(false);
          // Fallback: try to play generic audio
          playReminderAudio(userName, medication).catch(() => {
            // Ignore fallback errors
          });
        });
    } else {
      // Reset state when modal closes
      setPersonalizedMessage(null);
      setAudioPlaying(false);
    }
  }, [open, userName, medication]);

  if (!open) return null;

  const scheduledTime = new Date(dose.scheduledTime);
  const timeStr = scheduledTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const handleSnooze = (minutes: number) => {
    onSnoozed(minutes);
    setShowSnoozeOptions(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-title"
    >
      <div className="glass-card relative w-full max-w-md rounded-3xl p-10 shadow-glass-lg border border-white/50">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 transition"
          aria-label="Close"
        >
          <X className="h-6 w-6" strokeWidth={2} />
        </button>

        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-soft-teal/10">
              <Bell className="h-10 w-10 text-soft-teal" strokeWidth={2} />
            </div>
          </div>
          
          <h2
            id="reminder-title"
            className="mb-6 text-[32px] font-light text-slate-900 tracking-tight"
          >
            Time for your medication!
          </h2>

          <div className="mb-8 rounded-2xl bg-soft-teal/5 border border-soft-teal/20 p-6 text-left">
            <div className="mb-3 text-2xl font-light text-slate-900">
              {medication.name}
            </div>
            <div className="mb-2 flex items-center gap-2 text-lg font-light text-slate-600">
              <Clock className="h-5 w-5 text-soft-teal" strokeWidth={2} />
              <span>
                <span className="font-normal">Scheduled:</span> {timeStr}
              </span>
            </div>
            <div className="mb-2 text-lg font-light text-slate-600">
              <span className="font-normal">Dose:</span> {medication.dose}
            </div>
            {medication.instructions && (
              <div className="text-lg font-light text-slate-600">
                <span className="font-normal">Instructions:</span> {medication.instructions}
              </div>
            )}
          </div>

          {personalizedMessage && (
            <div className="mb-6 rounded-2xl bg-soft-blue/10 border border-soft-teal/20 p-5 text-center">
              <p className="text-lg font-light text-slate-700 leading-relaxed">
                {personalizedMessage}
              </p>
            </div>
          )}

          {audioPlaying && (
            <div className="mb-6 rounded-2xl bg-soft-teal/10 border border-soft-teal/20 p-4 text-base font-light text-soft-teal">
              🔊 Playing audio reminder...
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={onTaken}
              className="btn-success w-full rounded-full px-8 py-5 text-lg font-medium text-white flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-green"
            >
              <CheckCircle2 className="h-6 w-6" strokeWidth={2} />
              I Took It
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
                className="flex-1 rounded-full bg-slate-blue px-6 py-4 text-base font-medium text-white shadow-soft transition hover:bg-slate-blue/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-blue flex items-center justify-center gap-2"
              >
                <Clock className="h-5 w-5" strokeWidth={2} />
                Snooze
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      'Are you sure you want to skip this dose? This will be recorded.'
                    )
                  ) {
                    onSkipped('User tapped skip in the reminder modal.');
                  }
                }}
                className="flex-1 rounded-full bg-coral px-6 py-4 text-base font-medium text-white shadow-soft transition hover:bg-coral/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral flex items-center justify-center gap-2"
              >
                <XCircle className="h-5 w-5" strokeWidth={2} />
                Skip
              </button>
            </div>

            {showSnoozeOptions && (
              <div className="glass-card rounded-2xl p-5 border border-white/40">
                <div className="mb-4 text-base font-light text-slate-900">
                  Snooze for:
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[5, 10, 30].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleSnooze(mins)}
                      className="glass-card rounded-full px-4 py-3 text-base font-light text-soft-teal transition hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soft-teal"
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
