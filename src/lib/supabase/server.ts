import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente de Supabase para Server Components / Server Actions / Route
 * Handlers — lee y escribe la sesión vía cookies. `set` puede fallar si se
 * llama desde un Server Component puro (no puede escribir cookies); se
 * ignora a propósito, el middleware de refresco de sesión ya se encarga. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component sin permiso de escritura de cookies — el
            // middleware ya refresca la sesión en cada request.
          }
        },
      },
    },
  );
}
