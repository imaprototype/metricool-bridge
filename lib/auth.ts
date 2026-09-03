import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export { isValidApiKey } from "@/lib/apiKey"

/**
 * Login simple para la UI web (equipo de una persona, ver ARCHITECTURE.md
 * §2) — usuario/contraseña contra dos variables de entorno, sin proveedor
 * externo ni base de usuarios. La auth de la API (`x-api-key`, Fase 8) es
 * un mecanismo totalmente aparte, para las llamadas de Claude.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email
        const password = credentials?.password
        const expectedEmail = process.env.AUTH_USER_EMAIL
        const expectedPassword = process.env.AUTH_USER_PASSWORD

        if (!expectedEmail || !expectedPassword) {
          throw new Error("Faltan AUTH_USER_EMAIL / AUTH_USER_PASSWORD en el entorno.")
        }
        if (email === expectedEmail && password === expectedPassword) {
          return { id: expectedEmail, email: expectedEmail }
        }
        return null
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
})
