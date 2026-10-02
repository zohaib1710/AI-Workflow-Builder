import { useState } from "react"
import EditorShell from "./components/editor/EditorShell"
import AuthScreen from "./auth/AuthScreen"
import { AuthProvider, useAuth } from "./auth/AuthContext"
import { EditorProvider } from "./editor/EditorContext"
import WorkflowLibrary from "./components/editor/WorkflowLibrary"
import type { SavedWorkflow } from "./editor/workflowRepository"
import type { EditorSnapshot } from "./editor/types"

interface EditorRoute {
  workflowId: string | null
  initialSnapshot: EditorSnapshot | null
  savedFingerprint: string | null
  latestSavedVersionNumber: number | null
}

function AuthenticatedApp({ user, accessToken, signOut }: { user: NonNullable<ReturnType<typeof useAuth>["user"]>; accessToken: string | null; signOut: () => Promise<void> }) {
  const [route, setRoute] = useState<EditorRoute | null>(null)
  const [libraryRefresh, setLibraryRefresh] = useState(0)

  if (!route) return <WorkflowLibrary
    userId={user.id}
    userEmail={user.email}
    refreshKey={libraryRefresh}
    onCreate={() => setRoute({ workflowId: null, initialSnapshot: null, savedFingerprint: null, latestSavedVersionNumber: null })}
    onOpen={(saved: SavedWorkflow, snapshot, savedFingerprint) => setRoute({ workflowId: saved.id, initialSnapshot: snapshot, savedFingerprint, latestSavedVersionNumber: saved.versionNumber })}
    onSignOut={signOut}
  />

  return (
    <EditorProvider key={route.workflowId ?? "new-workflow"} workflow={route.initialSnapshot?.workflow} initialSnapshot={route.initialSnapshot ?? undefined}>
      <EditorShell
        userId={user.id}
        accessToken={accessToken}
        userEmail={user.email}
        onSignOut={signOut}
        workflowId={route.workflowId ?? undefined}
        initialSavedFingerprint={route.savedFingerprint}
        initialLatestSavedVersionNumber={route.latestSavedVersionNumber}
        onBackToLibrary={() => { setRoute(null); setLibraryRefresh((value) => value + 1) }}
      />
    </EditorProvider>
  )
}

function AppContent() {
  const { user, session, loading, signOut } = useAuth()
  if (loading) return <main className="auth-screen"><p className="auth-card__loading">Loading session...</p></main>
  if (!user) return <AuthScreen />
  return <AuthenticatedApp key={user.id} user={user} accessToken={session?.access_token ?? null} signOut={signOut} />
}

function App() {
  return <AuthProvider><AppContent /></AuthProvider>
}
export default App
