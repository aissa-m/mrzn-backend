import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@maurizone.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@maurizone.com',
      password: hash,
      role: 'ADMIN',
    },
  });
}
void main().finally(() => prisma.$disconnect());
