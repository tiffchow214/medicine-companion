'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DoseInstance, Medication } from '@/lib/medicationTypes';
import {
  getActiveProfile,
  getDosesForUser,
  getMedicationsForUser,
  updateDoseStatus,
  addDoseLog,
} from '@/lib/storage';
import { sendCaregiverAlert } from '@/lib/caregiverClient';
import { playReminderAudio } from '@/lib/audioClient'; // ⬅️ NEW

export function useReminderScheduler() {
  const [dueDose, setDueDose] = useState<DoseInstance | null>(null);
  const [currentMedication, setCurrentMedication] = useState<Medication | null>(
    null,
  );

  useEffect(() => {
    const checkDoses = () => {
      const profile = getActiveProfile();
      if (!profile) {
        return;
      }

      const doses = getDosesForUser(profile.id);
      const medications = getMedicationsForUser(profile.id);
      const now = new Date();

      for (const dose of doses) {
        const scheduledTime = new Date(dose.scheduledTime);
        const diffMinutes =
          (now.getTime() - scheduledTime.getTime()) / (1000 * 60);

        // Check if dose is due (within +/- 5 minutes)
        if (
          dose.status === 'upcoming' &&
          Math.abs(diffMinutes) <= 5 &&
          (!dose.snoozedUntil || new Date(dose.snoozedUntil) <= now)
        ) {
          const med = medications.find((m) => m.id === dose.medicationId);
          if (med) {
            updateDoseStatus(profile.id, dose.id, 'due');
            setDueDose({ ...dose, status: 'due' });
            setCurrentMedication(med);
            return;
          }
        }

        // Check if dose is missed (30+ minutes past and not taken/skipped)
        if (
          dose.status === 'upcoming' &&
          diffMinutes > 30 &&
          (!dose.snoozedUntil || new Date(dose.snoozedUntil) <= now)
        ) {
          const med = medications.find((m) => m.id === dose.medicationId);
          if (med) {
            updateDoseStatus(profile.id, dose.id, 'missed');
            addDoseLog(profile.id, {
              id: `${Date.now()}-${Math.random()}`,
              userId: profile.id,
              medicationId: dose.medicationId,
              doseId: dose.id,
              status: 'missed',
              createdAt: new Date().toISOString(),
            });

            // Check if caregiver alert should be sent
            if (
              med.caregiverAlertEnabled &&
              med.caregiverEmail &&
              med.alertOnMissed
            ) {
              sendCaregiverAlert({
                caregiver_name: med.caregiverName || 'Caregiver',
                caregiver_email: med.caregiverEmail,
                patient_name: profile.name,
                medication_name: med.name,
                scheduled_time: dose.scheduledTime,
                status: 'missed',
                reason: 'Automatically detected missed dose.',
              }).catch((err) => {
                console.error('Failed to send caregiver alert:', err);
              });
            }
          }
        }
      }
    };

    // Check immediately
    checkDoses();

    // Then check every 60 seconds
    const interval = setInterval(checkDoses, 60000);
    return () => clearInterval(interval);
  }, []);

  // 🔊 NEW EFFECT: when a dose becomes due, auto-play AI reminder audio
  useEffect(() => {
    if (!dueDose || !currentMedication) return;

    const profile = getActiveProfile();
    if (!profile) return;

    // Fire and forget; errors are handled inside playReminderAudio
    playReminderAudio(profile.name, currentMedication).catch((err) => {
      console.error('Failed to auto-play reminder audio:', err);
    });
  }, [dueDose, currentMedication]);

  const clearDueDose = useCallback(() => {
    setDueDose(null);
    setCurrentMedication(null);
  }, []);

  const markDoseTaken = useCallback(() => {
    if (!dueDose) return;

    const profile = getActiveProfile();
    if (!profile) return;

    const takenAt = new Date().toISOString();
    updateDoseStatus(profile.id, dueDose.id, 'taken', takenAt);
    addDoseLog(profile.id, {
      id: `${Date.now()}-${Math.random()}`,
      userId: profile.id,
      medicationId: dueDose.medicationId,
      doseId: dueDose.id,
      status: 'taken',
      createdAt: takenAt,
    });

    clearDueDose();
  }, [dueDose, clearDueDose]);

  const markDoseSkipped = useCallback(
    (reason?: string) => {
      if (!dueDose || !currentMedication) return;

      const profile = getActiveProfile();
      if (!profile) return;

      updateDoseStatus(profile.id, dueDose.id, 'skipped');
      addDoseLog(profile.id, {
        id: `${Date.now()}-${Math.random()}`,
        userId: profile.id,
        medicationId: dueDose.medicationId,
        doseId: dueDose.id,
        status: 'skipped',
        createdAt: new Date().toISOString(),
      });

      // Check if caregiver alert should be sent
      if (
        currentMedication.caregiverAlertEnabled &&
        currentMedication.caregiverEmail &&
        currentMedication.alertOnSkipped
      ) {
        sendCaregiverAlert({
          caregiver_name: currentMedication.caregiverName || 'Caregiver',
          caregiver_email: currentMedication.caregiverEmail,
          patient_name: profile.name,
          medication_name: currentMedication.name,
          scheduled_time: dueDose.scheduledTime,
          status: 'skipped',
          reason: reason || 'User tapped skip in the reminder modal.',
        }).catch((err) => {
          console.error('Failed to send caregiver alert:', err);
        });
      }

      clearDueDose();
    },
    [dueDose, currentMedication, clearDueDose],
  );

  const snoozeDose = useCallback(
    (minutes: number) => {
      if (!dueDose) return;

      const profile = getActiveProfile();
      if (!profile) return;

      const snoozedUntil = new Date(
        Date.now() + minutes * 60 * 1000,
      ).toISOString();
      const updatedDose = {
        ...dueDose,
        snoozedUntil,
        status: 'upcoming' as const,
      };
      updateDoseStatus(profile.id, dueDose.id, 'upcoming');

      clearDueDose();
    },
    [dueDose, clearDueDose],
  );

  return {
    dueDose,
    currentMedication,
    clearDueDose,
    markDoseTaken,
    markDoseSkipped,
    snoozeDose,
  };
}
