import type { NextAuthConfig } from 'next-auth';
import type { Session } from 'next-auth';
 
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnClientArea = nextUrl.pathname.startsWith('/client');
      const userRole = auth?.user?.role;
      
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isOnClientArea) {
        if (isLoggedIn && userRole === 'client') return true;
        return false; // Redirect non-clients or unauthenticated users to login page
      } else if (isLoggedIn) {
        // Redirect users based on their role after login
        if (userRole === 'admin' || userRole === 'professional') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        } else if (userRole === 'client') {
          return Response.redirect(new URL('/client', nextUrl));
        }
      }
      return true;
    },
    jwt({ token, user }) {
      // Store user data in JWT token when user signs in
      if (user) {
        token.id = user.id;
        token.image = user.image;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      // Pass user data from JWT token to session
      if (token) {
        session.user.id = token.id as string;
        session.user.image = token.image as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  providers: [],
} satisfies NextAuthConfig;
