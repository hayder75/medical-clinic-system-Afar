const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetPasswords() {
  const hashedPassword = await bcrypt.hash('1234', 10);
  
  const users = await prisma.user.findMany();
  
  console.log(`Found ${users.length} users. Resetting passwords to: 1234\n`);
  
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });
    console.log(`Reset: ${user.username} (${user.role})`);
  }
  
  console.log(`\nAll ${users.length} users now have password: 1234`);
}

resetPasswords()
  .catch(console.error)
  .finally(() => prisma.$disconnect());