const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const services = await prisma.service.findMany({ where: { category: 'PROCEDURE' }, orderBy: { code: 'asc' } });
  console.log('Total procedures:', services.length);
  const ortho = services.filter(s => s.procedureGroup === 'ORTHOPEDIC');
  const gyne = services.filter(s => s.procedureGroup === 'GYNECOLOGY');
  const surg = services.filter(s => s.procedureGroup === 'SURGERY');
  const other = services.filter(s => s.procedureGroup === 'OTHER' || !s.procedureGroup);
  console.log('\nORTHOPEDIC (' + ortho.length + '):');
  ortho.forEach(s => {
    const price = s.isVariablePrice ? s.minPrice + ' - ' + s.maxPrice + ' var' : s.price.toString();
    console.log('  ' + s.code + ' - ' + s.name + ' - ' + price);
  });
  console.log('\nGYNECOLOGY (' + gyne.length + '):');
  gyne.forEach(s => {
    const price = s.isVariablePrice ? s.minPrice + ' - ' + s.maxPrice + ' var' : s.price.toString();
    console.log('  ' + s.code + ' - ' + s.name + ' - ' + price);
  });
  console.log('\nSURGERY (' + surg.length + '):');
  surg.forEach(s => {
    const price = s.isVariablePrice ? s.minPrice + ' - ' + s.maxPrice + ' var' : s.price.toString();
    console.log('  ' + s.code + ' - ' + s.name + ' - ' + price);
  });
  if (other.length > 0) {
    console.log('\nOTHER (' + other.length + '):');
    other.forEach(s => console.log('  ' + s.code + ' - ' + s.name));
  }
}
check().finally(() => prisma.$disconnect());
