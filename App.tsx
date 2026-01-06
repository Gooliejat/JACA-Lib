import React, { useState, useEffect } from 'react';
import { DropboxService } from './services/dropboxService';
import { AuthService } from './services/authService';
import { ConnectDropbox } from './components/ConnectDropbox';
import { AppLogin } from './components/AppLogin';
import { Dashboard } from './components/Dashboard';
import { User, AuthState, Role } from './types';
import { hashPassword } from './utils/crypto';
import { DROPBOX_ACCESS_TOKEN, DROPBOX_APP_KEY } from './config';

// Constants
const REFRESH_TOKEN_KEY = 'dropbase_refresh_token';

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
        // A. Check for OAuth Callback Code
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');

        if (authCode) {
            setAuthState(prev => ({ ...prev, status: 'checking_dropbox' }));
            try {
                // Exchange code for tokens
                const response = await AuthService.exchangeCodeForToken(authCode);
                
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);

                await handleTokenSuccess(response.access_token, response.refresh_token, response.expires_in);
                return;
            } catch (e: any) {
                console.error("Auth Error", e);
                setError(e.message || "Failed to authenticate with Dropbox");
                setAuthState(prev => ({ ...prev, status: 'login_required' }));
                return;
            }
        }

        // B. Check for Existing Refresh Token
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (storedRefreshToken) {
             setAuthState(prev => ({ ...prev, status: 'checking_dropbox' }));
             try {
                 const response = await AuthService.refreshAccessToken(storedRefreshToken);
                 await handleTokenSuccess(response.access_token, storedRefreshToken, response.expires_in);
             } catch (e) {
                 console.error("Auto-login failed", e);
                 // If refresh fails, user must log in again
                 localStorage.removeItem(REFRESH_TOKEN_KEY);
                 setAuthState(prev => ({ ...prev, status: 'login_required' }));
             }
             return;
        }

        // C. Legacy Hardcoded Token (Fallback)
        if (DROPBOX_ACCESS_TOKEN) {
            await initializeDropbox(DROPBOX_ACCESS_TOKEN);
            return;
        }

        // D. No auth found
        setAuthState(prev => ({ ...prev, status: 'login_required' }));
    };

    handleAuthFlow();
  }, []);

  const handleTokenSuccess = async (accessToken: string, refreshToken: string | undefined, expiresIn: number) => {
      // Store refresh token persistently
      if (refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
      
      // Calculate expiry time (subtract 1 minute for safety buffer)
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
        // Verify token by listing files
        await service.listFiles('');
        
        // Setup Service
        setDropboxService(service);
        
        // Check for core database files
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
        if (!assocDbExists) {
             await service.uploadJson('/associations.json', { associations: [] });
        }

        const dbRegistryExists = await service.fileExists('/databases.json');
        if (!dbRegistryExists) {
             await service.uploadJson('/databases.json', { databases: [] });
        }

        setAuthState(prev => ({ ...prev, status: 'app_login' }));
        setError('');

    } catch (e: any) {
        console.error("Init failed", e);
        setError('Connection failed. Please check your token or reconnect.');
        setAuthState(prev => ({ ...prev, status: 'login_required' }));
    }
  };

  const handleManualTokenLogin = async (token: string) => {
    setAuthState(prev => ({ ...prev, status: 'checking_dropbox' }));
    await initializeDropbox(token);
  };

  // 3. Handle App Login
  const handleAppLogin = async (username: string, pass: string) => {
      // Check if Dropbox token is expired before proceeding (only for OAuth tokens)
      if (authState.tokenExpiresAt && Date.now() > authState.tokenExpiresAt) {
           if (authState.refreshToken) {
               try {
                   const response = await AuthService.refreshAccessToken(authState.refreshToken);
                   await handleTokenSuccess(response.access_token, authState.refreshToken, response.expires_in);
               } catch (e) {
                   setError("Session expired. Please reconnect Dropbox.");
                   setAuthState(prev => ({ ...prev, status: 'login_required' }));
                   return;
               }
           }
      }

      if (!dropboxService) throw new Error("Service not ready");

      const userData = await dropboxService.downloadJson('/users.json');
      if (!userData || !userData.users) {
          throw new Error("User database corrupted or missing");
      }

      const userRecord = userData.users.find((u: User) => u.username === username);
      if (!userRecord) throw new Error("User not found");

      const inputHash = await hashPassword(pass);
      if (inputHash !== userRecord.passwordHash) {
          throw new Error("Invalid password");
      }

      // Success
      setAuthState(prev => ({ 
          ...prev, 
          isAuthenticated: true, 
          currentUser: userRecord, 
          status: 'dashboard' 
      }));
  };

  const handleResetDropbox = () => {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setDropboxService(null);
      setAuthState({
          dropboxToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isAuthenticated: false,
          currentUser: null,
          status: 'login_required'
      });
  };

  const handleLogout = () => {
      setAuthState(prev => ({ 
          ...prev, 
          isAuthenticated: false, 
          currentUser: null, 
          status: 'app_login' 
      }));
  };

  // Render Logic
  if (authState.status === 'idle' || authState.status === 'checking_dropbox') {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <svg className="animate-spin h-10 w-10 text-brand-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-500 font-medium">Connecting to Dropbox...</p>
              </div>
          </div>
      );
  }

  if (authState.status === 'login_required') {
      return <ConnectDropbox error={error} onManualToken={handleManualTokenLogin} />;
  }

  if (authState.status === 'app_login') {
      return <AppLogin onLogin={handleAppLogin} onResetToken={handleResetDropbox} />;
  }

  if (authState.status === 'dashboard' && authState.currentUser && dropboxService) {
      return (
          <Dashboard 
            user={authState.currentUser} 
            service={dropboxService} 
            onLogout={handleLogout} 
          />
      );
  }

  return null;
}

export default App;