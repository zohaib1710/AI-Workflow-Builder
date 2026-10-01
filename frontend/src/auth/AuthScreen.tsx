import { useState, type FormEvent } from "react"
import { useAuth } from "./AuthContext"
import Icon from "../components/editor/EditorIcons"

function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignUp = mode === "sign-up"

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSubmitting(true)
    try {
      if (isSignUp) {
        const result = await signUp(email.trim(), password, displayName.trim())
        if (result.status === "confirmation-required") {
          setMode("sign-in")
          setPassword("")
          setMessage("Account created. Check your email, then sign in.")
        }
      } else {
        await signIn(email.trim(), password)
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-layout">
        <section className="auth-showcase" aria-labelledby="auth-showcase-heading">
          <div className="auth-showcase__brand"><span aria-hidden="true"><Icon name="brand" /></span>Systemapic Workflow Builder</div>
          <div className="auth-showcase__content">
            <p className="auth-showcase__eyebrow">A better way to work</p>
            <h2 id="auth-showcase-heading">Give every great idea a clear path forward.</h2>
            <p>Turn your ideas into visual workflows, refine the details, and keep every version in one place.</p>
            <div className="auth-showcase__motif" aria-hidden="true">
              <span className="auth-showcase__motif-node">Your idea</span>
              <span className="auth-showcase__motif-line" />
              <span className="auth-showcase__motif-node auth-showcase__motif-node--middle">Your workflow</span>
              <span className="auth-showcase__motif-line" />
              <span className="auth-showcase__motif-node">What comes next</span>
            </div>
          </div>
          <p className="auth-showcase__footer">Clarity for every step of the process.</p>
        </section>
        <section className="auth-card" aria-labelledby="auth-heading">
          <div className="auth-card__brand"><span aria-hidden="true"><Icon name="brand" /></span>Systemapic Workflow Builder</div>
          <h1 id="auth-heading">{isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-card__intro">Save, version, and collaborate on your workflows.</p>
          <form onSubmit={submit} className="auth-card__form">
            {isSignUp && <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required /></label>}
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSignUp ? "new-password" : "current-password"} minLength={8} required /></label>
            {error && <p className="auth-card__error" role="alert">{error}</p>}
            {message && <p className="auth-card__message" role="status">{message}</p>}
            <button type="submit" className="auth-card__submit" disabled={isSubmitting}>{isSubmitting ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}</button>
          </form>
          <button type="button" className="auth-card__switch" onClick={() => { setMode(isSignUp ? "sign-in" : "sign-up"); setError(null); setMessage(null) }}>{isSignUp ? "Already have an account? Sign in" : "Need an account? Create one"}</button>
        </section>
      </div>
    </main>
  )
}

export default AuthScreen
