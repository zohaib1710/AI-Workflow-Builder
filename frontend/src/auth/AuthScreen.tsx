import { useState, type FormEvent } from "react"
import { useAuth } from "./AuthContext"

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
        await signUp(email.trim(), password, displayName.trim())
        setMessage("Account created. Check your email if confirmation is enabled.")
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
      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-card__brand">AI Workflow Builder</div>
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
    </main>
  )
}

export default AuthScreen