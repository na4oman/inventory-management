import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { DashboardWrapper } from '@/components/layout/DashboardWrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = auth()

  if (!userId) {
    redirect('/sign-in')
  }

  return <DashboardWrapper>{children}</DashboardWrapper>
}
