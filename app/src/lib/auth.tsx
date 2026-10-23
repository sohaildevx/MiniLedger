import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Holds the JWT and decides which screen the app should show.
 *
 * The token is kept in expo-secure-store (Android Keystore / iOS Keychain)
 * rather than AsyncStorage, because AsyncStorage is plain unencrypted JSON and
 * a rooted device can read it.
 */

const TOKEN_KEY = 'miniledger.token';

/**
 * Platform storage.
 *
 * On native, SecureStore backs onto the Android Keystore / iOS Keychain.
 *
 * On web, `isAvailableAsync()` resolves false, so we fall back to
 * localStorage. An earlier version of this file used an in-memory Map instead,
 * and that was a real bug: it is wiped on every page reload and every Metro
 * hot-reload, so the user appeared to be signed out at random.
 *
 * localStorage can also throw in Safari private mode, hence the try/catch -
 * a failed write should degrade to a shorter session, never to a crash.
 */
const webStorage = {
  read(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  write(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* private browsing - the session simply will not persist */
    }
  },
  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* private browsing */
    }
  },
};

let secureStoreAvailable: boolean | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable === null) {
    try {
      // A plain try/catch, not `.catch()`: if the symbol is missing the call
      // throws *synchronously*, before `.catch()` would ever be attached.
      secureStoreAvailable = await SecureStore.isAvailableAsync();
    } catch {
      secureStoreAvailable = false;
    }
  }
  return secureStoreAvailable;
}

/**
 * Every accessor falls back to localStorage if SecureStore misbehaves, so a
 * storage failure costs the user a session rather than the whole sign-in flow.
 */
async function readToken(): Promise<string | null> {
  try {
    if (await isSecureStoreAvailable()) return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    /* fall through */
  }
  return webStorage.read(TOKEN_KEY);
}

async function writeToken(token: string): Promise<void> {
  try {
    if (await isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      return;
    }
  } catch {
    /* fall through */
  }
  webStorage.write(TOKEN_KEY, token);
}

async function clearToken(): Promise<void> {
  try {
    if (await isSecureStoreAvailable()) await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* fall through */
  }
  webStorage.remove(TOKEN_KEY);
}

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  token: string | null;
  status: AuthStatus;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Restore any previous session once on mount.
  useEffect(() => {
    let cancelled = false;
    void readToken()
      .then((stored) => {
        if (cancelled) return;
        setToken(stored);
        setStatus(stored ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        if (!cancelled) setStatus('signedOut');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (nextToken: string) => {
    await writeToken(nextToken);
    setToken(nextToken);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(() => ({ token, status, signIn, signOut }), [token, status, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
