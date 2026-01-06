export interface Role {
  id: string;
  name: string;
  description: string;
}

export interface Association {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface User {
  username: string;
  passwordHash: string; // Storing hash, not plain text
  role: 'group_admin' | 'admin' | 'user' | string; // Dynamic but typed for core roles
  createdAt: string;
  associationIds?: string[];
}

export interface AuthState {
  dropboxToken: string | null;
  isAuthenticated: boolean;
  currentUser: User | null;
  status: 'idle' | 'checking_dropbox' | 'login_required' | 'app_login' | 'dashboard';
}

export interface DropboxFileEntry {
  '.tag': 'file' | 'folder';
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  client_modified?: string;
  server_modified?: string;
  rev?: string;
  size?: number;
}

export interface JsonFileContent {
  [key: string]: any;
}

export interface MusicRecord {
  nr: string;
  title: string;
  composer: string;
  arranged: string;
}

export interface MusicDatabase {
  id: string;
  name: string;
  associationId: string;
  fileName: string; // The path to the json file containing the records
  createdAt: string;
  recordCount: number;
}