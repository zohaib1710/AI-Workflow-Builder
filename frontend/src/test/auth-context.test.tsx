import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AuthProvider, useAuth } from "../auth/AuthContext"

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("../lib/supabase", () => ({ supabase: { auth: authMock } }))

function Probe() {
  const auth = useAuth()
  return <div>{auth.loading ? "loading" : auth.user ? auth.user.email : "signed-out"}</div>
}

afterEach(() => vi.clearAllMocks())

describe("AuthProvider", () => {
  it("returns confirmation-required when signup creates no session", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null })
    authMock.signUp.mockResolvedValue({ data: { session: null }, error: null })
    const resultRef: { value?: unknown } = {}
    function Caller() {
      const auth = useAuth()
      void auth.signUp("a@example.com", "password123", "A").then((result) => { resultRef.value = result })
      return null
    }
    render(<AuthProvider><Caller /></AuthProvider>)
    await waitFor(() => expect(resultRef.value).toEqual({ status: "confirmation-required" }))
  })

  it("returns signed-in when signup creates a session", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null })
    authMock.signUp.mockResolvedValue({ data: { session: { user: { email: "a@example.com" } } }, error: null })
    const resultRef: { value?: unknown } = {}
    function Caller() {
      const auth = useAuth()
      void auth.signUp("a@example.com", "password123", "A").then((result) => { resultRef.value = result })
      return null
    }
    render(<AuthProvider><Caller /></AuthProvider>)
    await waitFor(() => expect(resultRef.value).toEqual({ status: "signed-in" }))
  })

  it("calls sign in and sign out", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null })
    authMock.signInWithPassword.mockResolvedValue({ error: null })
    authMock.signOut.mockResolvedValue({ error: null })
    function Caller() {
      const auth = useAuth()
      return <><button onClick={() => void auth.signIn("a@example.com", "password123")}>in</button><button onClick={() => void auth.signOut()}>out</button></>
    }
    render(<AuthProvider><Caller /></AuthProvider>)
    await waitFor(() => expect(screen.getByText("in")).toBeInTheDocument())
    screen.getByText("in").click()
    screen.getByText("out").click()
    await waitFor(() => {
      expect(authMock.signInWithPassword).toHaveBeenCalled()
      expect(authMock.signOut).toHaveBeenCalled()
    })
  })

  it("does not remain loading when session initialization fails", async () => {
    authMock.getSession.mockRejectedValue(new Error("offline"))
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument())
  })
})
