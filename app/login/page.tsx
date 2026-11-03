"use client";
import { useActionState } from "react";
import { login } from "@/app/actions";

export default function Login() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card mx-auto mt-20 max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <input name="password" type="password" className="input" placeholder="Password" autoFocus required />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        Enter
      </button>
    </form>
  );
}
