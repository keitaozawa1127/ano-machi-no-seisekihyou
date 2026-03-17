export const runtime = 'experimental-edge';
import middleware from "next-auth/middleware";

export default middleware;

export const config = {
    matcher: ["/admin/:path*"],
};
