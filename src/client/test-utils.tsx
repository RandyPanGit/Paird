import { ReactNode } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

export function renderWithApp(ui: ReactNode) {
  const user = userEvent.setup()
  return { user, ...render(<>{ui}</>) }
}
