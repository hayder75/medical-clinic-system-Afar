const express = require('express');
const doctorController = require('../controllers/doctorController');
const batchOrderController = require('../controllers/batchOrderController');
const adminController = require('../controllers/adminController');
const transferController = require('../controllers/transferController');
const prisma = require('../config/database');
const { getDoctorWorkspaceConfig, resolveDoctorWorkspaceProfile } = require('../controllers/systemSettingsController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

const DOCTOR_ROLES = ['DOCTOR', 'HEALTH_OFFICER', 'DERMATOLOGY'];

const getDoctorWorkspaceSettingsFallback = async (req, res) => {
	try {
		const doctorProfile = await prisma.user.findUnique({
			where: { id: req.user.id },
			select: {
				id: true,
				role: true,
				qualifications: true,
				specialty: true
			}
		});

		const workspaceConfig = await getDoctorWorkspaceConfig();

		return res.json({
			success: true,
			profile: resolveDoctorWorkspaceProfile(doctorProfile || req.user),
			workspaceConfig
		});
	} catch (error) {
		console.error('Error fetching doctor workspace settings (fallback):', error);
		return res.status(500).json({ success: false, error: 'Failed to fetch doctor workspace settings' });
	}
};

const getCompletedDateRange = (dateInput) => {
	const normalized = String(dateInput || '').trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		const startDate = new Date(`${normalized}T00:00:00`);
		const endDate = new Date(startDate);
		endDate.setDate(endDate.getDate() + 1);
		return { startDate, endDate, selectedDate: normalized };
	}

	const startDate = new Date();
	startDate.setHours(0, 0, 0, 0);
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + 1);
	const selectedDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
	return { startDate, endDate, selectedDate };
};

const normalizeCompletedAt = (value) => {
	if (!value) return null;
	const completedAt = new Date(value);
	if (Number.isNaN(completedAt.getTime())) return null;
	if (completedAt.getFullYear() < 2000) return null;
	return completedAt;
};

const getCompletedVisitsFallback = async (req, res) => {
	try {
		const workspaceConfig = await getDoctorWorkspaceConfig();
		if (!workspaceConfig.completedVisitsEnabled) {
			return res.status(403).json({ success: false, error: 'Completed visits review is disabled in system settings' });
		}

		const doctorId = req.user.id;
		const assignments = await prisma.assignment.findMany({
			where: { doctorId },
			select: { id: true }
		});
		const assignmentIds = assignments.map((item) => item.id);
		const { startDate, endDate, selectedDate } = getCompletedDateRange(req.query.date);

		const ownershipClause = [
			{ suggestedDoctorId: doctorId },
			{ batchOrders: { some: { doctorId } } },
			{ labTestOrders: { some: { doctorId } } }
		];
		if (assignmentIds.length > 0) {
			ownershipClause.push({ assignmentId: { in: assignmentIds } });
		}

		const visits = await prisma.visit.findMany({
			where: {
				status: 'COMPLETED',
				completedAt: {
					gte: startDate,
					lt: endDate
				},
				OR: ownershipClause
			},
			include: {
				patient: {
					select: {
						id: true,
						name: true,
						type: true,
						gender: true,
						mobile: true,
						bloodType: true,
						age: true
					}
				},
				batchOrders: { select: { id: true, type: true } },
				labOrders: { select: { id: true } },
				labTestOrders: { select: { id: true } },
				radiologyOrders: { select: { id: true } },
				medicationOrders: { select: { id: true } },
				nurseServiceAssignments: { select: { id: true } },
				diagnosisNotes: { select: { id: true } }
			},
			orderBy: [
				{ completedAt: 'desc' },
				{ updatedAt: 'desc' }
			]
		});

		const queue = visits
			.map((visit) => {
				const completedAt = normalizeCompletedAt(visit.completedAt);
				if (!completedAt) {
					return null;
				}

				const labCount = (visit.labOrders?.length || 0)
					+ (visit.labTestOrders?.length || 0)
					+ (visit.batchOrders || []).filter((order) => order.type === 'LAB').length;
				const radiologyCount = (visit.radiologyOrders?.length || 0)
					+ (visit.batchOrders || []).filter((order) => order.type === 'RADIOLOGY').length;

				return {
					id: visit.id,
					patient: visit.patient,
					status: visit.status,
					queueType: 'COMPLETED_REVIEW',
					priority: 0,
					isEmergency: visit.isEmergency,
					createdAt: visit.createdAt,
					completedAt: completedAt.toISOString(),
					diagnosis: visit.diagnosis,
					diagnosisDetails: visit.diagnosisDetails,
					notes: visit.notes,
					summary: {
						medications: visit.medicationOrders?.length || 0,
						lab: labCount,
						radiology: radiologyCount,
						nurseServices: visit.nurseServiceAssignments?.length || 0,
						diagnosisNotes: visit.diagnosisNotes?.length || 0
					}
				};
			})
			.filter(Boolean);

		return res.json({
			success: true,
			queue,
			stats: {
				total: queue.length,
				diagnosed: queue.filter((visit) => {
					const hasDiagnosisText = Boolean(String(visit.diagnosis || visit.diagnosisDetails || '').trim());
					return hasDiagnosisText || (visit.summary?.diagnosisNotes || 0) > 0;
				}).length,
				medications: queue.filter((visit) => (visit.summary?.medications || 0) > 0).length,
				investigations: queue.filter((visit) => (visit.summary?.lab || 0) > 0 || (visit.summary?.radiology || 0) > 0).length,
				selectedDate
			}
		});
	} catch (error) {
		console.error('Error fetching completed visits (fallback):', error);
		return res.status(500).json({ success: false, error: 'Failed to fetch completed visits' });
	}
};

