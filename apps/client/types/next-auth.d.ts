import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    id?: string
    image?: string | null
    role?: string
  }

  interface AdapterUser {
    role?: string
  }

  interface Session {
    user: Required<Session['user']> & {
      id?: string
      image?: string | null
      role?: string
    }
    accessToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    image?: string | null
    role?: string
  }
}


