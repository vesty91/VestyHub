export type UserRole = "ADMIN" | "USER" | "VIEWER";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image: string | null;
}

export interface AuthSession {
  user: AuthenticatedUser;
  expiresAt: Date;
}
