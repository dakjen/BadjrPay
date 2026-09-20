import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: ["/((?!login|setup|pay/|api/auth|api/setup|api/pay/|api/stripe/|_next|favicon|icon|manifest|sw\\.js).*)"],
};
