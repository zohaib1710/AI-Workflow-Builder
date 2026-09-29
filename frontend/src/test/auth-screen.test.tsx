import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import AuthScreen from "../auth/AuthScreen"

const auth = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn() }))
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth }))

describe("AuthScreen", () => {
  it("explains that email confirmation is required", async () => {
    auth.signUp.mockResolvedValue({ status: "confirmation-required" })
    render(<AuthScreen />)
    fireEvent.click(screen.getByRole("button", { name: /create one/i }))
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "A" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Check your email, then sign in"))
  })
})
