import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, isFirebaseConfigured } from "../../lib/firebase";
import {
  accountApprovalRequestMessage,
  canSyncWithFirebase,
  getFirebaseAccessBlockReason,
  isEmailAllowedForApp
} from "../../lib/authPolicy";

type AuthContextValue = {
  isFirebaseEnabled: boolean;
  isLoading: boolean;
  user: User | null;
  /** Użytkownik gotowy do odczytu/zapisu RTDB (emailVerified + dozwolona domena). */
  syncUser: User | null;
  authBlockReason: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(isFirebaseConfigured ? null : ({ uid: "local-user" } as User));
  const [isLoading, setIsLoading] = useState<boolean>(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      if (nextUser && !isEmailAllowedForApp(nextUser.email)) {
        void signOut(auth!);
        setUser(null);
      } else {
        setUser(nextUser);
      }
      setIsLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isFirebaseEnabled: isFirebaseConfigured,
    isLoading,
    user,
    syncUser: canSyncWithFirebase(user) ? user : null,
    authBlockReason: getFirebaseAccessBlockReason(user),
    signIn: async (email, password) => {
      if (!auth) return;
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!isEmailAllowedForApp(credential.user.email)) {
        await signOut(auth);
        throw Object.assign(new Error(accountApprovalRequestMessage()), {
          code: "auth/unauthorized-email"
        });
      }
    },
    resetPassword: async (email) => {
      if (!auth) return;
      await sendPasswordResetEmail(auth, email);
    },
    resendVerificationEmail: async () => {
      if (!auth?.currentUser) {
        throw Object.assign(new Error("Brak zalogowanego użytkownika."), { code: "auth/no-user" });
      }
      await sendEmailVerification(auth.currentUser);
    },
    logout: async () => {
      if (!auth) return;
      await signOut(auth);
    }
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
