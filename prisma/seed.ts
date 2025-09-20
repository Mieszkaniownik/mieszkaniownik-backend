import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany();

  const password = await hash('haslo', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'jan.kowalski@imejl.pl',
      name: 'Jan',
      surname: 'Kowalski',
      password: password,
      role: Role.ADMIN,
      isEnabled: true,
    },
  });

    const regularUser1 = await prisma.user.create({
    data: {
      email: 'anna.kowalska@imejl.pl',
      name: 'Anna',
      surname: 'Kowalska', 
      password: password,
      role: Role.USER,
      isEnabled: true,
    },
  });

  const regularUser2 = await prisma.user.create({
    data: {
      email: 'panpawel@imejl.pl',
      name: 'Paweł',
      surname: 'Nowak',
      password: password,
      role: Role.USER,
      isEnabled: true,
    },
  });

  console.log('Seeded users:');
  console.log('Admin:', adminUser);
  console.log('User 1:', regularUser1);
  console.log('User 2:', regularUser2);
}

main()
  .catch((error: unknown) => {
    console.error('Error seeding database:', error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
