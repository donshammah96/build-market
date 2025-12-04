# Script to delete all client and professional users from the database
# This will cascade delete all related data (profiles, projects, orders, etc.)

Write-Host "🗑️  Clearing all clients and professionals from database..." -ForegroundColor Yellow
Write-Host ""

# Change to the db package directory
Set-Location "packages\db"

# Create a temporary Prisma script to delete users
$deleteScript = @"
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearUsers() {
  try {
    console.log('Starting deletion process...\n')
    
    // Count users before deletion
    const clientCount = await prisma.user.count({
      where: { role: 'client' }
    })
    const professionalCount = await prisma.user.count({
      where: { role: 'professional' }
    })
    
    console.log(\`Found \${clientCount} clients and \${professionalCount} professionals\n\`)
    
    if (clientCount === 0 && professionalCount === 0) {
      console.log('✅ No clients or professionals to delete')
      return
    }
    
    // Delete all clients (cascade will handle ClientProfile and related data)
    console.log('Deleting clients...')
    const deletedClients = await prisma.user.deleteMany({
      where: { role: 'client' }
    })
    console.log(\`✅ Deleted \${deletedClients.count} clients\n\`)
    
    // Delete all professionals (cascade will handle ProfessionalProfile and related data)
    console.log('Deleting professionals...')
    const deletedProfessionals = await prisma.user.deleteMany({
      where: { role: 'professional' }
    })
    console.log(\`✅ Deleted \${deletedProfessionals.count} professionals\n\`)
    
    // Verify deletion
    const remainingClients = await prisma.user.count({
      where: { role: 'client' }
    })
    const remainingProfessionals = await prisma.user.count({
      where: { role: 'professional' }
    })
    
    console.log('Verification:')
    console.log(\`  Remaining clients: \${remainingClients}\`)
    console.log(\`  Remaining professionals: \${remainingProfessionals}\n\`)
    
    if (remainingClients === 0 && remainingProfessionals === 0) {
      console.log('✅ All clients and professionals successfully deleted!')
    } else {
      console.log('⚠️  Warning: Some users may not have been deleted')
    }
    
  } catch (error) {
    console.error('❌ Error during deletion:', error)
    throw error
  } finally {
    await prisma.\$disconnect()
  }
}

clearUsers()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
"@

# Write the script to a temporary file
$tempScript = "clear-users-temp.ts"
Set-Content -Path $tempScript -Value $deleteScript

Write-Host "Executing deletion script..." -ForegroundColor Cyan
Write-Host ""

# Run the script with tsx
npx tsx $tempScript

# Clean up
Remove-Item $tempScript

Write-Host ""
Write-Host "✅ Script completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: The following data was CASCADE deleted:" -ForegroundColor Yellow
Write-Host "  - ClientProfile records" -ForegroundColor Gray
Write-Host "  - ProfessionalProfile records" -ForegroundColor Gray
Write-Host "  - Projects (client and professional)" -ForegroundColor Gray
Write-Host "  - Orders" -ForegroundColor Gray
Write-Host "  - Reviews" -ForegroundColor Gray
Write-Host "  - IdeaBooks" -ForegroundColor Gray
Write-Host "  - Portfolios" -ForegroundColor Gray
Write-Host "  - Certificates" -ForegroundColor Gray
Write-Host "  - Messages and MessageThreads" -ForegroundColor Gray
Write-Host "  - UserAnalytics" -ForegroundColor Gray
Write-Host ""

# Return to root directory
Set-Location "..\..\"
