const prisma = require('./src/config/database');

const TEST_PREFIX = `T${Date.now()}`;
let passCount = 0;
let failCount = 0;
let records = { patientId: null, drAId: null, drBId: null, visitIds: [], assignmentIds: [], transferIds: [], billingIds: [], serviceId: null };

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passCount++;
  } else {
    console.log(`  ❌ ${message}`);
    failCount++;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleanup...');
  if (records.transferIds.length) await prisma.patientTransfer.deleteMany({ where: { id: { in: records.transferIds } } }).catch(() => {});
  if (records.billingIds.length) await prisma.billing.deleteMany({ where: { id: { in: records.billingIds } } }).catch(() => {});
  if (records.visitIds.length) {
    // Delete orders attached to visits first
    await prisma.batchOrder.deleteMany({ where: { visitId: { in: records.visitIds } } }).catch(() => {});
    await prisma.visit.deleteMany({ where: { id: { in: records.visitIds } } }).catch(() => {});
  }
  if (records.assignmentIds.length) await prisma.assignment.deleteMany({ where: { id: { in: records.assignmentIds } } }).catch(() => {});
  if (records.patientId) await prisma.patient.delete({ where: { id: records.patientId } }).catch(() => {});
  if (records.drAId) await prisma.user.delete({ where: { id: records.drAId } }).catch(() => {});
  if (records.drBId) await prisma.user.delete({ where: { id: records.drBId } }).catch(() => {});
  if (records.serviceId) await prisma.service.delete({ where: { id: records.serviceId } }).catch(() => {});
  console.log('🧹 Done');
}

async function seed() {
  console.log('\n--- Seeding ---');
  records.drAId = `t-dr-a-${TEST_PREFIX}`;
  records.drBId = `t-dr-b-${TEST_PREFIX}`;
  await prisma.user.create({ data: { id: records.drAId, username: records.drAId, fullname: `Dr A ${TEST_PREFIX}`, email: `${records.drAId}@t.com`, password: 'x', role: 'DOCTOR', isActive: true, consultationFee: 0 } });
  await prisma.user.create({ data: { id: records.drBId, username: records.drBId, fullname: `Dr B ${TEST_PREFIX}`, email: `${records.drBId}@t.com`, password: 'x', role: 'DOCTOR', isActive: true, consultationFee: 200 } });
  records.patientId = `t-pat-${TEST_PREFIX}`;
  await prisma.patient.create({ data: { id: records.patientId, name: `Test Pat ${TEST_PREFIX}`, gender: 'MALE', dob: new Date('1990-01-01'), type: 'REGULAR', cardType: 'FREE', mobile: `${Date.now()}` } });
  records.serviceId = `t-svc-${TEST_PREFIX}`;
  await prisma.service.create({ data: { id: records.serviceId, code: `CONS-${TEST_PREFIX}`, name: `Consult ${TEST_PREFIX}`, category: 'CONSULTATION', price: 200, isActive: true } });
  console.log(`  Patient=${records.patientId} DrA=${records.drAId} DrB=${records.drBId}`);
}

async function makeVisit(withOrders) {
  const asgn = await prisma.assignment.create({ data: { patientId: records.patientId, doctorId: records.drAId, status: 'Pending' } });
  records.assignmentIds.push(asgn.id);
  const visit = await prisma.visit.create({ data: { visitUid: `${TEST_PREFIX}-V${Date.now()}`, patientId: records.patientId, createdById: records.drAId, suggestedDoctorId: records.drAId, assignmentId: asgn.id, status: 'UNDER_DOCTOR_REVIEW', queueType: 'CONSULTATION', notes: `${TEST_PREFIX} original` } });
  records.visitIds.push(visit.id);
  if (withOrders) {
    await prisma.batchOrder.create({ data: { visitId: visit.id, patientId: records.patientId, doctorId: records.drAId, type: 'LAB', status: 'UNPAID' } });
  }
  console.log(`  Visit ${visit.id} ${withOrders ? '(with orders)' : ''}`);
  return visit.id;
}

