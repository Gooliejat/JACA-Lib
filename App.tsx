import React, { useState, useEffect } from 'react';
import { DropboxService } from './services/dropboxService';
import { AuthService } from './services/authService';
import { ConnectDropbox } from './components/ConnectDropbox';
import { AppLogin } from './components/AppLogin';
import { Dashboard } from './components/Dashboard';
import { User, AuthState, Role } from './types';
import { hashPassword } from './utils/crypto';
import { DROPBOX_ACCESS_TOKEN } from './config';

// Constants
const REFRESH_TOKEN_KEY = 'dropbase_refresh_token';
const EXPECTED_ACCOUNT = 'jacaflights@gmail.com';

function App() {
  const [dropboxService, setDropboxService] = useState<DropboxService | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    dropboxToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    isAuthenticated: false,
    currentUser: null,
    status: 'idle'
  });
  const [error, setError] = useState<string>('');

  // 1. Initial Load: Check for URL Code (Callback) or Refresh Token (Auto-login)
  useEffect(() => {
    const handleAuthFlow = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');

        if (authCode) {
            setAuthState(prev => ({ ...prev, status: 'checking_dropbox' }));
            try {
                const response = await AuthService.exchangeCodeForToken(authCode);
                window.history.replaceState({}, document.title, window.location.pathname);
                await handleTokenSuccess(response.access_token, response.refresh_token, response.expires_in);
                return;
            } catch (e: any) {
                setError(e.message || "Failed to authenticate with Dropbox");
                setAuthState(prev => ({ ...prev, status: 'login_required' }));
                return;
            }
        }

        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (storedRefreshToken) {
             setAuthState(prev => ({ ...prev, status: 'checking_dropbox' }));
             try {
                 const response = await AuthService.refreshAccessToken(storedRefreshToken);
                 await handleTokenSuccess(response.access_token, storedRefreshToken, response.expires_in);
             } catch (e) {
                 localStorage.removeItem(REFRESH_TOKEN_KEY);
                 setAuthState(prev => ({ ...prev, status: 'login_required' }));
             }
             return;
        }

        if (DROPBOX_ACCESS_TOKEN) {
            await initializeDropbox(DROPBOX_ACCESS_TOKEN);
            return;
        }

        setAuthState(prev => ({ ...prev, status: 'login_required' }));
    };

    handleAuthFlow();
  }, []);

  const handleTokenSuccess = async (accessToken: string, refreshToken: string | undefined, expiresIn: number) => {
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      const expiresAt = Date.now() + (expiresIn * 1000) - 60000;
      setAuthState(prev => ({ 
          ...prev, 
          dropboxToken: accessToken,
          refreshToken: refreshToken || prev.refreshToken,
          tokenExpiresAt: expiresAt
      }));
      await initializeDropbox(accessToken);
  };

  // 2. Initialize Dropbox Service & Check for User DB
  const initializeDropbox = async (token: string) => {
    const service = new DropboxService(token);
    
    try {
        // Verification step
        const account = await service.getCurrentAccount();
        
        if (!account || !account.email) {
          throw new Error("Connected but could not retrieve account email. Ensure 'account_info.read' scope is enabled in your Dropbox App Console.");
        }

        const connectedEmail = account.email.toLowerCase();
        if (connectedEmail !== EXPECTED_ACCOUNT.toLowerCase()) {
            localStorage.removeItem(REFRESH_TOKEN_KEY);
            throw new Error(`Connected to wrong account: ${connectedEmail}. Access is restricted to ${EXPECTED_ACCOUNT}. Please sign out of Dropbox in your browser and log in with the correct account.`);
        }

        // Verify basic file access
        await service.listFiles('');
        setDropboxService(service);
        
        // Initialize Core Files
        const rolesDbExists = await service.fileExists('/roles.json');
        if (!rolesDbExists) {
            const defaultRoles: Role[] = [
                { id: 'group_admin', name: 'Group Admin', description: 'Full system access.' },
                { id: 'admin', name: 'Admin', description: 'Local user management.' },
                { id: 'user', name: 'User', description: 'Basic access.' }
            ];
            await service.uploadJson('/roles.json', { roles: defaultRoles });
        }

        const userDbExists = await service.fileExists('/users.json');
        if (!userDbExists) {
            const defaultPass = 'admin123';
            const hashed = await hashPassword(defaultPass);
            const adminUser: User = {
                username: 'admin',
                passwordHash: hashed,
                role: 'group_admin', 
                createdAt: new Date().toISOString(),
                associationIds: []
            };
            await service.uploadJson('/users.json', { users: [adminUser] });
        }

        const assocDbExists = await service.fileExists('/associations.json');
        if (!assocDbExists) await service.uploadJson('/associations.json', { associations: [] });

        const dbRegistryExists = await service.fileExists('/databases.json');
        if (!dbRegistryExists) await service.uploadJson('/databases.json', { databases: [] });

        setAuthState(prev => ({ ...prev, status: 'app_login' }));
        setError('');

    } catch (e: any) {
        console.error("Initialization failed:", e);
        setError(e.message || 'Connection failed.');
        setAuthState(prev => ({ ...prev, status: 'login_required' }));
    }
  };

  const handleManualTokenLogin = async (token: string) => {
    setAuthState(prev => ({ ...prev, status: 'checking_dropbox' }));
    await initializeDropbox(token);
  };

  const handleAppLogin = async (username: string, pass: string) => {
      if (authState.tokenExpiresAt && Date.now() > authState.tokenExpiresAt && authState.refreshToken) {
           try {
               const response = await AuthService.refreshAccessToken(authState.refreshToken);
               await handleTokenSuccess(response.access_token, authState.refreshToken, response.expires_in);
           } catch (e) {
               setError("Session expired. Please reconnect Dropbox.");
               setAuthState(prev => ({ ...prev, status: 'login_required' }));
               return;
           }
      }

      if (!dropboxService) throw new Error("Service not ready");

      const userData = await dropboxService.downloadJson('/users.json');
      if (!userData || !userData.users) throw new Error("User database corrupted or missing");

      const userRecord = userData.users.find((u: User) => u.username === username);
      if (!userRecord) throw new Error("User not found");

      const inputHash = await hashPassword(pass);
      if (inputHash !== userRecord.passwordHash) throw new Error("Invalid password");

      setAuthState(prev => ({ ...prev, isAuthenticated: true, currentUser: userRecord, status: 'dashboard' }));
  };

  const handleResetDropbox = () => {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setDropboxService(null);
      setAuthState({
          dropboxToken: null, refreshToken: null, tokenExpiresAt: null,
          isAuthenticated: false, currentUser: null, status: 'login_required'
      });
  };

  const handleLogout = () => {
      setAuthState(prev => ({ ...prev, isAuthenticated: false, currentUser: null, status: 'app_login' }));
  };

  if (authState.status === 'idle' || authState.status === 'checking_dropbox') {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <svg className="animate-spin h-10 w-10 text-brand-600 mx-auto mb-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-500 font-medium">Connecting to Dropbox Registry...</p>
              </div>
          </div>
      );
  }

  if (authState.status === 'login_required') return <ConnectDropbox error={error} onManualToken={handleManualTokenLogin} />;
  if (authState.status === 'app_login') return <AppLogin onLogin={handleAppLogin} onResetToken={handleResetDropbox} />;
  if (authState.status === 'dashboard' && authState.currentUser && dropboxService) {
      return <Dashboard user={authState.currentUser} service={dropboxService} onLogout={handleLogout} />;
  }

  return null;
}

export default App;