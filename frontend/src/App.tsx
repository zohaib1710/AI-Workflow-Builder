import EditorShell from "./components/editor/EditorShell"
import { EditorProvider } from "./editor/EditorContext"

function App() {
  return (
    <EditorProvider>
      <EditorShell />
    </EditorProvider>
  )
}

export default App