// ── Test 1: Free Transfer ──
async function testFreeTransfer() {
  console.log('\n═══ TEST 1: Free Transfer ═══');
  const visitId = await makeVisit(false);
  const tc = require('./src/controllers/transferController');
  let data;
  const req = { body: { patientId: records.patientId, toDoctorId: records.drBId, visitId, reason: `${TEST_PREFIX} free` }, user: { id: records.drAId } };
  const res = { status: (c) => ({ json: (d) => { data = d; } }), json: (d) => { data = d; } };
  await tc.transferPatient(req, res);
  assert(data.paymentRequired === false, 'Free: paymentRequired false');
  assert(data.transfer.status === 'ACCEPTED', 'Free: status ACCEPTED');
  const ov = await prisma.visit.findUnique({ where: { id: visitId } });
  assert(ov.status === 'COMPLETED', 'Free: original COMPLETED');
  const sv = await prisma.visit.findUnique({ where: { id: data.visit.id } });
  assert(!!sv, 'Free: sub-visit exists');
  assert(sv.assignmentId !== null, 'Free: sub-visit has assignmentId');
  assert(sv.suggestedDoctorId === records.drBId, 'Free: sub-visit suggestedDoctorId = Dr B');
  assert(sv.parentVisitId === visitId, 'Free: sub-visit parentVisitId correct');
  assert(sv.status === 'IN_DOCTOR_QUEUE', 'Free: sub-visit IN_DOCTOR_QUEUE');
  const asgn = await prisma.assignment.findFirst({ where: { patientId: records.patientId, doctorId: records.drBId } });
  assert(!!asgn, 'Free: Assignment exists for (patient, Dr B)');
  assert(sv.assignmentId === asgn.id, 'Free: assignmentId matches');
  const tr = await prisma.patientTransfer.findUnique({ where: { id: data.transfer.id } });
  assert(!!tr && tr.status === 'ACCEPTED', 'Free: PatientTransfer ACCEPTED');
  records.transferIds.push(tr.id);
  console.log('  ✅ Free transfer passed');
}

// ── Test 2: Paid Transfer ──
async function testPaidTransfer() {
  console.log('\n═══ TEST 2: Paid Transfer ═══');
  const visitId = await makeVisit(true);
  const tc = require('./src/controllers/transferController');
  let data;
  const req = { body: { patientId: records.patientId, toDoctorId: records.drBId, visitId, reason: `${TEST_PREFIX} paid` }, user: { id: records.drAId } };
  const res = { status: (c) => ({ json: (d) => { data = d; } }), json: (d) => { data = d; } };
  await tc.transferPatient(req, res);
  assert(data.paymentRequired === true, 'Paid: paymentRequired true');
  assert(data.transfer.status === 'AWAITING_PAYMENT', 'Paid: status AWAITING_PAYMENT');
  const ov = await prisma.visit.findUnique({ where: { id: visitId } });
  assert(ov.status === 'COMPLETED', 'Paid: original COMPLETED (Doctor A done)');
  const pt = await prisma.patientTransfer.findUnique({ where: { id: data.transfer.id }, include: { subVisit: true } });
  assert(!pt.subVisit, 'Paid: no sub-visit before payment');
  assert(!!data.billing, 'Paid: billing exists');
  const bill = await prisma.billing.findUnique({ where: { id: data.billing.id }, include: { services: { include: { service: true } } } });
  assert(bill.status === 'PENDING', 'Paid: billing PENDING');
  assert(bill.services.some(bs => bs.service.category === 'CONSULTATION'), 'Paid: billing has CONSULTATION');
  records.transferIds.push(pt.id);
  records.billingIds.push(bill.id);

  // Pay
  console.log('  --- Paying bill ---');
  const bc = require('./src/controllers/billingController');
  let payData;
  const payReq = { body: { billingId: bill.id, amount: 200, type: 'CASH', notes: `${TEST_PREFIX} pay` }, user: { id: records.drAId, fullname: 'Test', username: 'test' }, ip: '127.0.0.1', get: () => 'test-agent' };
  const payRes = { status: (c) => ({ json: (d) => { payData = d; } }), json: (d) => { payData = d; } };
  await bc.processPayment(payReq, payRes);

  const ut = await prisma.patientTransfer.findUnique({ where: { id: pt.id }, include: { subVisit: { include: { assignment: true } } } });
  assert(!!ut.subVisit, 'Paid: sub-visit exists after payment');
  assert(ut.status === 'ACCEPTED', 'Paid: PatientTransfer ACCEPTED');
  assert(ut.subVisit.assignmentId !== null, 'Paid: sub-visit has assignmentId');
  assert(ut.subVisit.suggestedDoctorId === records.drBId, 'Paid: sub-visit suggestedDoctorId = Dr B');
  assert(ut.subVisit.parentVisitId === visitId, 'Paid: sub-visit parentVisitId correct');
  assert(ut.subVisit.status === 'IN_DOCTOR_QUEUE', 'Paid: sub-visit IN_DOCTOR_QUEUE');
  assert(ut.subVisit.assignment.doctorId === records.drBId, 'Paid: Assignment points to Dr B');
  const uov = await prisma.visit.findUnique({ where: { id: visitId } });
  assert(uov.status === 'COMPLETED', 'Paid: original COMPLETED (already was)');
  console.log('  ✅ Paid transfer passed');
}

