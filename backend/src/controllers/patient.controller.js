import * as queueService from '../services/queue.service.js';
import * as profileService from '../services/profile.service.js';
import { translateMessage, normalizeLanguage } from '../services/translation.service.js';
import { sendWhatsAppMessage, normalizePhoneForStorage } from '../services/twilio.service.js';
import { getIo } from '../socket.js';
import { config } from '../config.js';

export async function lookupByPhone(req, res) {
  try {
    const required = config.clinicStaffApiKey;
    if (required !== '') {
      const sent = String(req.headers['x-clinic-key'] ?? '').trim();
      if (sent !== required) {
        return res.status(401).json({
          error:
            'Staff key required for lookup. Set CLINIC_STAFF_API_KEY on the API and NEXT_PUBLIC_CLINIC_STAFF_KEY on the frontend to the same value.',
        });
      }
    }
    const phone = req.query?.phone;
    const data = await profileService.lookupPatientByPhone(phone);
    return res.json(data);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Lookup failed' });
  }
}

export async function history(req, res) {
  try {
    const patientId = String(req.params.id || '').trim();
    const phone = req.query?.phone;
    const data = await profileService.getPatientHistory(patientId, phone);
    return res.json(data);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    if (e.statusCode === 403) return res.status(403).json({ error: e.message });
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'History failed' });
  }
}

export async function register(req, res) {
  try {
    const { name, phone, symptoms, doctorId, priority, type, appointmentTime, language, department } =
      req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }

    const result = await queueService.registerPatient({
      name: String(name).trim(),
      phone: normalizePhoneForStorage(String(phone)),
      symptoms: symptoms != null ? String(symptoms) : undefined,
      doctorId,
      priority,
      type,
      appointmentTime,
      language: normalizeLanguage(language),
      department: department != null ? String(department).trim() : undefined,
    });

    const msg = translateMessage('registrationWait', result.patient.language, {
      name: result.patient.name,
      token: result.queueEntry.tokenNumber,
      wait: result.estimatedWaitMinutes,
    });

    await sendWhatsAppMessage(result.patient.phone, msg);

    const io = getIo();
    if (io) await queueService.broadcastQueue(io);

    return res.status(201).json({
      ...queueService.queueEntryToResponse(result.queueEntry),
      estimatedWaitMinutes: result.estimatedWaitMinutes,
      ahead: result.ahead,
      patientId: result.patient.id,
      phone: result.patient.phone,
      department: result.department,
      needsDepartmentClarification: result.needsDepartmentClarification,
      symptomsUrgentCare: result.symptomsUrgentCare,
      ...(result.symptomsUrgentCare && {
        urgentCareMessage: translateMessage('chatbotUrgentCare', result.patient.language, {}),
      }),
    });
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    if (e.statusCode === 409) {
      return res.status(409).json({
        error: e.message,
        ...(e.existing && { existing: e.existing }),
      });
    }
    console.error(e);
    return res.status(500).json({ error: 'Registration failed' });
  }
}
