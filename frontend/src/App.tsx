import EditorShell from "./components/editor/EditorShell"
import AuthScreen from "./auth/AuthScreen"
import { AuthProvider, useAuth } from "./auth/AuthContext"
import { EditorProvider } from "./editor/EditorContext"

function AppContent() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return <main className="auth-screen"><p className="auth-card__loading">Loading session...</p></main>
  }

  if (!user) return <AuthScreen />

  return (
    <EditorProvider>
      <EditorShell userId={user.id} userEmail={user.email} onSignOut={signOut} />
    </EditorProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App