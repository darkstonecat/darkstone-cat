import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import MembersTable, { type MemberRow } from '@/components/admin/MembersTable'

const row = (memberNumber: string, role: MemberRow['role']): MemberRow => ({
  memberNumber,
  firstName: `First ${memberNumber}`,
  lastName: 'Last',
  email: `${memberNumber}@example.com`,
  phoneMasked: null,
  dniMasked: null,
  postalCode: null,
  role,
  membershipStartDate: null,
})

function roleCell(memberNumber: string) {
  const tr = screen.getByRole('cell', { name: memberNumber }).closest('tr')!
  // Columns: number, name, email, phone, DNI, role, since
  return within(tr).getAllByRole('cell')[5]
}

describe('MembersTable roles', () => {
  it('labels each role; the legacy admin role reads as board', () => {
    render(
      <MembersTable
        members={[
          row('001', 'member'),
          row('002', 'board'),
          row('003', 'admin'),
          row('004', 'superadmin'),
        ]}
      />,
    )
    expect(roleCell('001')).toHaveTextContent('role_member')
    expect(roleCell('002')).toHaveTextContent('role_board')
    expect(roleCell('003')).toHaveTextContent('role_board')
    expect(roleCell('004')).toHaveTextContent('role_superadmin')
  })

  it('shows a role chip on the mobile cards for board roles only', () => {
    render(<MembersTable members={[row('001', 'member'), row('002', 'board'), row('004', 'superadmin')]} />)
    // Desktop cells hold one label each; the mobile cards add a chip per board role.
    expect(screen.getAllByText('role_board')).toHaveLength(2)
    expect(screen.getAllByText('role_superadmin')).toHaveLength(2)
    expect(screen.getAllByText('role_member')).toHaveLength(1)
  })
})