// ── Test 3: Queue visibility ──
async function testQueueVisibility() {
  console.log('\n═══ TEST 3: Queue Visibility ═══');
  const dc = require('./src/controllers/doctorController');
  let data;
  const req = { query: { doctorId: records.drBId }, user: { id: records.drBId } };
  const res = { status: (c) => ({ json: (d) => { data = d; } }), json: (d) => { data = d; } };
  await dc.getUnifiedQueue(req, res);
  assert(data.success === true, 'Queue: success');
  const found = data.queue.some(v => v.patientId === records.patientId && v.suggestedDoctorId === records.drBId);
  assert(found, 'Queue: transferred patient visible in Dr B queue');
  assert(data.stats.new >= 1, `Queue: new count >= 1 (got ${data.stats.new})`);
  console.log('  ✅ Queue visibility passed');
}

// ── Test 4: Results Queue ──
async function testResultsQueue() {
  console.log('\n═══ TEST 4: Results Queue ═══');
  const subs = await prisma.visit.findMany({ where: { patientId: records.patientId, suggestedDoctorId: records.drBId, notes: { contains: TEST_PREFIX } } });
  if (!subs.length) { console.log('  ⚠️ No sub-visits'); return; }
  const sv = subs[0];
  await prisma.visit.update({ where: { id: sv.id }, data: { status: 'AWAITING_RESULTS_REVIEW', queueType: 'RESULTS_REVIEW' } });
  const results = await prisma.visit.findMany({ where: { status: 'AWAITING_RESULTS_REVIEW', queueType: 'RESULTS_REVIEW', OR: [{ assignmentId: { not: null } }, { suggestedDoctorId: records.drBId }, { batchOrders: { some: { doctorId: records.drBId } } }] } });
  const found = results.some(v => v.id === sv.id);
  assert(found, 'Results: sub-visit found via suggestedDoctorId');
  await prisma.visit.update({ where: { id: sv.id }, data: { status: 'IN_DOCTOR_QUEUE', queueType: 'CONSULTATION' } });
  console.log('  ✅ Results queue passed');
}

// ── Test 5: Queue excludes transferred-unpaid visits ──
async function testQueueExcludesPendingTransfer() {
  console.log('\n═══ TEST 5: Exclude Pending Transfer Visits from Queue ═══');
  const visitId = await makeVisit(true);
  const tc = require('./src/controllers/transferController');
  let data;
  const req = { body: { patientId: records.patientId, toDoctorId: records.drBId, visitId, reason: `${TEST_PREFIX} exclude-check` }, user: { id: records.drAId } };
  const res = { status: (c) => ({ json: (d) => { data = d; } }), json: (d) => { data = d; } };
  await tc.transferPatient(req, res);
  records.transferIds.push(data.transfer.id);
  records.billingIds.push(data.billing.id);

  // Now check Doctor A's queue — original visit should NOT appear
  const dc = require('./src/controllers/doctorController');
  let qData;
  const qReq = { query: { doctorId: records.drAId, filter: 'all' }, user: { id: records.drAId } };
  const qRes = { status: (c) => ({ json: (d) => { qData = d; } }), json: (d) => { qData = d; } };
  await dc.getUnifiedQueue(qReq, qRes);
  const excluded = !qData.queue.some(v => v.id === visitId);
  assert(excluded, 'Exclude: original visit NOT in Dr A queue (pending transfer)');
  console.log('  ✅ Queue exclusion passed');
}

