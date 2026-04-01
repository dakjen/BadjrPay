import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: ["/((?!login|setup|api/auth|api/setup|_next|favicon|icon|manifest|sw\\.js).*)"],
};