const getDoctorWorkspaceSettingsHandler =
	typeof doctorController.getDoctorWorkspaceSettings === 'function'
		? doctorController.getDoctorWorkspaceSettings
		: getDoctorWorkspaceSettingsFallback;

const getCompletedVisitsHandler =
	typeof doctorController.getCompletedVisits === 'function'
		? doctorController.getCompletedVisits
		: getCompletedVisitsFallback;

router.get('/queue', doctorController.getQueue);
router.get('/results-queue', doctorController.getResultsQueue);
router.get('/unified-queue', auth, roleGuard(DOCTOR_ROLES), doctorController.getUnifiedQueue);
router.get('/completed-visits', auth, roleGuard(DOCTOR_ROLES), getCompletedVisitsHandler);
router.get('/triage-queue', auth, roleGuard(['DOCTOR', 'ADMIN']), doctorController.getTriageQueue);
router.get('/queue-status', auth, roleGuard(['ADMIN', 'NURSE', 'BILLING_OFFICER', 'RECEPTIONIST']), doctorController.getDoctorsQueueStatus);
router.get('/dashboard-stats', auth, roleGuard(DOCTOR_ROLES), doctorController.getDashboardStats);
router.get('/workspace-settings', auth, roleGuard(DOCTOR_ROLES), getDoctorWorkspaceSettingsHandler);
router.get('/recent-activity', auth, roleGuard(DOCTOR_ROLES), doctorController.getRecentActivity);
router.get('/daily-work/monthly', auth, roleGuard(DOCTOR_ROLES), doctorController.getDailyWorkMonthly);
router.get('/daily-work/day-details', auth, roleGuard(DOCTOR_ROLES), doctorController.getDailyWorkDayDetails);
router.get('/patient-assignments', auth, roleGuard(['ADMIN', 'NURSE', 'BILLING_OFFICER', 'RECEPTIONIST']), doctorController.getPatientAssignments);
router.get('/visits/:visitId', doctorController.getVisitDetails);
router.get('/visits/:visitId/medication-check', doctorController.checkMedicationOrdering);
router.get('/patient-history/:patientId', auth, roleGuard(['DOCTOR', 'BILLING_OFFICER', 'ADMIN']), doctorController.getPatientHistory);
router.get('/patient-history/:patientId/visit/:visitId/pdf', doctorController.generateVisitHistoryPDF);
router.get('/vitals/:visitId', doctorController.getPatientVitals);
router.get('/order-status/:visitId', doctorController.getVisitOrderStatus);
router.post('/visits/:visitId/external-diagnostic-orders', auth, roleGuard(DOCTOR_ROLES), doctorController.createExternalDiagnosticOrder);
router.get('/investigation-types', doctorController.getInvestigationTypes);
router.get('/services', doctorController.getAllServices);
router.get('/lab-tests/for-ordering', auth, roleGuard(['DOCTOR', 'LAB_TECHNICIAN', 'ADMIN', 'HEALTH_OFFICER', 'DERMATOLOGY']), adminController.getLabTestsForOrdering);
router.post('/select', doctorController.selectVisit);
router.put('/visits/:visitId', doctorController.updateVisit);
router.post('/lab-orders', doctorController.createLabOrder);
router.post('/lab-orders/multiple', doctorController.createMultipleLabOrders);
router.post('/radiology-orders', doctorController.createRadiologyOrder);
router.post('/radiology-orders/multiple', doctorController.createMultipleRadiologyOrders);
router.post('/service-orders', doctorController.createDoctorServiceOrder);
router.post('/medication-orders', doctorController.createMedicationOrder);
router.post('/prescriptions/batch', doctorController.createBatchPrescription);
router.post('/custom-medications', auth, roleGuard(DOCTOR_ROLES), doctorController.saveCustomMedication);
router.get('/custom-medications/search', auth, roleGuard(DOCTOR_ROLES), doctorController.searchCustomMedications);
router.get('/prescriptions/:visitId', doctorController.getPrescriptionHistory);
router.post('/visits/:visitId/diagnosis-notes', doctorController.saveDiagnosisNotes);
router.get('/visits/:visitId/diagnosis-notes', doctorController.getDiagnosisNotes);
router.put('/visits/:visitId/diagnosis-notes/:noteId', doctorController.updateDiagnosisNotes);
router.delete('/visits/:visitId', doctorController.deleteVisit);
router.post('/complete', doctorController.completeVisit);
router.post('/direct-complete', doctorController.directCompleteVisit);

