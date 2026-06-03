// Local user/admin store (no backend). Persists in localStorage so login flow
// and route guards stay synchronous.

export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  profileName: string;
  /**
   * Legacy plaintext field. Kept only for backward compatibility with
   * vaults created before passcode hashing landed. On the next successful
   * sign-in it is upgraded to `passcodeHash` + `passcodeSalt` and removed.
   */
  passcode?: string;
  passcodeHash?: string;
  passcodeSalt?: string;
  role: Role;
  createdAt: number;
  bio?: string;
  avatarEmoji?: string;
  avatarUrl?: string;
  // First device this account signed in on. Once set, sign-in is
  // rejected on any other device. Sharing the underlying localStorage
  // file to a new browser/profile will fail to log in; the only
  // sanctioned cross-device move is the encrypted vault share flow,
  // which carries its own device id along.
  boundDeviceId?: string;
  // When true, this profile is shown on the passcode-first login screen
  // so the user can just tap their avatar and enter the passcode.
  isDefaultProfile?: boolean;
}

const USERS_KEY = "vault-users";
const SESSION_KEY = "vault-session"; // stores user id
const DEVICE_KEY = "vault-device-id";

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "d-anon";
  }
}

let cachedUsersRaw: string | null = null;
let cachedUsers: User[] = [];
let cachedSessionId: string | null = null;
let cachedCurrentUser: User | null = null;

const uid = () =>
  `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// No hardcoded seed users — first launch shows a bootstrap screen that lets
// the operator either create the first admin or import a vault. Once a user
// exists, this list is the single source of truth (persisted on the device).
export function listUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      cachedUsersRaw = null;
      cachedUsers = [];
      cachedCurrentUser = null;
      return [];
    }
    if (raw === cachedUsersRaw) return cachedUsers;
    cachedUsersRaw = raw;
    cachedUsers = JSON.parse(raw) as User[];
    cachedCurrentUser = null;
    return cachedUsers;
  } catch {
    return [];
  }
}

function save(users: User[]) {
  const raw = JSON.stringify(users);
  cachedUsersRaw = raw;
  cachedUsers = users;
  cachedCurrentUser = null;
  localStorage.setItem(USERS_KEY, raw);
}

export function getUser(id: string): User | null {
  return listUsers().find((u) => u.id === id) ?? null;
}

export function getUserByUsername(username: string): User | null {
  return (
    listUsers().find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    ) ?? null
  );
}

export function listDefaultProfiles(): User[] {
  return listUsers().filter((u) => u.isDefaultProfile);
}

export function setDefaultProfile(id: string, value: boolean) {
  const users = listUsers();
  save(users.map((u) => (u.id === id ? { ...u, isDefaultProfile: value } : u)));
}

// ----- passcode hashing -----
// We never persist the plaintext passcode. Each user has a random salt
// and we store SHA-256(salt + ":" + passcode). Legacy plaintext records
// (created before this change) are upgraded transparently on next sign-in.
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export function newSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
}

export async function hashPasscode(passcode: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${passcode}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return toHex(buf);
}

export async function verifyPasscode(user: User, passcode: string): Promise<boolean> {
  if (user.passcodeHash && user.passcodeSalt) {
    const h = await hashPasscode(passcode, user.passcodeSalt);
    return h === user.passcodeHash;
  }
  // Legacy plaintext fallback
  return !!user.passcode && user.passcode === passcode;
}

async function upgradePasscodeIfNeeded(id: string, passcode: string) {
  const users = listUsers();
  const u = users.find((x) => x.id === id);
  if (!u || (u.passcodeHash && u.passcodeSalt)) return;
  const salt = newSalt();
  const hash = await hashPasscode(passcode, salt);
  save(
    users.map((x) =>
      x.id === id
        ? { ...x, passcodeHash: hash, passcodeSalt: salt, passcode: undefined }
        : x,
    ),
  );
}

export async function createUser(data: {
  username: string;
  profileName: string;
  passcode: string;
  role?: Role;
}): Promise<User> {
  const users = listUsers();
  if (users.some((u) => u.username.toLowerCase() === data.username.toLowerCase())) {
    throw new Error("Username already exists");
  }
  const salt = newSalt();
  const hash = await hashPasscode(data.passcode, salt);
  const u: User = {
    id: uid(),
    username: data.username.trim(),
    profileName: data.profileName.trim() || data.username.trim(),
    passcodeHash: hash,
    passcodeSalt: salt,
    role: data.role ?? "user",
    createdAt: Date.now(),
  };
  users.push(u);
  save(users);
  return u;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "username" | "profileName" | "role" | "bio" | "avatarEmoji" | "avatarUrl" | "isDefaultProfile">> & { passcode?: string },
) {
  const users = listUsers();
  let nextPatch: Partial<User> = { ...patch };
  delete (nextPatch as { passcode?: string }).passcode;
  if (patch.passcode) {
    const salt = newSalt();
    const hash = await hashPasscode(patch.passcode, salt);
    nextPatch = { ...nextPatch, passcodeHash: hash, passcodeSalt: salt, passcode: undefined };
  }
  const next = users.map((u) => (u.id === id ? { ...u, ...nextPatch } : u));
  // Guarantee at least one admin
  if (!next.some((u) => u.role === "admin")) {
    throw new Error("At least one admin is required");
  }
  save(next);
}

export function deleteUser(id: string) {
  const users = listUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return;
  if (target.role === "admin" && users.filter((u) => u.role === "admin").length === 1) {
    throw new Error("Cannot delete the only admin");
  }
  save(users.filter((u) => u.id !== id));
  // Clear scoped data
  try {
    localStorage.removeItem(`timeline-seeded:${id}`);
  } catch {
    /* ignore */
  }
}

// ----- session -----
export async function login(passcode: string): Promise<User | null> {
  for (const u of listUsers()) {
    if (await verifyPasscode(u, passcode)) {
      await upgradePasscodeIfNeeded(u.id, passcode);
      sessionStorage.setItem(SESSION_KEY, u.id);
      sessionStorage.setItem("auth", "1");
      return getUser(u.id);
    }
  }
  return null;
}

// Two-step login: verify passcode for a specific username.
export async function loginWithUsername(username: string, passcode: string): Promise<User | null> {
  const user = getUserByUsername(username);
  if (!user) return null;
  if (!(await verifyPasscode(user, passcode))) return null;
  await upgradePasscodeIfNeeded(user.id, passcode);
  const device = getDeviceId();
  const fresh = getUser(user.id)!;
  if (fresh.boundDeviceId && fresh.boundDeviceId !== device) {
    throw new Error(
      "This account is locked to another device. Import the encrypted vault on this device to continue.",
    );
  }
  if (!fresh.boundDeviceId) {
    const users = listUsers();
    save(users.map((u) => (u.id === fresh.id ? { ...u, boundDeviceId: device } : u)));
  }
  sessionStorage.setItem(SESSION_KEY, fresh.id);
  sessionStorage.setItem("auth", "1");
  return getUser(fresh.id);
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("auth");
}

export function getCurrentUser(): User | null {
  const id = sessionStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const raw = localStorage.getItem(USERS_KEY);
  if (id === cachedSessionId && raw === cachedUsersRaw && cachedCurrentUser) {
    return cachedCurrentUser;
  }
  cachedSessionId = id;
  cachedCurrentUser = getUser(id);
  return cachedCurrentUser;
}

export function requireUser(): User {
  const u = getCurrentUser();
  if (!u) throw new Error("Not authenticated");
  return u;
}
