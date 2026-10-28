import { initializeApp, getApps, FirebaseApp, FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
  Auth,
  User,
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const RUNTIME_CONFIG_STORAGE_KEY = "triad_firebase_runtime_config_v1";

export function getFirebaseOptions(): FirebaseOptions | null {
  const envConfig: FirebaseOptions = {
    apiKey:
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      "AIzaSyAMD5PA12UrCIBSNxlrslV3ifYEJE9VAZM",
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      "triad-phase-analyzer-2026.firebaseapp.com",
    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      "triad-phase-analyzer-2026",
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      "triad-phase-analyzer-2026.firebasestorage.app",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "211054310227",
    appId:
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
      "1:211054310227:web:018add8de946726d82e7a6",
  };

  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(RUNTIME_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FirebaseOptions;
        if (parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  return null;
}

export function saveRuntimeFirebaseConfig(config: FirebaseOptions): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RUNTIME_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function clearRuntimeFirebaseConfig(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RUNTIME_CONFIG_STORAGE_KEY);
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseServices(): {
  isConfigured: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
} {
  const options = getFirebaseOptions();
  if (!options) {
    return { isConfigured: false, app: null, auth: null, db: null };
  }

  try {
    if (!cachedApp) {
      const existing = getApps();
      cachedApp = existing.length > 0 ? existing[0] : initializeApp(options);
    }
    if (!cachedAuth) {
      cachedAuth = getAuth(cachedApp);
    }
    if (!cachedDb) {
      cachedDb = getFirestore(cachedApp);
    }
    return {
      isConfigured: true,
      app: cachedApp,
      auth: cachedAuth,
      db: cachedDb,
    };
  } catch (err) {
    console.warn("[Firebase] Initialization warning:", err);
    return { isConfigured: false, app: null, auth: null, db: null };
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  const { auth } = getFirebaseServices();
  if (!auth) throw new Error("Firebase is not configured yet.");
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signInGuestCloud(): Promise<User | null> {
  const { auth } = getFirebaseServices();
  if (!auth) throw new Error("Firebase is not configured yet.");
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  const { auth } = getFirebaseServices();
  if (!auth) return;
  await fbSignOut(auth);
}

export function subscribeAuthState(
  callback: (user: User | null, isConfigured: boolean) => void
): () => void {
  const { auth, isConfigured } = getFirebaseServices();
  if (!isConfigured || !auth) {
    callback(null, false);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    callback(user, true);
  });
}
