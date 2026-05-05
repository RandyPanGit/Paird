import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, fireEvent } from '@testing-library/react'
import Header from './Header'
import { renderWithApp } from '../test-utils'
import { useStore } from '../store'

describe('Header', () => {
  beforeEach(() => {
    useStore.setState({
      users: [
        { socketId: 'socket-1', name: 'Alice', joinedAt: new Date(), isDriver: true },
        { socketId: 'socket-2', name: 'Bob', joinedAt: new Date(), isDriver: false },
      ],
      projectName: 'paird',
      agentStatus: 'running',
      driverId: 'socket-1',
    })
  })

  it('shows the project, driver label, and online count', () => {
    renderWithApp(<Header />)
    expect(screen.getByText('paird')).toBeInTheDocument()
    expect(screen.getByText('Alice • driver')).toBeInTheDocument()
    expect(screen.getByText('2 online')).toBeInTheDocument()
  })

  it('shows a theme toggle button that calls toggleTheme on click', async () => {
    const toggleTheme = vi.fn()
    useStore.setState({ theme: 'dark', toggleTheme })
    const { user } = renderWithApp(<Header />)
    const btn = screen.getByRole('button', { name: /toggle theme/i })
    expect(btn).toHaveTextContent('🌙')
    await user.click(btn)
    expect(toggleTheme).toHaveBeenCalledOnce()
  })

  it('shows ☀️ when theme is light', () => {
    useStore.setState({ theme: 'light', toggleTheme: vi.fn() })
    renderWithApp(<Header />)
    expect(screen.getByRole('button', { name: /toggle theme/i })).toHaveTextContent('☀️')
  })

  it('shows a font size slider with default value 14', () => {
    useStore.setState({ fontSize: 14, setFontSize: vi.fn() })
    renderWithApp(<Header />)
    const slider = screen.getByRole('slider', { name: /font size/i })
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveValue('14')
  })

  it('calls setFontSize when slider changes', () => {
    const setFontSize = vi.fn()
    useStore.setState({ fontSize: 14, setFontSize })
    renderWithApp(<Header />)
    const slider = screen.getByRole('slider', { name: /font size/i })
    fireEvent.change(slider, { target: { value: '16' } })
    expect(setFontSize).toHaveBeenCalledWith(16)
  })
})