// ── Test 6: Lab results routed to sub-visit after transfer ──
async function testLabResultsRouteToSubVisit() {
  console.log('\n═══ TEST 6: Lab Results Route to Sub-Visit After Transfer ═══');
  const visitId = await makeVisit(false);
  const tc = require('./src/controllers/transferController');
  let data;
  const req = { body: { patientId: records.patientId, toDoctorId: records.drBId, visitId, reason: `${TEST_PREFIX} route-test` }, user: { id: records.drAId } };
  const res = { status: (c) => ({ json: (d) => { data = d; } }), json: (d) => { data = d; } };
  await tc.transferPatient(req, res);
  const subVisitId = data.visit.id;
  const transferId = data.transfer.id;
  records.transferIds.push(transferId);

  // Simulate lab results being finalized on the original visit
  const originalVisit = await prisma.visit.findUnique({ where: { id: visitId } });
  assert(originalVisit.status === 'COMPLETED', 'Route: original visit COMPLETED');

  // Call the routing helper directly (simulates what labController does)
  const { routeResultsToSubVisits } = require('./src/controllers/labController');
  const routed = await routeResultsToSubVisits(visitId, null);

  assert(routed === 1, 'Route: results were routed to 1 sub-visit');

  // Verify sub-visit status changed to AWAITING_RESULTS_REVIEW
  const subVisit = await prisma.visit.findUnique({ where: { id: subVisitId } });
  assert(subVisit.status === 'AWAITING_RESULTS_REVIEW', `Route: sub-visit status should be AWAITING_RESULTS_REVIEW, got ${subVisit.status}`);
  assert(subVisit.queueType === 'RESULTS_REVIEW', 'Route: sub-visit queueType should be RESULTS_REVIEW');

  // Verify Doctor B's queue now finds the sub-visit in returned/results
  const dc = require('./src/controllers/doctorController');
  let qData;
  const qReq = { query: { doctorId: records.drBId, filter: 'returned' }, user: { id: records.drBId } };
  const qRes = { status: (c) => ({ json: (d) => { qData = d; } }), json: (d) => { qData = d; } };
  await dc.getUnifiedQueue(qReq, qRes);
  const foundInReturned = qData.queue.some(v => v.id === subVisitId);
  assert(foundInReturned, 'Route: sub-visit appears in Doctor B returned queue');

  // Restore status for cleanup
  await prisma.visit.update({ where: { id: subVisitId }, data: { status: 'IN_DOCTOR_QUEUE', queueType: 'CONSULTATION' } });

  console.log('  ✅ Lab results routing passed');
}

// ── Test 7: Patient history endpoint returns transfers with receiving doctor ──
async function testPatientHistoryTransfers() {
  console.log('\n═══ TEST 7: Patient History Transfers ═══');

  // Create a free transfer so we have a PatientTransfer record
  const visitId = await makeVisit(false);
  const tc = require('./src/controllers/transferController');
  let trData;
  const trReq = { body: { patientId: records.patientId, toDoctorId: records.drBId, visitId, reason: `${TEST_PREFIX} hist` }, user: { id: records.drAId } };
  const trRes = { status: (c) => ({ json: (d) => { trData = d; } }), json: (d) => { trData = d; } };
  await tc.transferPatient(trReq, trRes);
  records.transferIds.push(trData.transfer.id);

  // Call receptionController.getPatientHistory
  const rc = require('./src/controllers/receptionController');
  let histData;
  const histReq = { params: { patientId: records.patientId } };
  const histRes = { status: (c) => ({ json: (d) => { histData = d; } }), json: (d) => { histData = d; } };
  await rc.getPatientHistory(histReq, histRes);

  assert(!!histData, 'History: response exists');
  assert('transfers' in histData, 'History: response has transfers array');
  assert(Array.isArray(histData.transfers), 'History: transfers is an array');
  assert(histData.transfers.length > 0, 'History: has at least one transfer');

  const match = histData.transfers.find(t => t.visitId === visitId);
  assert(!!match, 'History: transfer links to original visit');
  assert(!!match.toDoctor, 'History: transfer has toDoctor');
  assert(match.toDoctor.fullname === `Dr B ${TEST_PREFIX}`, 'History: toDoctor is Dr B');

  // Verify the visit shows in the visits array
  const histVisit = histData.visits.find(v => v.id === visitId);
  assert(!!histVisit, 'History: original visit is in visits array');
  assert(histVisit.status === 'COMPLETED', 'History: original visit is COMPLETED');

  console.log('  ✅ Patient history transfers passed');
}

// ── Main ──
async function main() {
  console.log(`TEST PREFIX: ${TEST_PREFIX}`);
  try {
    await seed();
    await testFreeTransfer();
    await testPaidTransfer();
    await testQueueVisibility();
    await testResultsQueue();
    await testQueueExcludesPendingTransfer();
    await testLabResultsRouteToSubVisit();
    await testPatientHistoryTransfers();
    console.log(`\n📊 ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) process.exit(1);
  } catch (err) {
    console.error('\n💥', err);
    failCount++;
    console.log(`\n📊 ${passCount} passed, ${failCount} failed`);
    process.exit(1);
  } finally {
    await cleanup();
  }
}
main();
