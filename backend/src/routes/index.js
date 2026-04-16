import { Router } from 'express';
import * as patientController from '../controllers/patient.controller.js';
import * as queueController from '../controllers/queue.controller.js';
import * as doctorController from '../controllers/doctor.controller.js';
import * as whatsappController from '../controllers/whatsapp.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as broadcastController from '../controllers/broadcast.controller.js';
import * as displayController from '../controllers/display.controller.js';
import * as visitController from '../controllers/visit.controller.js';
import { requireStaffKey } from '../middleware/requireStaffKey.js';

const router = Router();

router.get('/patient/lookup', patientController.lookupByPhone);
router.get('/patient/:id/history', patientController.history);
router.post('/patient/register', patientController.register);
router.get('/doctors', doctorController.list);
router.post('/doctors', requireStaffKey, doctorController.create);
router.patch('/doctors/:id', requireStaffKey, doctorController.update);
router.delete('/doctors/:id', requireStaffKey, doctorController.remove);
router.get('/display/board', displayController.board);
router.get('/queue', queueController.getQueue);
router.get('/queue/snapshot', queueController.snapshot);
router.post('/queue/add', queueController.addToQueue);
router.post('/queue/cancel', queueController.cancelQueue);
router.post('/queue/reschedule', queueController.rescheduleQueue);
router.get('/queue/status/:phone', queueController.statusByPhone);
router.patch('/visit/:id/payment', visitController.updatePayment);
router.post('/queue/next', queueController.nextPatient);
router.post('/queue/skip', queueController.skipPatient);
router.post('/queue/priority', queueController.updatePriority);
router.get('/whatsapp-webhook', whatsappController.webhookInfo);
router.post('/whatsapp-webhook', whatsappController.webhook);
router.get('/analytics', requireStaffKey, analyticsController.getAnalytics);
router.post('/broadcast', requireStaffKey, broadcastController.postBroadcast);

export default router;
