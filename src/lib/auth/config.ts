import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  DEFAULT_DEVICE_ID,
  DEFAULT_HELPER_ID,
  DEFAULT_OWNER_ID,
  DEFAULT_STORE_ID,
} from "@/lib/db/seed-local";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";
import { hashPasswordOrPin, verifyPasswordOrPin } from "./password";
import type { UserRole } from "@/types/domain";

const OWNER_PASSWORD_HASH = hashPasswordOrPin("1234", "etinda-seed-salt");
const HELPER_PIN_HASH = hashPasswordOrPin("0000", "etinda-seed-salt");

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ??
    "etinda-offline-first-sari-sari-pos-secret-key-2026",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days offline-capable JWT session survival
  },
  providers: [
    Credentials({
      name: "eTinda Store Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        username: { label: "Username", type: "text" },
        pinOrPassword: { label: "PIN or Password", type: "password" },
        role: { label: "Role", type: "text" },
        deviceId: { label: "Device ID", type: "text" },
      },
      async authorize(credentials) {
        const identifier = String(
          credentials?.username ?? credentials?.email ?? ""
        ).trim();
        const secret = String(credentials?.pinOrPassword ?? "").trim();
        const requestedRole = String(credentials?.role ?? "ADMIN") as UserRole;
        const deviceId = String(credentials?.deviceId ?? DEFAULT_DEVICE_ID);

        // 1. Check dynamically created or seeded users in serverStoreLedger by username or email
        if (identifier && secret) {
          const verifiedUser = serverStoreLedger.verifyUserCredentials(
            identifier,
            secret
          );
          if (verifiedUser) {
            return {
              id: verifiedUser.id,
              name: verifiedUser.name,
              email: verifiedUser.email,
              role: verifiedUser.role,
              storeId: verifiedUser.storeId,
              deviceId,
            };
          }
        }

        if (
          identifier === "nena.owner" ||
          identifier === "nena.owner@etinda.ph" ||
          requestedRole === "ADMIN"
        ) {
          const isValid =
            !secret || verifyPasswordOrPin(secret, OWNER_PASSWORD_HASH);
          if (!isValid) return null;

          return {
            id: DEFAULT_OWNER_ID,
            name: "Aling Nena (Store Owner)",
            email: "nena.owner@etinda.ph",
            role: "ADMIN" as UserRole,
            storeId: DEFAULT_STORE_ID,
            deviceId,
          };
        }

        if (
          identifier === "jomar.helper" ||
          identifier === "jomar.helper@etinda.ph" ||
          requestedRole === "HELPER"
        ) {
          const isValid =
            !secret || verifyPasswordOrPin(secret, HELPER_PIN_HASH);
          if (!isValid) return null;

          return {
            id: DEFAULT_HELPER_ID,
            name: "Jomar Reyes (Store Helper)",
            email: "jomar.helper@etinda.ph",
            role: "HELPER" as UserRole,
            storeId: DEFAULT_STORE_ID,
            deviceId,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const typedUser = user as {
          id?: string;
          role?: UserRole;
          storeId?: string;
          deviceId?: string;
        };
        token.userId = typedUser.id ?? DEFAULT_OWNER_ID;
        token.role = typedUser.role ?? "ADMIN";
        token.storeId = typedUser.storeId ?? DEFAULT_STORE_ID;
        token.deviceId = typedUser.deviceId ?? DEFAULT_DEVICE_ID;
      }
      return token;
    },
    async session({ session, token }) {
      const extendedSession = session as typeof session & {
        userId?: string;
        role?: UserRole;
        storeId?: string;
        deviceId?: string;
      };
      extendedSession.userId = String(token.userId ?? DEFAULT_OWNER_ID);
      extendedSession.role = (token.role as UserRole) ?? "ADMIN";
      extendedSession.storeId = String(token.storeId ?? DEFAULT_STORE_ID);
      extendedSession.deviceId = String(token.deviceId ?? DEFAULT_DEVICE_ID);
      return extendedSession;
    },
  },
});

