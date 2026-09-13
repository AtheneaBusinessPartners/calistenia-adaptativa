"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signIn } from "../../lib/actions/auth.js";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-lg bg-[var(--accent)] px-3 py-2 font-medium text-black disabled:opacity-50"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(signIn, undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Calistenia Adaptativa</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Inicia sesión para ver tu plan de hoy.</p>
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
          placeholder="Contraseña"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
        {state?.error && <p className="text-sm text-[var(--danger)]">{state.error}</p>}
        <SubmitButton />
      </form>

      <p className="text-sm text-[var(--muted)]">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="text-[var(--accent)]">
          Regístrate
        </Link>
      </p>
    </main>
  );
}
