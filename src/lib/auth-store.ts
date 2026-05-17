// Local user/admin store (no backend). Persists in localStorage so login flow
// and route guards stay synchronous.

export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  profileName: string;
  passcode: string;
  role: Role;
  createdAt: number;
  bio?: string;
  avatarEmoji?: string;
  // First device this account signed in on. Once set, sign-in is
  // rejected on any other device. Sharing the underlying localStorage
  // file to a new browser/profile will fail to log in; the only
  // sanctioned cross-device move is the encrypted vault share flow,
  // which carries its own device id along.
  boundDeviceId?: string;
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

export function createUser(data: {
  username: string;
  profileName: string;
  passcode: string;
  role?: Role;
}): User {
  const users = listUsers();
  if (users.some((u) => u.username.toLowerCase() === data.username.toLowerCase())) {
    throw new Error("Username already exists");
  }
  const u: User = {
    id: uid(),
    username: data.username.trim(),
    profileName: data.profileName.trim() || data.username.trim(),
    passcode: data.passcode,
    role: data.role ?? "user",
    createdAt: Date.now(),
  };
  users.push(u);
  save(users);
  return u;
}

export function updateUser(
  id: string,
  patch: Partial<Pick<User, "username" | "profileName" | "passcode" | "role" | "bio" | "avatarEmoji">>,
) {
  const users = listUsers();
  const next = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
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
export function login(passcode: string): User | null {
  const user = listUsers().find((u) => u.passcode === passcode);
  if (!user) return null;
  sessionStorage.setItem(SESSION_KEY, user.id);
  sessionStorage.setItem("auth", "1"); // legacy flag
  return user;
}

// Two-step login: verify passcode for a specific username.
export function loginWithUsername(username: string, passcode: string): User | null {
  const user = getUserByUsername(username);
  if (!user || user.passcode !== passcode) return null;
  const device = getDeviceId();
  if (user.boundDeviceId && user.boundDeviceId !== device) {
    throw new Error(
      "This account is locked to another device. Import the encrypted vault on this device to continue.",
    );
  }
  if (!user.boundDeviceId) {
    // First successful sign-in on this device — bind it.
    const users = listUsers();
    save(users.map((u) => (u.id === user.id ? { ...u, boundDeviceId: device } : u)));
  }
  sessionStorage.setItem(SESSION_KEY, user.id);
  sessionStorage.setItem("auth", "1");
  return user;
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
