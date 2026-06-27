const prisma = require('../config/database');
const { z } = require('zod');

// Bed Schema
const bedSchema = z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    price: z.number().min(0),
    type: z.string().optional(),
    status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING']).optional(),
});

// Admission Schema
const admissionSchema = z.object({
    patientId: z.string(),
    bedId: z.string(),
    visitId: z.number().optional().nullable(),
    expectedEndDate: z.string(), // ISO date
    notes: z.string().optional().nullable(),
    initialServices: z.array(z.object({
        serviceId: z.string(),
        quantity: z.number().int().positive().default(1),
        notes: z.string().optional().nullable()
    })).optional().default([])
});

// Admission Service Schema
const admissionServiceSchema = z.object({
    admissionId: z.string(),
    serviceId: z.string(),
    quantity: z.number().int().positive().default(1),
    notes: z.string().optional().nullable(),
});

// Controllers
exports.getBeds = async (req, res) => {
    try {
        const beds = await prisma.bed.findMany({
            include: {
                admissions: {
                    where: { status: 'ADMITTED' },
                    include: {
                        patient: {
                            select: {
                                name: true,
                                id: true,
                                mobile: true,
                                gender: true,
                                dob: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json({ success: true, beds });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.createBed = async (req, res) => {
    try {
        const validatedData = bedSchema.parse(req.body);
        const bed = await prisma.bed.create({ data: validatedData });
        res.status(201).json({ success: true, bed });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateBed = async (req, res) => {
    try {
        const { id } = req.params;
        const validatedData = bedSchema.partial().parse(req.body);
        const bed = await prisma.bed.update({
            where: { id },
            data: validatedData
        });
        res.json({ success: true, bed });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.deleteBed = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if bed is occupied
        const bed = await prisma.bed.findUnique({
            where: { id },
            include: { admissions: { where: { status: 'ADMITTED' } } }
        });

        if (bed && bed.admissions.length > 0) {
            return res.status(400).json({ success: false, error: 'Cannot delete an occupied bed' });
        }

        await prisma.bed.delete({ where: { id } });
        res.json({ success: true, message: 'Bed deleted successfully' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.createAdmission = async (req, res) => {
    try {
        const admittedById = req.user.id;
        const { patientId, bedId, visitId, expectedEndDate, notes, initialServices } = admissionSchema.parse(req.body);

        // Check if bed is available
        const bed = await prisma.bed.findUnique({ where: { id: bedId } });
        if (!bed || bed.status !== 'AVAILABLE') {
            return res.status(400).json({ success: false, error: 'Bed is not available' });
        }

        // Check if patient exists
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        const startDate = new Date();
        const endDate = new Date(expectedEndDate);
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        const totalBedPrice = bed.price * diffDays;

        // Start transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create admission with PENDING_PAYMENT status
            const admission = await tx.admission.create({
                data: {
                    patientId,
                    bedId,
                    visitId: visitId || null,
                    admittedById,
                    expectedEndDate: endDate,
                    notes,
                    status: 'PENDING_PAYMENT'
                }
            });

            // 2. Update bed status
            await tx.bed.update({
                where: { id: bedId },
                data: { status: 'OCCUPIED' }
            });

            // 3. Create initial billing for the bed
            // First, ensure a "Bed Charge" service exists
            // Try to find by code first to avoid unique constraint errors
            let bedService = await tx.service.findUnique({
                where: { code: 'BED-CHRG' }
            });

            if (!bedService) {
                // If not found by code, creating it
                try {
                    bedService = await tx.service.create({
                        data: {
                            code: 'BED-CHRG',
                            name: 'Bed Occupancy Charge',
                            category: 'ACCOMMODATION',
                            price: 0,
                            isActive: true
                        }
                    });
                } catch (createError) {
                    // Check if it's a unique constraint error (race condition or existing code with different casing?)
                    if (createError.code === 'P2002') {
                        // Fallback: try to find it again (maybe created by another request)
                        bedService = await tx.service.findUnique({
                            where: { code: 'BED-CHRG' }
                        });

                        // If still not found, search by name as last resort
                        if (!bedService) {
                            bedService = await tx.service.findFirst({
                                where: { name: { contains: 'Bed Charge' } }
                            });
                        }
                    } else {
                        throw createError;
                    }
                }
            }

            const billing = await tx.billing.create({
                data: {
                    patientId,
                    visitId: visitId || null,
                    totalAmount: totalBedPrice,
                    status: 'PENDING',
                    billingType: 'ACCOMMODATION',
                    notes: `Admission for bed ${bed.name} (${diffDays} days)`
                }
            });

            // Add the bed charge to billing services
            if (bedService) {
                await tx.billingService.create({
                    data: {
                        billingId: billing.id,
                        serviceId: bedService.id,
                        quantity: diffDays,
                        unitPrice: bed.price,
                        totalPrice: totalBedPrice
                    }
                });
            }

            // Update admission with the billingId
            await tx.admission.update({
                where: { id: admission.id },
                data: { billingId: billing.id }
            });

            // 4. Process initial services if any
            if (initialServices && initialServices.length > 0) {
                for (const svc of initialServices) {
                    const dbService = await tx.service.findUnique({ where: { id: svc.serviceId } });
                    if (!dbService || !dbService.isActive) continue;

                    const svcTotalPrice = dbService.price * svc.quantity;

                    // Add to admission services
                    await tx.admissionService.create({
                        data: {
                            admissionId: admission.id,
                            serviceId: svc.serviceId,
                            orderedById: admittedById,
                            quantity: svc.quantity,
                            unitPrice: dbService.price,
                            totalPrice: svcTotalPrice,
                            notes: svc.notes,
                            status: 'PENDING',
                            billingId: billing.id
                        }
                    });

                    // Check if this service is already in the billing (e.g. if it was already added as the bed charge)
                    const existingBillingService = await tx.billingService.findUnique({
                        where: {
                            billingId_serviceId: {
                                billingId: billing.id,
                                serviceId: svc.serviceId
                            }
                        }
                    });

                    if (existingBillingService) {
                        // Update existing entry
                        await tx.billingService.update({
                            where: { id: existingBillingService.id },
                            data: {
                                quantity: { increment: svc.quantity },
                                totalPrice: { increment: svcTotalPrice }
                            }
                        });
                    } else {
                        // Create new entry
                        await tx.billingService.create({
                            data: {
                                billingId: billing.id,
                                serviceId: svc.serviceId,
                                quantity: svc.quantity,
                                unitPrice: dbService.price,
                                totalPrice: svcTotalPrice
                            }
                        });
                    }

                    // Update billing total
                    await tx.billing.update({
                        where: { id: billing.id },
                        data: { totalAmount: { increment: svcTotalPrice } }
                    });
                }
            }

            return admission;
        });

        res.status(201).json({ success: true, admission: result });
    } catch (error) {
        console.error('Create admission error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getAdmissions = async (req, res) => {
    try {
        const { status, patientId } = req.query;
        const where = {};
        if (status) where.status = status;
        if (patientId) where.patientId = patientId;

        const admissions = await prisma.admission.findMany({
            where,
            include: {
                patient: {
                    select: {
                        name: true,
                        id: true,
                        mobile: true,
                        gender: true,
                        dob: true,
                        bloodType: true
                    }
                },
                bed: true,
                admittedBy: { select: { fullname: true } },
                services: {
                    include: {
                        service: true,
                        orderedBy: { select: { fullname: true, role: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { startDate: 'desc' }
        });
        res.json({ success: true, admissions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.addAdmissionService = async (req, res) => {
    try {
        const orderedById = req.user.id;
        const { admissionId, serviceId, quantity, notes } = admissionServiceSchema.parse(req.body);

        const admission = await prisma.admission.findUnique({
            where: { id: admissionId },
            include: { patient: true }
        });
        if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' });
        if (admission.status !== 'ADMITTED') {
            return res.status(400).json({ success: false, error: 'Cannot add services to a closed admission' });
        }

        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) return res.status(404).json({ success: false, error: 'Service not found' });
        if (!service.isActive) return res.status(400).json({ success: false, error: 'Service is not active' });

        const totalPrice = service.price * quantity;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create admission service record
            const admService = await tx.admissionService.create({
                data: {
                    admissionId,
                    serviceId,
                    orderedById,
                    quantity,
                    unitPrice: service.price,
                    totalPrice,
                    notes,
                    status: 'PENDING'
                }
            });

            // 2. Find or create pending ACCOMMODATION bill
            let billing = await tx.billing.findFirst({
                where: {
                    patientId: admission.patientId,
                    status: 'PENDING',
                    billingType: 'ACCOMMODATION'
                }
            });

            if (!billing) {
                billing = await tx.billing.create({
                    data: {
                        patientId: admission.patientId,
                        visitId: admission.visitId,
                        totalAmount: totalPrice,
                        status: 'PENDING',
                        billingType: 'ACCOMMODATION',
                        notes: `Accommodation services for Admission ${admissionId}`
                    }
                });
            } else {
                billing = await tx.billing.update({
                    where: { id: billing.id },
                    data: {
                        totalAmount: { increment: totalPrice },
                        visitId: admission.visitId // Ensure visitId is linked if it exists
                    }
                });
            }

            // 3. Create or update billing service link
            const existingBS = await tx.billingService.findUnique({
                where: {
                    billingId_serviceId: {
                        billingId: billing.id,
                        serviceId: serviceId
                    }
                }
            });

            if (existingBS) {
                await tx.billingService.update({
                    where: { id: existingBS.id },
                    data: {
                        quantity: { increment: quantity },
                        totalPrice: { increment: totalPrice }
                    }
                });
            } else {
                await tx.billingService.create({
                    data: {
                        billingId: billing.id,
                        serviceId: serviceId,
                        quantity,
                        unitPrice: service.price,
                        totalPrice
                    }
                });
            }

            // 4. Update AdmissionService with billingId
            return await tx.admissionService.update({
                where: { id: admService.id },
                data: { billingId: billing.id }
            });
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'ADD_ADMISSION_SERVICE',
                entity: 'AdmissionService',
                entityId: 0, // we use 0 since we don't have int ID
                details: JSON.stringify({
                    admissionId,
                    serviceId,
                    quantity,
                    totalPrice,
                    orderedById
                })
            }
        });

        res.status(201).json({ success: true, admissionService: result });
    } catch (error) {
        console.error('Add admission service error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.extendAdmission = async (req, res) => {
    try {
        const { id } = req.params;
        const { expectedEndDate } = z.object({ expectedEndDate: z.string() }).parse(req.body);

        const admission = await prisma.admission.findUnique({
            where: { id },
            include: { bed: true }
        });

        if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' });
        if (admission.status !== 'ADMITTED') return res.status(400).json({ success: false, error: 'Admission already closed' });

        const oldEndDate = new Date(admission.expectedEndDate);
        const newEndDate = new Date(expectedEndDate);

        if (newEndDate <= oldEndDate) {
            return res.status(400).json({ success: false, error: 'New end date must be after current end date' });
        }

        const diffTime = Math.abs(newEndDate - oldEndDate);
        const extraDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const extraPrice = admission.bed.price * extraDays;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update admission
            const updatedAdmission = await tx.admission.update({
                where: { id },
                data: { expectedEndDate: newEndDate }
            });

            // 2. Add extra charge to billing
            let billing = await tx.billing.findFirst({
                where: {
                    patientId: admission.patientId,
                    status: 'PENDING',
                    billingType: 'ACCOMMODATION'
                }
            });

            let bedService = await tx.service.findUnique({
                where: { code: 'BED-CHRG' }
            });

            if (!bedService) {
                bedService = await tx.service.create({
                    data: {
                        code: 'BED-CHRG',
                        name: 'Bed Occupancy Charge',
                        category: 'ACCOMMODATION',
                        price: 0,
                        isActive: true
                    }
                });
            }

            if (!billing) {
                billing = await tx.billing.create({
                    data: {
                        patientId: admission.patientId,
                        visitId: admission.visitId,
                        totalAmount: extraPrice,
                        status: 'PENDING',
                        billingType: 'ACCOMMODATION',
                        notes: `Extension: ${admission.bed.name} for ${extraDays} more days`
                    }
                });
            } else {
                billing = await tx.billing.update({
                    where: { id: billing.id },
                    data: { totalAmount: { increment: extraPrice } }
                });
            }

            const existingBS = await tx.billingService.findUnique({
                where: {
                    billingId_serviceId: {
                        billingId: billing.id,
                        serviceId: bedService.id
                    }
                }
            });

            if (existingBS) {
                await tx.billingService.update({
                    where: { id: existingBS.id },
                    data: {
                        quantity: { increment: extraDays },
                        totalPrice: { increment: extraPrice }
                    }
                });
            } else {
                await tx.billingService.create({
                    data: {
                        billingId: billing.id,
                        serviceId: bedService.id,
                        quantity: extraDays,
                        unitPrice: admission.bed.price,
                        totalPrice: extraPrice
                    }
                });
            }

            return updatedAdmission;
        });

        res.json({ success: true, admission: result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.dischargeAdmission = async (req, res) => {
    try {
        const { id } = req.params;

        const admission = await prisma.admission.findUnique({ where: { id } });
        if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' });

        // Allow discharge for ADMITTED or PENDING_PAYMENT (cancellation)
        if (admission.status !== 'ADMITTED' && admission.status !== 'PENDING_PAYMENT') {
            return res.status(400).json({ success: false, error: 'Admission already closed' });
        }

        const updatedAdmission = await prisma.$transaction(async (tx) => {
            // Determine new status: if it was pending payment, mark as CANCELLED, else DISCHARGED
            const newStatus = admission.status === 'PENDING_PAYMENT' ? 'CANCELLED' : 'DISCHARGED';

            // Update admission
            const adm = await tx.admission.update({
                where: { id },
                data: {
                    status: newStatus,
                    actualEndDate: new Date()
                }
            });

            // Update bed status back to AVAILABLE
            await tx.bed.update({
                where: { id: admission.bedId },
                data: { status: 'AVAILABLE' }
            });

            return adm;
        });

        res.json({ success: true, admission: updatedAdmission });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
