import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const ALLOWED_EMAILS = ["atanas.irikev@gmail.com"];

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/api/keep-alive"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, sessionClaims } = await auth();

  // Not signed in — redirect to sign-in
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Signed in but not an allowed email — redirect back to sign-in
  const email = (sessionClaims?.email ?? "") as string;
  if (!ALLOWED_EMAILS.includes(email)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)(?:$|\\?))[^?]*(?:$|\\?))",
    "/(api|trpc)(.*)",
  ],
};
