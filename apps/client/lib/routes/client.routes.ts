// ============================================================================
// CLIENT (HOMEOWNER) PAGE ROUTES — private routes for authenticated clients
// ============================================================================

export const CLIENT_ROUTES = {
  // Public entry
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  onboarding: "/onboarding",
  authCallback: "/auth-callback",

  // Client / Homeowner private routes
  client: "/client",
  userDashboard: "/homeowner-dashboard",
  userProfile: "/profile",
  userProfileComplete: "/profile/complete",
  userSettings: "/profile",
  userNotifications: "/notifications",
  userProjects: "/projects",
  userMessages: "/messages",
} as const;

export type ClientRouteKey = keyof typeof CLIENT_ROUTES;

// Dynamic URL helpers
export const getProjectUrl = (id: string) => `/projects/${id}`;
export const getIdeaBookUrl = (id: string) => `/idea-books/${id}`;

// Auth redirect helpers
export const getSignInWithRedirect = (returnTo: string): string => {
  const params = new URLSearchParams({ redirect_url: returnTo });
  return `${CLIENT_ROUTES.signIn}?${params.toString()}`;
};

export const getSignUpWithRedirect = (returnTo: string): string => {
  const params = new URLSearchParams({ redirect_url: returnTo });
  return `${CLIENT_ROUTES.signUp}?${params.toString()}`;
};

// Route classification helpers
export const isPublicRoute = (path: string): boolean => {
  const publicPaths = [
    "/",
    "/sign-in",
    "/sign-up",
    "/professionals",
    "/stores",
    "/properties",
  ];
  return publicPaths.some((p) => path === p || path.startsWith(`${p}/`));
};

export const isAuthRoute = (path: string): boolean =>
  path.startsWith("/sign-in") ||
  path.startsWith("/sign-up") ||
  path === "/auth-callback";

// ============================================================================
// CLIENT API ROUTES
// ============================================================================

export const CLIENT_API_ROUTES = {
  // Auth & users
  clerkWebhook: "/api/clerk-webhook",
  users: "/api/users",
  userDetail: (id: string) => `/api/users/${id}`,
  userProfileStatus: "/api/user/profile",
  userProfileCompleteApi: "/api/user/profile/complete",
  userConsent: "/api/user/consent",

  // Onboarding
  onboarding: "/api/onboarding",
  onboardingSkip: "/api/onboarding/skip",
  onboardingSkipProfessional: "/api/onboarding/skip-professional",
  onboardingUploads: "/api/onboarding/uploads",

  // Messaging
  messagingConversations: "/api/messaging/conversations",
  messagingConversationDetail: (id: string) =>
    `/api/messaging/conversations/${id}`,
  messagingConversationRead: (id: string) =>
    `/api/messaging/conversations/${id}/read`,
  messagingMessages: "/api/messaging/messages",
  messagingMessageDetail: (id: string) => `/api/messaging/messages/${id}`,
  messagingMessageRead: (id: string) => `/api/messaging/messages/${id}/read`,

  // Profile
  profileComplete: "/api/profile/complete",
  profileStatus: "/api/profile/status",

  // Notifications
  notifications: "/api/notifications",
  notificationDetail: (id: string) => `/api/notifications/${id}`,

  // Idea Books
  ideaBooks: "/api/idea-books",
  ideaBookDetail: (id: string) => `/api/idea-books/${id}`,
  ideaBookAttachments: (bookId: string) =>
    `/api/idea-books/${bookId}/attachments`,
  ideaBookAttachmentDetail: (bookId: string, attachmentId: string) =>
    `/api/idea-books/${bookId}/attachments/${attachmentId}`,

  // Uploads
  uploads: "/api/uploads",

  // Client Dashboard
  clientDashboard: "/api/client/dashboard",
} as const;
