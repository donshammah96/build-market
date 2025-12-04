import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verify() {
  const clients = await prisma.user.count({ where: { role: 'client' } })
  const professionals = await prisma.user.count({ where: { role: 'professional' } })
  
  console.log('Current database status:')
  console.log(`  Clients: ${clients}`)
  console.log(`  Professionals: ${professionals}`)
  
  await prisma.$disconnect()
}

verify()
