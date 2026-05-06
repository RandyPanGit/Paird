import { useEffect } from 'react'
import { useStore } from './store'
import JoinScreen from './screens/JoinScreen'
import ProjectSetupScreen from './screens/ProjectSetupScreen'
import WaitingScreen from './screens/WaitingScreen'
import MainScreen from './screens/MainScreen'

export default function App() {
  const { isConnected, agentStatus, isDriver, theme } = useStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  if (!isConnected) return <JoinScreen />
  if (agentStatus === 'running') return <MainScreen />
  if (isDriver()) return <ProjectSetupScreen />
  return <WaitingScreen />
}
