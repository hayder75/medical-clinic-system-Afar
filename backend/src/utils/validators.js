const zod = require('zod');

exports.loginSchema = zod.object({
  username: zod.string().min(1),
  password: zod.string().min(1),
});

exports.patientSchema = zod.object({
  name: zod.string().min(1),
  dob: zod.string().optional(),
  gender: zod.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  type: zod.enum(['WALK_IN', 'REGULAR', 'PREMIUM_VIP', 'STAFF_DEPENDENT', 'INSURANCE', 'SELF_PAYING_PRIVATE', 'CHARITY_SOCIAL_SUPPORT', 'OUTPATIENT', 'INPATIENT', 'EMERGENCY']),
  mobile: zod.string().optional(),
  email: zod.string().email().optional(),
  address: zod.string().optional(),
  emergencyContact: zod.string().optional(),
  bloodType: zod.enum(['A_PLUS', 'A_MINUS', 'B_PLUS', 'B_MINUS', 'AB_PLUS', 'AB_MINUS', 'O_PLUS', 'O_MINUS', 'UNKNOWN']).optional(),
  maritalStatus: zod.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
});

exports.vitalSchema = zod.object({
  patientId: zod.string(),
  bloodPressure: zod.string().optional(),
  temperature: zod.number().optional(),
  tempUnit: zod.enum(['C', 'F']).optional(),
  heartRate: zod.number().optional(),
  respirationRate: zod.number().optional(),
  height: zod.number().optional(),
  weight: zod.number().optional(),
  oxygenSaturation: zod.number().optional(),
  condition: zod.string().optional(),
  notes: zod.string().optional(),
  painScoreRest: zod.number().optional(),
  painScoreMovement: zod.number().optional(),
  sedationScore: zod.number().optional(),
  gcsEyes: zod.number().optional(),
  gcsVerbal: zod.number().optional(),
  gcsMotor: zod.number().optional(),
  bloodPressureSystolic: zod.number().optional(),
  bloodPressureDiastolic: zod.number().optional(),
});

exports.assignmentSchema = zod.object({
  patientId: zod.string(),
  doctorId: zod.number(),
  qualifications: zod.array(zod.string()).optional(),
  specialty: zod.string().optional(),
});

exports.diagnosisSchema = zod.object({
  patientId: zod.string(),
  diagnosis: zod.string(),
});

exports.labOrderSchema = zod.object({
  patientId: zod.string(),
  typeId: zod.number(),
  instructions: zod.string(),
});

exports.radiologyOrderSchema = zod.object({
  patientId: zod.string(),
  typeId: zod.number(),
  instructions: zod.string(),
});

exports.medicationOrderSchema = zod.object({
  name: zod.string(),
  dosageForm: zod.string(),
  strength: zod.string(),
  quantity: zod.number(),
  frequency: zod.string(),
  duration: zod.string(),
  instructions: zod.string(),
  additionalNotes: zod.string().optional(),
  category: zod.enum(['TABLETS', 'CAPSULES', 'INJECTIONS', 'SYRUPS', 'OINTMENTS', 'DROPS', 'INHALERS', 'PATCHES', 'INFUSIONS']).optional(),
  inInventory: zod.boolean(),
});

exports.multipleMedicationOrderSchema = zod.object({
  patientId: zod.string(),
  medications: zod.array(exports.medicationOrderSchema),
});

exports.appointmentSchema = zod.object({
  patientId: zod.string(),
  date: zod.string(),
  time: zod.string().optional(),
  type: zod.enum(['CONSULTATION', 'FOLLOW_UP']),
  duration: zod.string().optional(),
  notes: zod.string().optional(),
});

exports.billSchema = zod.object({
  patientId: zod.string(),
  total: zod.number(),
  items: zod.array(zod.object({ description: zod.string(), price: zod.number() })),
});

exports.paymentSchema = zod.object({
  billId: zod.number(),
  amount: zod.number(),
  type: zod.enum(['CASH', 'BANK', 'INSURANCE', 'CREDIT', 'CHARITY']),
  bankName: zod.string().optional(),
  transNumber: zod.string().optional(),
});