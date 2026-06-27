const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'test123';

async function hashPassword(pw) {
  return bcrypt.hash(pw, SALT_ROUNDS);
}

async function tryDeleteUser(username) {
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (user) {
      await prisma.user.delete({ where: { username } });
      console.log(`  Deleted existing user: ${username}`);
    }
  } catch (e) {
    console.log(`  Could not delete ${username} (has related records) — skipping`);
  }
}

async function main() {
  console.log('=== Seeding test users ===\n');

  // 1. Ensure card products exist and are active
  const generalCard = await prisma.cardProduct.upsert({
    where: { slug: 'GENERAL' },
    update: { isActive: true },
    create: { name: 'Medical Card', slug: 'GENERAL', regPrice: 100, actPrice: 100, description: 'General medical card for regular consultation', isActive: true }
  });
  console.log(`Card: ${generalCard.name} (${generalCard.slug})`);

  const dermaCard = await prisma.cardProduct.upsert({
    where: { slug: 'DERMATOLOGY' },
    update: { isActive: true },
    create: { name: 'Dermatology Card', slug: 'DERMATOLOGY', regPrice: 400, actPrice: 300, description: 'Dermatology specialty card', isActive: true }
  });
  console.log(`Card: ${dermaCard.name} (${dermaCard.slug})`);

  const dentalCard = await prisma.cardProduct.upsert({
    where: { slug: 'DENTAL' },
    update: { isActive: true },
    create: { name: 'Dental Card', slug: 'DENTAL', regPrice: 200, actPrice: 150, description: 'Dental specialty card', isActive: true }
  });
  console.log(`Card: ${dentalCard.name} (${dentalCard.slug})`);

  const kidsCard = await prisma.cardProduct.upsert({
    where: { slug: 'KIDS' },
    update: { isActive: true },
    create: { name: 'Kids Card', slug: 'KIDS', regPrice: 50, actPrice: 50, description: null, isActive: true }
  });
  console.log(`Card: ${kidsCard.name} (${kidsCard.slug})`);

  // 2. Try to delete old admin + testdoctor so we can recreate them
  console.log('\nCleaning up old users...');
  await tryDeleteUser('admin');
  await tryDeleteUser('testdoctor');

  // 3. Deactivate remaining old users
  const deactivated = await prisma.user.updateMany({
    where: { isActive: true },
    data: { isActive: false }
  });
  console.log(`Deactivated ${deactivated.count} remaining old users\n`);

  // 4. Create admin user
  const adminPw = await hashPassword('admin123');
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: adminPw,
      fullname: 'Administrator',
      role: 'ADMIN',
      email: 'admin@clinic.com',
      isActive: true
    }
  });
  console.log(`Admin:    admin / admin123`);

  // 5. Create doctor users (one per workspace profile)
  const doctors = [
    { username: 'drgeneral',  fullname: 'Dr. General',         specialty: 'general',       qualifications: ['General Doctor'], consultationFee: 50, requiredCardType: 'GENERAL' },
    { username: 'drdentist',   fullname: 'Dr. Dentist',        specialty: 'dentist',       qualifications: ['Dentist'],       consultationFee: 50, requiredCardType: 'DENTAL' },
    { username: 'drderma',     fullname: 'Dr. Derma',          specialty: 'dermatology',   qualifications: ['Dermatology'],   consultationFee: 50, requiredCardType: 'DERMATOLOGY' },
    { username: 'drho',        fullname: 'Dr. Health Officer', specialty: 'healthOfficer', qualifications: ['Health Officer'], consultationFee: 50, requiredCardType: 'GENERAL' },
    { username: 'drobgyn',     fullname: 'Dr. OBGYN',          specialty: 'obgyn',         qualifications: ['General Doctor'], consultationFee: 50, requiredCardType: 'GENERAL' },
    { username: 'drped',       fullname: 'Dr. Pediatrician',   specialty: 'pediatrician',  qualifications: ['General Doctor'], consultationFee: 50, requiredCardType: 'KIDS' },
    { username: 'drinternist', fullname: 'Dr. Internist',      specialty: 'internist',     qualifications: ['General Doctor'], consultationFee: 50, requiredCardType: 'GENERAL' },
    { username: 'drsurgeon',   fullname: 'Dr. Surgeon',        specialty: 'surgeon',       qualifications: ['General Doctor'], consultationFee: 50, requiredCardType: 'GENERAL' },
    { username: 'drortho',     fullname: 'Dr. Orthopedic',     specialty: 'orthopedic',    qualifications: ['General Doctor'], consultationFee: 50, requiredCardType: 'GENERAL' },
    { username: 'drphysio',    fullname: 'Dr. Physiotherapist', specialty: 'physiotherapist', qualifications: ['General Doctor'], consultationFee: 50, requiredCardType: 'GENERAL' },
  ];

  const doctorPw = await hashPassword(DEFAULT_PASSWORD);
  for (const d of doctors) {
    await prisma.user.create({
      data: {
        username: d.username,
        password: doctorPw,
        fullname: d.fullname,
        role: 'DOCTOR',
        specialty: d.specialty,
        qualifications: d.qualifications,
        consultationFee: d.consultationFee,
        requiredCardType: d.requiredCardType,
        isActive: true
      }
    });
    console.log(`Doctor:   ${d.username} / ${DEFAULT_PASSWORD}   spec:${d.specialty}  card:${d.requiredCardType}`);
  }

  // 6. Create role users (one per role)
  const roles = [
    { username: 'nurse1',      fullname: 'Nurse One',          role: 'NURSE' },
    { username: 'lab1',        fullname: 'Lab Tech One',       role: 'LAB_TECHNICIAN' },
    { username: 'rad1',        fullname: 'Radiologist One',    role: 'RADIOLOGIST' },
    { username: 'pharm1',      fullname: 'Pharmacist One',     role: 'PHARMACIST' },
    { username: 'reception1',  fullname: 'Reception One',      role: 'RECEPTIONIST' },
    { username: 'billing1',    fullname: 'Billing One',        role: 'BILLING_OFFICER' },
    { username: 'pharmbill1',  fullname: 'Pharmacy Bill',      role: 'PHARMACY_BILLING_OFFICER' },
    { username: 'report1',     fullname: 'Report User',        role: 'REPORT' },
  ];

  const rolePw = await hashPassword(DEFAULT_PASSWORD);
  for (const r of roles) {
    await prisma.user.create({
      data: {
        username: r.username,
        password: rolePw,
        fullname: r.fullname,
        role: r.role,
        isActive: true
      }
    });
    console.log(`${r.role}: ${r.username} / ${DEFAULT_PASSWORD}`);
  }

  console.log('\n=== Done ===');
  console.log('Admin:   admin / admin123');
  console.log('Others:  <username> / test123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
