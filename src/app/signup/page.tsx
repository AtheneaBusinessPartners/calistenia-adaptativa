"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signUp } from "../../lib/actions/auth.js";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-lg bg-[var(--accent)] px-3 py-2 font-medium text-black disabled:opacity-50"
    >
      {pending ? "Creando…" : "Crear cuenta"}
    </button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signUp, undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Crear cuenta</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Después haremos tu evaluación inicial.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Contraseña (mínimo 6 caracteres)"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
        {state?.error && <p className="text-sm text-[var(--danger)]">{state.error}</p>}
        <SubmitButton />
      </form>

      <p className="text-sm text-[var(--muted)]">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-[var(--accent)]">
          Inicia sesión
        </Link>
      </p>
    </main>
  );
}