router.patch('/medication-order/:id', auth, roleGuard(DOCTOR_ROLES), doctorController.updateMedicationOrder);
router.delete('/medication-order/:id', auth, roleGuard(DOCTOR_ROLES), doctorController.deleteMedicationOrder);
router.delete('/lab-batch-order/:id', auth, roleGuard(DOCTOR_ROLES), batchOrderController.deleteLabBatchOrder);
router.delete('/lab-test-order/:id', auth, roleGuard(DOCTOR_ROLES), batchOrderController.deleteLabTestOrder);
router.delete('/radiology-batch-order/:id', auth, roleGuard(DOCTOR_ROLES), batchOrderController.deleteRadiologyBatchOrder);
router.patch('/external-diagnostic-orders/:id', auth, roleGuard(DOCTOR_ROLES), doctorController.updateExternalDiagnosticOrder);
router.delete('/external-diagnostic-orders/:id', auth, roleGuard(DOCTOR_ROLES), doctorController.deleteExternalDiagnosticOrder);

// Transfer routes
router.get('/available-doctors', auth, roleGuard(DOCTOR_ROLES), transferController.getAvailableDoctors);
router.post('/transfer', auth, roleGuard(DOCTOR_ROLES), transferController.transferPatient);
router.get('/incoming-transfers', auth, roleGuard(DOCTOR_ROLES), transferController.getIncomingTransfers);


module.exports = router;