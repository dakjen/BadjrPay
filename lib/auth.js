import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail, initDb } from "./db";
import { consumeCode } from "./auth-codes";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          await initDb();
          const user = await getUserByEmail(credentials.email);
          if (!user) return null;
          const valid = await bcrypt.compare(credentials.password, user.password_hash);
          if (!valid) return null;
          // Second factor: a single-use bypass token from /api/auth/2fa (emailed code verified, or trusted device)
          if (!(await consumeCode(user.id, "bypass", credentials.code))) return null;
          return { id: String(user.id), email: user.email, name: user.name, role: user.role };
        } catch (e) {
          console.error("Auth error:", e);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.role = user.role; token.id = user.id; }
      return token;
    },
    session({ session, token }) {
      if (session.user) { session.user.role = token.role; session.user.id = token.id; }
      return session;
    },
  },
};
