import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseServices } from "./client";
import { WorkspaceSnapshot } from "@/types/market";

const LOCAL_WORKSPACES_KEY = "triad_analyzer_workspaces_v2";

function loadLocalWorkspaces(): WorkspaceSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_WORKSPACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLocalWorkspaces(list: WorkspaceSnapshot[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

export async function listWorkspaces(
  userId?: string | null
): Promise<{ workspaces: WorkspaceSnapshot[]; source: "firestore" | "local" }> {
  const localList = loadLocalWorkspaces();
  const { db, isConfigured } = getFirebaseServices();

  if (isConfigured && db && userId) {
    try {
      const q = query(
        collection(db, "workspaces"),
        where("userId", "==", userId)
      );
      const snap = await getDocs(q);
      const cloudList: WorkspaceSnapshot[] = [];
      snap.forEach((docSnap) => {
        cloudList.push(docSnap.data() as WorkspaceSnapshot);
      });
      cloudList.sort((a, b) => b.updatedAt - a.updatedAt);
      return { workspaces: cloudList, source: "firestore" };
    } catch (err) {
      console.warn("[Firestore] Fallback to local workspaces:", err);
    }
  }

  localList.sort((a, b) => b.updatedAt - a.updatedAt);
  return { workspaces: localList, source: "local" };
}

export async function saveWorkspace(
  snapshot: WorkspaceSnapshot,
  userId?: string | null
): Promise<"firestore" | "local"> {
  // Always keep a local copy for instant recovery
  const existing = loadLocalWorkspaces().filter((w) => w.id !== snapshot.id);
  existing.unshift(snapshot);
  persistLocalWorkspaces(existing.slice(0, 30));

  const { db, isConfigured } = getFirebaseServices();
  if (isConfigured && db && userId) {
    try {
      const payload: WorkspaceSnapshot = {
        ...snapshot,
        userId,
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, "workspaces", snapshot.id), payload, {
        merge: true,
      });
      return "firestore";
    } catch (err) {
      console.warn("[Firestore] Could not sync workspace to cloud:", err);
    }
  }

  return "local";
}

export async function deleteWorkspace(
  workspaceId: string,
  userId?: string | null
): Promise<void> {
  const filtered = loadLocalWorkspaces().filter((w) => w.id !== workspaceId);
  persistLocalWorkspaces(filtered);

  const { db, isConfigured } = getFirebaseServices();
  if (isConfigured && db && userId) {
    try {
      await deleteDoc(doc(db, "workspaces", workspaceId));
    } catch (err) {
      console.warn("[Firestore] Could not delete cloud workspace:", err);
    }
  }
}
