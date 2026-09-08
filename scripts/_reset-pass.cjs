// reset seed passwords via Prisma — keep every demo account on Pass1234
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

(async () => {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash("Pass1234", 10);
  const seedEmails = [
    "admin@example.com",
    "superadmin@example.com",
    "operator@example.com",
    "manager@example.com",
    "room@example.com",
    "ali@example.com",
    "sara@example.com",
    "amir@example.com",
  ];
  let n = 0;
  for (const email of seedEmails) {
    const r = await prisma.user.updateMany({ where: { email }, data: { passwordHash: hash } });
    n += r.count;
  }
  await prisma.$disconnect();
  console.log(`reset ${n}/8 accounts to Pass1234`);
})();
