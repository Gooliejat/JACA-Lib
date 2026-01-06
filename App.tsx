import React, { useState, useEffect } from 'react';
import { DropboxService } from './services/dropboxService';
import { ConnectDropbox } from './components/ConnectDropbox';
import { AppLogin } from './components/AppLogin';
import { Dashboard } from './components/Dashboard';
import { User, AuthState, Role } from './types';
import { hashPassword } from './utils/crypto';
import { DROPBOX_ACCESS_TOKEN } from './config';

// Constants
const DROPBOX_TOKEN_KEY = 'dropbase_dbx_token';

function App() {
  const [dropboxService, setDropboxService] = useState<DropboxService | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    dropboxToken: null,
    isAuthenticated: false,
    currentUser: null,
    status: 'idle'
  });
  const [error, setError] = useState<string>('');

  // 1. Initial Load: Check for Dropbox Token (Config or LocalStorage)
  useEffect(() => {
    // Prefer the hardcoded token if available, otherwise check localStorage
    const token = DROPBOX_ACCESS_TOKEN || localStorage.getItem(DROPBOX_TOKEN_KEY);
    if (token) {
      initializeDropbox(token);
    } else {
      setAuthState(prev => ({ ...prev, status: 'login_required' }));
    }
  }, []);

  // 2. Initialize Dropbox Service & Check for User DB
  const initializeDropbox = async (token: string) => {
    const service = new DropboxService(token);
    setAuthState(prev => ({ ...prev, status: 'checking_dropbox' }));
    
    try {
        // Verify token by listing files
        await service.listFiles('');
        
        // Setup Service
        setDropboxService(service);
        setAuthState(prev => ({ ...prev, dropboxToken: token }));
        
        // Only store in local storage if it's not the config token
        localStorage.setItem(DROPBOX_TOKEN_KEY, token);

        // Check for roles.json
        const rolesDbExists = await service.fileExists('/roles.json');
        if (!rolesDbExists) {
            const defaultRoles: Role[] = [
                { id: 'group_admin', name: 'Group Admin', description: 'Full system access, manages associations and users.' },
                { id: 'admin', name: 'Admin', description: 'Manages users within their associations.' },
                { id: 'user', name: 'User', description: 'Can access files.' }
            ];
            await service.uploadJson('/roles.json', { roles: defaultRoles });
            console.log("Created roles.json");
        }

        // Check for users.json
        const userDbExists = await service.fileExists('/users.json');
        
        if (!userDbExists) {
            // Create default admin with group_admin role
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
            console.log("Created users.json with default admin/admin123 (Group Admin)");
        } else {
            // MIGRATION / RECOVERY: 
            // 1. Upgrade 'admin' to 'group_admin' if needed.
            // 2. Restore 'admin' password to 'admin123' (per user request).
            try {
                const userData = await service.downloadJson('/users.json');
                if (userData && Array.isArray(userData.users)) {
                    let changed = false;
                    const defaultAdminHash = await hashPassword('admin123');

                    const updatedUsers = userData.users.map((u: User) => {
                        // Target the default 'admin' user
                        if (u.username === 'admin') {
                            // Check if role needs upgrade OR password needs restoration
                            if (u.role !== 'group_admin' || u.passwordHash !== defaultAdminHash) {
                                changed = true;
                                return { 
                                    ...u, 
                                    role: 'group_admin', 
                                    passwordHash: defaultAdminHash 
                                };
                            }
                        }
                        return u;
                    });

                    if (changed) {
                        await service.uploadJson('/users.json', { users: updatedUsers });
                        console.log("Restored 'admin' user: Role set to 'group_admin', Password reset to 'admin123'");
                    }
                }
            } catch (err) {
                console.warn("User migration check failed", err);
            }
        }

        // Check for associations.json
        const assocDbExists = await service.fileExists('/associations.json');
        
        if (!assocDbExists) {
             await service.uploadJson('/associations.json', { associations: [] });
             console.log("Created associations.json");
        }

        setAuthState(prev => ({ ...prev, status: 'app_login' }));
        setError('');

    } catch (e: any) {
        console.error("Init failed", e);
        setError('Connection failed. If the configured token is invalid, please enter a new one.');
        setAuthState(prev => ({ ...prev, status: 'login_required' }));
        localStorage.removeItem(DROPBOX_TOKEN_KEY);
    }
  };

  // 3. Handle App Login
  const handleAppLogin = async (username: string, pass: string) => {
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

  const handleDropboxConnect = (token: string) => {
      initializeDropbox(token);
  };

  const handleResetDropbox = () => {
      localStorage.removeItem(DROPBOX_TOKEN_KEY);
      setDropboxService(null);
      setAuthState({
          dropboxToken: null,
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
      return <ConnectDropbox onConnect={handleDropboxConnect} error={error} />;
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