import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { User, DropboxFileEntry, Association, Role, MusicDatabase, MusicRecord, GoogleCredential } from '../types';
import { DropboxService } from '../services/dropboxService';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { 
    LogOut, 
    FileJson, 
    Users, 
    Plus, 
    Trash2, 
    Edit, 
    Save, 
    X, 
    RefreshCw, 
    Folder,
    Building,
    Shield,
    Lock,
    Music,
    Upload,
    Search,
    ArrowRight,
    ArrowLeft,
    Database,
    Download,
    ChevronUp,
    ChevronDown,
    Loader2,
    Pencil,
    Menu,
    AlertTriangle,
    ShieldCheck,
    Mail,
    Eye,
    EyeOff,
    Copy,
    Key,
    Link as LinkIcon
} from 'lucide-react';
import { hashPassword } from '../utils/crypto';

interface DashboardProps {
  user: User;
  service: DropboxService;
  onLogout: () => void;
}

interface ColumnMapping {
    nr: string;
    title: string;
    composer: string;
    arranged: string;
}

type SortDirection = 'asc' | 'desc';
interface SortConfig {
    key: keyof MusicRecord;
    direction: SortDirection;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, service, onLogout }) => {
  // Permissions Helpers
  const isGroupAdmin = user.role === 'group_admin';
  const isAdmin = user.role === 'admin';
  
  const canManageFiles = isGroupAdmin;
  const canManageAssociations = isGroupAdmin;
  const canManageUsers = isGroupAdmin || isAdmin;
  const canManageDatabases = isGroupAdmin || isAdmin;
  // Restricted Google Accounts management strictly to group_admin
  const canManageCreds = isGroupAdmin;

  // Determine initial tab based on permissions
  const [activeTab, setActiveTab] = useState<'files' | 'users' | 'associations' | 'music' | 'google_creds' | 'welcome'>(() => {
      return 'music';
  });

  const [files, setFiles] = useState<DropboxFileEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [musicDatabases, setMusicDatabases] = useState<MusicDatabase[]>([]);
  const [googleCreds, setGoogleCreds] = useState<GoogleCredential[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingRecordIndex, setDeletingRecordIndex] = useState<number | null>(null);

  // Layout State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Search States
  const [musicLibSearch, setMusicLibSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Google Creds State
  const [showCredForm, setShowCredForm] = useState(false);
  const [newCred, setNewCred] = useState({ accountName: '', email: '', password: '', note: '' });
  const [visiblePassId, setVisiblePassId] = useState<string | null>(null);

  // Editor State
  const [editingFile, setEditingFile] = useState<{name: string, content: string, isNew: boolean} | null>(null);
  const [saving, setSaving] = useState(false);

  // User Management State
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [newUserAssocIds, setNewUserAssocIds] = useState<string[]>([]);
  const [addingUser, setAddingUser] = useState(false);

  // Edit User State
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editAssocIds, setEditAssocIds] = useState<string[]>([]);
  const [editRole, setEditRole] = useState<string>('user');
  const [updatingUser, setUpdatingUser] = useState(false);

  // Association Management State
  const [newAssociation, setNewAssociation] = useState({ name: '', description: '' });
  const [addingAssociation, setAddingAssociation] = useState(false);

  // --- MUSIC DATABASE STATE ---
  const [viewingDatabase, setViewingDatabase] = useState<MusicDatabase | null>(null);
  const [dbRecords, setDbRecords] = useState<MusicRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  
  // Add Record State
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [newRecordData, setNewRecordData] = useState<MusicRecord>({ nr: '', title: '', composer: '', arranged: '' });
  const [creatingRecord, setCreatingRecord] = useState(false);

  // Edit Record State
  const [editingRecord, setEditingRecord] = useState<{ record: MusicRecord, originalIndex: number } | null>(null);
  const [updatingRecord, setUpdatingRecord] = useState(false);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [importWorkbook, setImportWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [importConfig, setImportConfig] = useState<{
      name: string;
      associationId: string;
      mapping: ColumnMapping;
  }>({
      name: '',
      associationId: '',
      mapping: { nr: '', title: '', composer: '', arranged: '' }
  });

  useEffect(() => {
    loadRoles();
    loadAssociations(); 
    
    if (activeTab === 'files' && canManageFiles) {
        loadFiles();
        loadMusicDatabases(); 
    }
    if (activeTab === 'users' && canManageUsers) loadUsers();
    if (activeTab === 'music') loadMusicDatabases();
    if (activeTab === 'google_creds' && canManageCreds) loadGoogleCreds();
  }, [activeTab]);

  // --- DATA LOADING ---

  const loadRoles = async () => {
     try {
         const roleData = await service.downloadJson('/roles.json');
         if (roleData && Array.isArray(roleData.roles)) {
             setRoles(roleData.roles);
         }
     } catch (e) {
         console.error("Failed to load roles", e);
     }
  };

  const loadFiles = async () => {
    if (!canManageFiles) return;
    setRefreshing(true);
    try {
      const entries = await service.listFiles('');
      const jsonFiles = entries.filter((e: any) => e.name.endsWith('.json') && e['.tag'] === 'file');
      setFiles(jsonFiles);
    } catch (e) {
      console.error(e);
      alert('Failed to load files');
    } finally {
      setRefreshing(false);
    }
  };

  const loadUsers = async () => {
      if (!canManageUsers) return;
      try {
          const userData = await service.downloadJson('/users.json');
          if (userData && Array.isArray(userData.users)) {
              let allUsers = userData.users as User[];
              if (isAdmin && !isGroupAdmin) {
                  const myAssocIds = user.associationIds || [];
                  allUsers = allUsers.filter(u => {
                      if (u.username === user.username) return true;
                      if (u.role === 'group_admin') return false;
                      const targetAssocs = u.associationIds || [];
                      return targetAssocs.some(id => myAssocIds.includes(id));
                  });
              }
              setUsers(allUsers);
          }
      } catch (e) {
          console.error(e);
      }
  };

  const loadAssociations = async () => {
      try {
          const assocData = await service.downloadJson('/associations.json');
          if (assocData && Array.isArray(assocData.associations)) {
              setAssociations(assocData.associations);
          }
      } catch (e) {
          console.error("Failed to load associations", e);
      }
  };

  const loadMusicDatabases = async () => {
      setRefreshing(true);
      try {
          const dbData = await service.downloadJson('/databases.json');
          if (dbData && Array.isArray(dbData.databases)) {
              let dbs = dbData.databases as MusicDatabase[];
              if (!isGroupAdmin) {
                  const myAssocIds = user.associationIds || [];
                  dbs = dbs.filter(db => myAssocIds.includes(db.associationId));
              }
              setMusicDatabases(dbs);
          }
      } catch (e) {
          console.log("No databases registry found, or empty");
      } finally {
          setRefreshing(false);
      }
  };

  const loadGoogleCreds = async () => {
      if (!canManageCreds) return;
      setRefreshing(true);
      try {
          const credData = await service.downloadJson('/google_creds.json');
          if (credData && Array.isArray(credData.credentials)) {
              setGoogleCreds(credData.credentials);
          } else {
              setGoogleCreds([]);
          }
      } catch (e) {
          setGoogleCreds([]);
          console.log("No google credentials file found");
      } finally {
          setRefreshing(false);
      }
  };

  const handleNavClick = (tab: typeof activeTab) => {
      setActiveTab(tab);
      setMobileMenuOpen(false);
  };

  // --- GOOGLE CREDENTIALS LOGIC ---
  const handleAddGoogleCred = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCred.accountName || !newCred.email) return;
      setLoading(true);
      try {
          const updated = [...googleCreds, {
              ...newCred,
              id: Date.now().toString(),
              createdAt: new Date().toISOString()
          }];
          await service.uploadJson('/google_creds.json', { credentials: updated });
          setGoogleCreds(updated);
          setNewCred({ accountName: '', email: '', password: '', note: '' });
          setShowCredForm(false);
      } catch (e) {
          alert("Failed to save credentials");
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteGoogleCred = async (id: string) => {
      if (!window.confirm("Delete these credentials?")) return;
      setDeletingId(id);
      try {
          const updated = googleCreds.filter(c => c.id !== id);
          await service.uploadJson('/google_creds.json', { credentials: updated });
          setGoogleCreds(updated);
      } catch (e) {
          alert("Failed to delete credentials");
      } finally {
          setDeletingId(null);
      }
  };

  // --- MUSIC DATABASE LOGIC ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          if (workbook.SheetNames.length === 0) return;
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (jsonData.length === 0) return;
          const headers = jsonData[0] as string[];
          setExcelHeaders(headers);
          setImportWorkbook(workbook);
          setImportStep(2);
          const newMapping = { ...importConfig.mapping };
          headers.forEach(h => {
              const lower = String(h).toLowerCase();
              if (lower.includes('nr') || lower.includes('no.')) newMapping.nr = h;
              if (lower.includes('title') || lower.includes('name')) newMapping.title = h;
              if (lower.includes('composer')) newMapping.composer = h;
              if (lower.includes('arr') || lower.includes('by')) newMapping.arranged = h;
          });
          setImportConfig(prev => ({ ...prev, mapping: newMapping }));
      } catch (err) {
          alert("Failed to parse Excel file");
      }
  };

  const handleSaveImport = async () => {
      if (!importConfig.name || !importConfig.associationId || !importConfig.mapping.title || !importWorkbook) return;
      setLoading(true);
      try {
          let allRecords: MusicRecord[] = [];
          importWorkbook.SheetNames.forEach(sheetName => {
              const sheet = importWorkbook.Sheets[sheetName];
              const sheetData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
              if (sheetData.length > 1) {
                  const headers = sheetData[0] as string[];
                  const rows = sheetData.slice(1);
                  const sheetRecords = rows.map(row => {
                      const getValue = (targetHeaderName: string) => {
                          if (!targetHeaderName) return '';
                          const index = headers.indexOf(targetHeaderName);
                          return index !== -1 && row[index] ? String(row[index]) : '';
                      };
                      return {
                          nr: getValue(importConfig.mapping.nr),
                          title: getValue(importConfig.mapping.title),
                          composer: getValue(importConfig.mapping.composer),
                          arranged: getValue(importConfig.mapping.arranged)
                      };
                  }).filter(r => r.title);
                  allRecords = [...allRecords, ...sheetRecords];
              }
          });
          const fileId = `db_${Date.now()}`;
          const fileName = `/music_${fileId}.json`;
          await service.uploadJson(fileName, { records: allRecords });
          const newDbEntry: MusicDatabase = {
              id: fileId,
              name: importConfig.name,
              associationId: importConfig.associationId,
              fileName: fileName,
              createdAt: new Date().toISOString(),
              recordCount: allRecords.length
          };
          let currentRegistry: MusicDatabase[] = [];
          try {
              const regData = await service.downloadJson('/databases.json');
              if (regData && Array.isArray(regData.databases)) currentRegistry = regData.databases;
          } catch (e) {}
          await service.uploadJson('/databases.json', { databases: [...currentRegistry, newDbEntry] });
          setIsImporting(false);
          setImportStep(1);
          setImportWorkbook(null);
          setImportConfig({ name: '', associationId: '', mapping: { nr: '', title: '', composer: '', arranged: '' } });
          loadMusicDatabases();
      } catch (e) {
          alert("Failed to save database");
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteDatabase = async (db: MusicDatabase) => {
      if (!window.confirm(`Are you sure you want to delete "${db.name}"? This action will permanently remove the library entry and its associated JSON file from Dropbox.`)) return;
      setDeletingId(db.id);
      try {
          // 1. Delete the library json file first
          try {
            await service.deleteFile(db.fileName);
          } catch (e) {
            console.warn("Content file already missing or deletion failed", e);
          }
          
          // 2. Remove from registry
          const regData = await service.downloadJson('/databases.json');
          if (regData && Array.isArray(regData.databases)) {
               const updated = regData.databases.filter((d: MusicDatabase) => d.id !== db.id);
               await service.uploadJson('/databases.json', { databases: updated });
          }
          await loadMusicDatabases();
          if (canManageFiles) await loadFiles(); // Explicitly refresh files tab data
      } catch (e) {
          alert("Failed to delete database registry");
      } finally {
          setDeletingId(null);
      }
  };

  const handleOpenDatabase = async (db: MusicDatabase) => {
      setLoading(true);
      try {
          const content = await service.downloadJson(db.fileName);
          if (content && Array.isArray(content.records)) {
              setDbRecords(content.records);
              setViewingDatabase(db);
              setSearchTerm('');
              setSortConfig(null);
          } else {
              alert("Database file is empty or corrupted.");
          }
      } catch (e) {
          alert("Failed to load database content.");
      } finally {
          setLoading(false);
      }
  };

  const handleOpenAddRecordModal = () => {
      let maxNr = 0;
      if (dbRecords.length > 0) {
          dbRecords.forEach(r => {
              const val = parseInt(r.nr, 10);
              if (!isNaN(val) && val > maxNr) maxNr = val;
          });
      }
      setNewRecordData({ nr: (maxNr + 1).toString(), title: '', composer: '', arranged: '' });
      setIsAddingRecord(true);
  };

  const updateDatabaseRegistryCount = async (db: MusicDatabase, newCount: number) => {
    try {
        const updatedDbs = musicDatabases.map(d => d.id === db.id ? { ...d, recordCount: newCount } : d);
        setMusicDatabases(updatedDbs);
        await service.uploadJson('/databases.json', { databases: updatedDbs });
    } catch (e) {}
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!viewingDatabase) return;
      setCreatingRecord(true);
      try {
          const newRecords = [...dbRecords, newRecordData];
          await service.uploadJson(viewingDatabase.fileName, { records: newRecords });
          setDbRecords(newRecords);
          setIsAddingRecord(false);
          setNewRecordData({ nr: '', title: '', composer: '', arranged: '' });
          await updateDatabaseRegistryCount(viewingDatabase, newRecords.length);
      } catch (err) {
          alert("Failed to add new record.");
      } finally {
          setCreatingRecord(false);
      }
  };

  const handleDeleteRecord = async (index: number) => {
    if (!viewingDatabase) return;
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    setDeletingRecordIndex(index);
    try {
        const newRecords = [...dbRecords];
        newRecords.splice(index, 1);
        await service.uploadJson(viewingDatabase.fileName, { records: newRecords });
        setDbRecords(newRecords);
        await updateDatabaseRegistryCount(viewingDatabase, newRecords.length);
    } catch (e) {
        alert("Failed to delete record");
    } finally {
        setDeletingRecordIndex(null);
    }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!viewingDatabase || !editingRecord) return;
      setUpdatingRecord(true);
      try {
          const newRecords = [...dbRecords];
          newRecords[editingRecord.originalIndex] = editingRecord.record;
          await service.uploadJson(viewingDatabase.fileName, { records: newRecords });
          setDbRecords(newRecords);
          setEditingRecord(null);
      } catch (err) {
          alert("Failed to save record changes.");
      } finally {
          setUpdatingRecord(false);
      }
  };

  const handleSort = (key: keyof MusicRecord) => {
      setSortConfig(current => {
          if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
          return { key, direction: 'asc' };
      });
  };

  const handleExportDatabase = () => {
      if (!viewingDatabase || dbRecords.length === 0) return;
      try {
          const exportData = dbRecords.map(r => ({ 'Nr': r.nr, 'Title': r.title, 'Composer': r.composer, 'Arranged by': r.arranged }));
          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
          const safeName = viewingDatabase.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          XLSX.writeFile(wb, `${safeName}_export.xlsx`);
      } catch (e) {
          alert("Failed to export to Excel");
      }
  };

  // --- FILE ACTIONS ---
  const handleCreateFile = () => setEditingFile({ name: 'new_file.json', content: '{\n  "key": "value"\n}', isNew: true });
  const handleEditFile = async (file: DropboxFileEntry) => {
      setLoading(true);
      try {
          const content = await service.downloadJson(file.path_lower);
          setEditingFile({ name: file.name, content: JSON.stringify(content, null, 2), isNew: false });
      } catch (e) {
          alert("Could not download file content");
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteFile = async (path: string) => {
      if(!window.confirm("Are you sure you want to delete this file?")) return;
      try {
          await service.deleteFile(path);
          loadFiles();
      } catch (e) {
          alert("Failed to delete file");
      }
  };

  const handleSaveFile = async () => {
      if (!editingFile) return;
      setSaving(true);
      try {
          let parsed;
          try { parsed = JSON.parse(editingFile.content); } catch (e) { alert("Invalid JSON format"); setSaving(false); return; }
          let path = '/' + editingFile.name;
          if (!path.endsWith('.json')) path += '.json';
          await service.uploadJson(path, parsed);
          setEditingFile(null);
          loadFiles();
      } catch (e) {
          alert("Failed to save file");
      } finally {
          setSaving(false);
      }
  };

  // --- USER ACTIONS ---
  const getAvailableAssociations = () => {
      if (isGroupAdmin) return associations;
      if (isAdmin) {
          const myAssocIds = user.associationIds || [];
          return associations.filter(a => myAssocIds.includes(a.id));
      }
      return [];
  };

  const toggleUserAssociation = (assocId: string) => {
      setNewUserAssocIds(prev => prev.includes(assocId) ? prev.filter(id => id !== assocId) : [...prev, assocId]);
  };

  const toggleEditUserAssociation = (assocId: string) => {
    setEditAssocIds(prev => 
        prev.includes(assocId) 
            ? prev.filter(id => id !== assocId)
            : [...prev, assocId]
    );
  };

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUser.username || !newUser.password) return;
      setAddingUser(true);
      try {
          const userData = await service.downloadJson('/users.json');
          const currentUsers: User[] = userData?.users || [];
          if (currentUsers.find(u => u.username === newUser.username)) {
              alert("Username already exists");
              setAddingUser(false);
              return;
          }
          const hash = await hashPassword(newUser.password);
          
          // Auto-link associations if the creator is an association admin
          let finalAssocIds = newUserAssocIds;
          if (isAdmin && !isGroupAdmin) {
            finalAssocIds = user.associationIds || [];
          }
          
          const userObj: User = { 
            username: newUser.username, 
            passwordHash: hash, 
            role: newUser.role, 
            createdAt: new Date().toISOString(), 
            associationIds: finalAssocIds 
          };
          const updatedUsers = [...currentUsers, userObj];
          await service.uploadJson('/users.json', { users: updatedUsers });
          loadUsers();
          setNewUser({ username: '', password: '', role: 'user' });
          setNewUserAssocIds([]);
      } catch (e) {
          alert("Failed to add user");
      } finally {
          setAddingUser(false);
      }
  };

  const handleDeleteUser = async (username: string) => {
      if (username === user.username) {
          alert("Cannot delete yourself");
          return;
      }
      if (!window.confirm(`Delete user ${username}?`)) return;
      setDeletingId(username);
      try {
          const userData = await service.downloadJson('/users.json');
          const currentUsers: User[] = userData?.users || [];
          const updatedUsers = currentUsers.filter(u => u.username !== username);
          await service.uploadJson('/users.json', { users: updatedUsers });
          await loadUsers();
      } catch (e) {
          alert("Failed to delete user");
      } finally {
          setDeletingId(null);
      }
  };

  // Function to initialize the user edit state
  const handleEditUserClick = (u: User) => {
    setUserToEdit(u);
    setEditPassword('');
    setEditAssocIds(u.associationIds || []);
    setEditRole(u.role);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userToEdit) return;
      setUpdatingUser(true);
      try {
          const userData = await service.downloadJson('/users.json');
          const currentUsers: User[] = userData?.users || [];
          const updatedUsers = await Promise.all(currentUsers.map(async (u) => {
              if (u.username === userToEdit.username) {
                  let newPassHash = u.passwordHash;
                  if (editPassword.trim()) newPassHash = await hashPassword(editPassword.trim());
                  return { ...u, passwordHash: newPassHash, role: editRole, associationIds: editAssocIds };
              }
              return u;
          }));
          await service.uploadJson('/users.json', { users: updatedUsers });
          loadUsers();
          setUserToEdit(null);
      } catch (e) {
          alert("Failed to update user");
      } finally {
          setUpdatingUser(false);
      }
  };

  // --- ASSOCIATION ACTIONS ---
  const handleAddAssociation = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newAssociation.name) return;
      setAddingAssociation(true);
      try {
          const assocData = await service.downloadJson('/associations.json');
          const currentAssocs: Association[] = assocData?.associations || [];
          const newAssocObj: Association = { id: Date.now().toString(), name: newAssociation.name, description: newAssociation.description, createdAt: new Date().toISOString() };
          const updatedAssocs = [...currentAssocs, newAssocObj];
          await service.uploadJson('/associations.json', { associations: updatedAssocs });
          setAssociations(updatedAssocs);
          setNewAssociation({ name: '', description: '' });
      } catch (e) {
          alert("Failed to add association");
      } finally {
          setAddingAssociation(false);
      }
  };

  const handleDeleteAssociation = async (id: string) => {
      if (!window.confirm("Delete this association?")) return;
      setDeletingId(id);
      try {
          const assocData = await service.downloadJson('/associations.json');
          const currentAssocs: Association[] = assocData?.associations || [];
          const updatedAssocs = currentAssocs.filter(a => a.id !== id);
          await service.uploadJson('/associations.json', { associations: updatedAssocs });
          setAssociations(updatedAssocs);
      } catch (e) {
          alert("Failed to delete association");
      } finally {
          setDeletingId(null);
      }
  };

  // Render Helpers
  const renderEditUserModal = () => {
     if (!userToEdit) return null;
     const availableAssocs = getAvailableAssociations();
     return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-5 border w-full max-w-sm shadow-lg rounded-md bg-white">
                <div className="mt-3 text-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Edit User: {userToEdit.username}</h3>
                    <form className="mt-4 text-left space-y-4" onSubmit={handleUpdateUser}>
                        <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                           <select className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900" value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={!isGroupAdmin && userToEdit.role === 'group_admin'}>
                              {roles.filter(r => isGroupAdmin || r.id !== 'group_admin').map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
                           </select>
                        </div>
                        <Input label="New Password" type="password" placeholder="Leave blank to keep current" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
                        <div className="pt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Associations</label>
                            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                                {availableAssocs.map(assoc => (
                                    <div key={assoc.id} className="flex items-center">
                                        <input type="checkbox" id={`edit-user-assoc-${assoc.id}`} className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded" checked={editAssocIds.includes(assoc.id)} onChange={() => toggleEditUserAssociation(assoc.id)} />
                                        <label htmlFor={`edit-user-assoc-${assoc.id}`} className="ml-2 block text-sm text-gray-700 truncate cursor-pointer select-none">{assoc.name}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="secondary" className="flex-1" onClick={() => setUserToEdit(null)}>Cancel</Button>
                            <Button type="submit" className="flex-1" isLoading={updatingUser}>Save Changes</Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
     );
  };

  const renderAddRecordModal = () => {
    if (!isAddingRecord) return null;
    const existingNrRecord = dbRecords.find(r => r.nr === newRecordData.nr && newRecordData.nr !== '');
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 text-left">
          <div className="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
              <div className="mt-3">
                  <h3 className="text-lg leading-6 font-bold text-gray-900 mb-4 text-center">Add New Item</h3>
                  <form className="space-y-4" onSubmit={handleCreateRecord}>
                      <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-1"><Input label="Nr" value={newRecordData.nr} onChange={(e) => setNewRecordData({ ...newRecordData, nr: e.target.value })} /></div>
                          <div className="col-span-3"><Input label="Title" value={newRecordData.title} onChange={(e) => setNewRecordData({ ...newRecordData, title: e.target.value })} required /></div>
                          {existingNrRecord && (
                                <div className="col-span-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div className="text-sm text-amber-900 font-medium">Number "{existingNrRecord.nr}" already exists for "{existingNrRecord.title}"</div>
                                </div>
                          )}
                      </div>
                      <Input label="Composer" value={newRecordData.composer} onChange={(e) => setNewRecordData({ ...newRecordData, composer: e.target.value })} />
                      <Input label="Arranged by" value={newRecordData.arranged} onChange={(e) => setNewRecordData({ ...newRecordData, arranged: e.target.value })} />
                      <div className="flex gap-3 pt-4">
                          <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsAddingRecord(false)}>Cancel</Button>
                          <Button type="submit" className="flex-1" isLoading={creatingRecord} disabled={!!existingNrRecord}>Add Item</Button>
                      </div>
                  </form>
              </div>
          </div>
      </div>
    );
  };

  const renderEditRecordModal = () => {
    if (!editingRecord) return null;
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 text-left">
          <div className="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
              <div className="mt-3">
                  <h3 className="text-lg leading-6 font-bold text-gray-900 text-center mb-4">Edit Record</h3>
                  <form className="space-y-4" onSubmit={handleUpdateRecord}>
                      <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-1"><Input label="Nr" value={editingRecord.record.nr} onChange={(e) => setEditingRecord({ ...editingRecord, record: { ...editingRecord.record, nr: e.target.value } })} /></div>
                          <div className="col-span-3"><Input label="Title" value={editingRecord.record.title} onChange={(e) => setEditingRecord({ ...editingRecord, record: { ...editingRecord.record, title: e.target.value } })} required /></div>
                      </div>
                      <Input label="Composer" value={editingRecord.record.composer} onChange={(e) => setEditingRecord({ ...editingRecord, record: { ...editingRecord.record, composer: e.target.value } })} />
                      <Input label="Arranged by" value={editingRecord.record.arranged} onChange={(e) => setEditingRecord({ ...editingRecord, record: { ...editingRecord.record, arranged: e.target.value } })} />
                      <div className="flex gap-3 pt-4">
                          <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditingRecord(null)}>Cancel</Button>
                          <Button type="submit" className="flex-1" isLoading={updatingRecord}>Save Changes</Button>
                      </div>
                  </form>
              </div>
          </div>
      </div>
    );
  };

  if (viewingDatabase) {
      let displayedRecords = dbRecords.map((r, index) => ({ ...r, originalIndex: index }));
      displayedRecords = displayedRecords.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.composer.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.nr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.arranged.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (sortConfig) {
          displayedRecords.sort((a, b) => {
              const aVal = (a[sortConfig.key] || '').toString();
              const bVal = (b[sortConfig.key] || '').toString();
              return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal, undefined, { numeric: true }) : bVal.localeCompare(aVal, undefined, { numeric: true });
          });
      }
      return (
          <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
              {renderEditRecordModal()}
              {renderAddRecordModal()}
              <div className="bg-white border-b px-4 py-3 md:px-8 md:py-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm shrink-0 gap-3 z-10">
                  <div className="flex items-center gap-4">
                      <Button variant="secondary" onClick={() => setViewingDatabase(null)} className="flex items-center gap-2">
                          <ArrowLeft size={16} /> <span className="hidden md:inline">Back</span>
                      </Button>
                      <div>
                          <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate max-w-[200px] md:max-w-md">{viewingDatabase.name}</h2>
                          <p className="text-xs md:text-sm text-gray-500">{displayedRecords.length} records</p>
                      </div>
                  </div>
                  <div className="flex items-stretch md:items-center gap-3 flex-col md:flex-row">
                      <div className="relative w-full md:w-80">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
                          <input type="text" className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm text-gray-900" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus />
                          {searchTerm && (
                              <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors" title="Clear search"><X size={16} /></button>
                          )}
                      </div>
                      <div className="flex items-center gap-2">
                         <Button onClick={handleOpenAddRecordModal} className="flex items-center justify-center gap-2"><Plus size={16} /> Add Item</Button>
                         <Button variant="secondary" onClick={handleExportDatabase} className="flex items-center justify-center gap-2"><Download size={16} /> Export</Button>
                      </div>
                  </div>
              </div>
              <div className="flex-1 p-4 md:p-8 overflow-auto">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('nr')}>Nr</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('title')}>Title</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('composer')}>Composer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('arranged')}>Arranged</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayedRecords.map((r) => (
                                    <tr key={r.originalIndex} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{r.nr}</td>
                                        <td className="px-6 py-3 text-sm text-gray-900 font-semibold">{r.title}</td>
                                        <td className="px-6 py-3 text-sm text-gray-500">{r.composer}</td>
                                        <td className="px-6 py-3 text-sm text-gray-500">{r.arranged}</td>
                                        <td className="px-6 py-3 text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button onClick={() => setEditingRecord({ record: r, originalIndex: r.originalIndex })} className="text-brand-600 hover:text-brand-900 p-1 rounded hover:bg-brand-50"><Pencil size={16} /></button>
                                                <button onClick={() => handleDeleteRecord(r.originalIndex)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50">{deletingRecordIndex === r.originalIndex ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {displayedRecords.length === 0 && (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No records found matching your search.</td></tr>
                                )}
                            </tbody>
                        </table>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  const renderImportModal = () => {
      if (!isImporting) return null;
      const availableAssocs = getAvailableAssociations();
      return (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
              <div className="relative mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-xl bg-white max-h-[90vh] overflow-y-auto text-left">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-900">Import Music Database</h3><button onClick={() => setIsImporting(false)} className="text-gray-400 hover:text-gray-600"><X /></button></div>
                  {importStep === 1 ? (
                      <div className="space-y-6 text-center py-8">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 hover:bg-gray-50 transition-colors">
                              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                              <p className="text-sm text-gray-600 mb-4">Select an Excel file (.xls, .xlsx) to import</p>
                              <input type="file" accept=".xls,.xlsx" onChange={handleFileSelect} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-brand-50 file:text-brand-700 mx-auto max-w-xs" />
                          </div>
                      </div>
                  ) : (
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Input label="Database Name" value={importConfig.name} onChange={e => setImportConfig({...importConfig, name: e.target.value})} />
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Association</label>
                                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white" value={importConfig.associationId} onChange={e => setImportConfig({...importConfig, associationId: e.target.value})}>
                                      <option value="">Select Association...</option>
                                      {availableAssocs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </select>
                              </div>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <h4 className="text-sm font-semibold mb-3 text-gray-700">Map Excel Columns</h4>
                              <div className="grid grid-cols-2 gap-4">
                                  {['nr', 'title', 'composer', 'arranged'].map(field => (
                                      <div key={field}>
                                          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{field}</label>
                                          <select className="w-full text-sm border-gray-300 rounded-md text-gray-900 bg-white" value={(importConfig.mapping as any)[field]} onChange={(e) => setImportConfig({ ...importConfig, mapping: { ...importConfig.mapping, [field]: e.target.value } })}>
                                              <option value="">(Skip)</option>
                                              {excelHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                          </select>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div className="flex justify-between items-center pt-2"><button onClick={() => setImportStep(1)} className="text-sm text-gray-500 hover:text-gray-800">Back</button><Button onClick={handleSaveImport} isLoading={loading}>Create Database</Button></div>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {renderEditUserModal()}
      {renderImportModal()}
      {editingFile && (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
                <Input value={editingFile.name} onChange={(e) => setEditingFile({...editingFile, name: e.target.value})} disabled={!editingFile.isNew} className="font-mono text-lg font-bold min-w-[300px]" />
                <div className="flex items-center gap-2"><Button variant="secondary" onClick={() => setEditingFile(null)}>Cancel</Button><Button onClick={handleSaveFile} isLoading={saving} className="flex items-center gap-2"><Save size={16} /> Save JSON</Button></div>
            </div>
            <div className="flex-1 p-6 overflow-hidden"><textarea className="w-full h-full p-4 font-mono text-sm bg-white border rounded-lg shadow-inner resize-none focus:outline-none text-gray-900" value={editingFile.content} onChange={(e) => setEditingFile({...editingFile, content: e.target.value})} spellCheck={false} /></div>
        </div>
      )}
      
      {mobileMenuOpen && <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-20 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 md:translate-x-0 md:static ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100"><h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><div className="bg-brand-600 rounded p-1"><Folder className="text-white w-4 h-4"/></div>DropBase</h1><p className="text-xs text-gray-400 mt-1">v2.8.1</p></div>
        <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => handleNavClick('music')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'music' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><Music size={18} />Music Libraries</button>
            {canManageCreds && <button onClick={() => handleNavClick('google_creds')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'google_creds' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><ShieldCheck size={18} />Google Accounts</button>}
            {canManageFiles && <button onClick={() => handleNavClick('files')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'files' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><FileJson size={18} />My JSON Files</button>}
            {canManageUsers && <button onClick={() => handleNavClick('users')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'users' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><Users size={18} />User Database</button>}
            {canManageAssociations && <button onClick={() => handleNavClick('associations')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'associations' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><Building size={18} />Associations</button>}
        </nav>
        <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">{user.username.substring(0,2).toUpperCase()}</div>
                <div className="flex-1 overflow-hidden text-left"><p className="text-sm font-medium text-gray-900 truncate">{user.username}</p><p className="text-xs text-gray-500 capitalize">{roles.find(r => r.id === user.role)?.name || user.role}</p></div>
            </div>
            <Button variant="secondary" className="w-full justify-start gap-2 text-gray-700" onClick={onLogout}><LogOut size={16} /> Sign Out</Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2 font-bold text-gray-800"><div className="bg-brand-600 rounded p-1"><Folder className="text-white w-4 h-4"/></div>DropBase</div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-600 rounded-md hover:bg-gray-100"><Menu /></button>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-8">
            {activeTab === 'music' && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
                        <div><h2 className="text-2xl font-bold text-gray-900">Music Libraries</h2><p className="text-gray-500">Access and manage sheet music databases.</p></div>
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative w-full md:w-64">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                                <input type="text" className="block w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-1 focus:ring-brand-500 text-gray-900" placeholder="Search libraries..." value={musicLibSearch} onChange={(e) => setMusicLibSearch(e.target.value)} />
                                {musicLibSearch && (
                                    <button onClick={() => setMusicLibSearch('')} className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600" title="Clear search"><X size={14} /></button>
                                )}
                            </div>
                            <div className="flex gap-2"><Button variant="secondary" onClick={loadMusicDatabases} disabled={refreshing} className="text-gray-700"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></Button>{canManageDatabases && <Button onClick={() => setIsImporting(true)} className="flex items-center gap-2"><Plus size={16} /> Import Excel</Button>}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                        {musicDatabases
                            .filter(db => db.name.toLowerCase().includes(musicLibSearch.toLowerCase()))
                            .map(db => (
                                <div key={db.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
                                    <div className="flex items-start justify-between mb-4"><div className="p-3 rounded-lg bg-indigo-50 text-indigo-600"><Database size={24} /></div>{canManageDatabases && <button onClick={() => handleDeleteDatabase(db)} className="text-gray-400 hover:text-red-500 disabled:opacity-50">{deletingId === db.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}</button>}</div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{db.name}</h3>
                                    <p className="text-sm text-gray-500 mb-4">{associations.find(a => a.id === db.associationId)?.name || 'Unknown Association'}</p>
                                    <div className="mt-auto flex items-center justify-between"><span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{db.recordCount} Records</span><button onClick={() => handleOpenDatabase(db)} className="text-sm font-medium text-brand-600 hover:text-brand-800 flex items-center gap-1">Open <ArrowRight size={14} /></button></div>
                                </div>
                        ))}
                        {musicDatabases.length === 0 && !refreshing && (
                            <div className="col-span-full py-12 text-center text-gray-500">No databases found. Link an Excel file to get started.</div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'google_creds' && (
                canManageCreds ? (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
                        <div><h2 className="text-2xl font-bold text-gray-900">Google Accounts</h2><p className="text-gray-500">Secure storage for Google login credentials.</p></div>
                        <div className="flex gap-2"><Button variant="secondary" onClick={loadGoogleCreds} disabled={refreshing} className="text-gray-700"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></Button><Button onClick={() => setShowCredForm(true)} className="flex items-center gap-2"><Plus size={16} /> Add Account</Button></div>
                    </div>

                    {showCredForm && (
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8 animate-in slide-in-from-top-4 text-left">
                            <h3 className="text-lg font-bold mb-4 text-gray-900">Store New Google Credentials</h3>
                            <form onSubmit={handleAddGoogleCred} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Account Label" placeholder="Work, Personal, etc." value={newCred.accountName} onChange={e => setNewCred({...newCred, accountName: e.target.value})} required />
                                <Input label="Email Address" type="email" placeholder="example@gmail.com" value={newCred.email} onChange={e => setNewCred({...newCred, email: e.target.value})} required />
                                <Input label="Password/Token" type="password" value={newCred.password} onChange={e => setNewCred({...newCred, password: e.target.value})} />
                                <Input label="Notes" placeholder="Optional notes" value={newCred.note} onChange={e => setNewCred({...newCred, note: e.target.value})} />
                                <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                                    <Button variant="secondary" onClick={() => setShowCredForm(false)} className="text-gray-700">Cancel</Button>
                                    <Button type="submit" isLoading={loading}>Save Credentials</Button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Password</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {googleCreds.map(cred => (
                                    <tr key={cred.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-red-50 p-2 rounded text-red-600"><ShieldCheck size={18} /></div>
                                                <div className="font-medium text-gray-900">{cred.accountName}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Mail size={14} className="text-gray-400" /> {cred.email}
                                                <button onClick={() => navigator.clipboard.writeText(cred.email)} className="p-1 hover:bg-gray-100 rounded text-gray-400" title="Copy Email"><Copy size={12} /></button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 font-mono text-sm text-gray-900">
                                                {visiblePassId === cred.id ? cred.password : '••••••••'}
                                                <button onClick={() => setVisiblePassId(visiblePassId === cred.id ? null : cred.id)} className="p-1 hover:bg-gray-100 rounded text-gray-400">{visiblePassId === cred.id ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleDeleteGoogleCred(cred.id)} className="text-gray-400 hover:text-red-600 p-2">{deletingId === cred.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}</button>
                                        </td>
                                    </tr>
                                ))}
                                {googleCreds.length === 0 && (
                                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No credentials stored. Click "Add Account" to start.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-gray-500">
                        <Shield className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="text-lg font-bold">Access Restricted</h3>
                        <p>Only Group Admins can manage Google accounts.</p>
                    </div>
                )
            )}

            {activeTab === 'users' && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
                        <h2 className="text-2xl font-bold text-gray-900">User Database</h2>
                        <div className="relative w-full md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                            <input type="text" className="block w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-1 focus:ring-brand-500 text-gray-900" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                            {userSearch && (
                                <button onClick={() => setUserSearch('')} className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600" title="Clear search"><X size={14} /></button>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
                        <div className="lg:col-span-1">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-bold mb-4 text-gray-900">Add User</h3>
                                <form onSubmit={handleAddUser} className="space-y-4">
                                    <Input label="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required />
                                    <Input label="Password" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
                                    <div>
                                        <label className="text-sm font-medium mb-1 block text-gray-700">Role</label>
                                        <select className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                            {roles.filter(r => isGroupAdmin || r.id !== 'group_admin').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                    </div>
                                    
                                    {isGroupAdmin ? (
                                        <div>
                                            <label className="text-sm font-medium mb-1 block text-gray-700">Associations</label>
                                            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
                                                {associations.map(a => (
                                                    <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-brand-600 text-gray-700">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                                            checked={newUserAssocIds.includes(a.id)} 
                                                            onChange={() => toggleUserAssociation(a.id)} 
                                                        />
                                                        {a.name}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ) : isAdmin && (
                                        <div className="bg-brand-50 border border-brand-100 p-3 rounded-lg flex gap-2">
                                            <LinkIcon size={14} className="text-brand-600 shrink-0 mt-0.5" />
                                            <p className="text-xs text-brand-800 leading-relaxed font-medium">User will be auto-linked to your association(s).</p>
                                        </div>
                                    )}

                                    <Button type="submit" className="w-full" isLoading={addingUser}>Create User</Button>
                                </form>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                             <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Associations</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {users
                                            .filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()))
                                            .map(u => (
                                            <tr key={u.username} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">{u.username}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{u.role}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {u.associationIds?.map(id => {
                                                            const assoc = associations.find(a => a.id === id);
                                                            return assoc ? (
                                                                <span key={id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                                    {assoc.name}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                        {(!u.associationIds || u.associationIds.length === 0) && (
                                                            <span className="text-xs text-gray-400 italic">None</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => handleEditUserClick(u)} className="text-brand-600 hover:text-brand-900 mr-3 text-sm font-medium transition-colors">Edit</button>
                                                    {u.username !== user.username ? (
                                                        <button onClick={() => handleDeleteUser(u.username)} className="text-red-600 hover:text-red-900 px-2 text-sm font-medium transition-colors">Delete</button>
                                                    ) : (
                                                        <span className="text-gray-400 px-2 text-sm font-medium italic cursor-default" title="You cannot delete yourself">Self</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {users.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                                            <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No users found matching "{userSearch}"</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
            
            {activeTab === 'files' && canManageFiles && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
                        <div><h2 className="text-2xl font-bold text-gray-900">Files</h2><p className="text-gray-500">Manage your JSON documents.</p></div>
                        <div className="flex gap-2"><Button variant="secondary" onClick={loadFiles} disabled={refreshing} className="text-gray-700"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></Button><Button onClick={handleCreateFile} className="flex items-center gap-2"><Plus size={16} /> New JSON</Button></div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Linked Library</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {files.map(f => {
                                    // Search registry for matching library
                                    const linkedLib = musicDatabases.find(db => db.fileName.toLowerCase() === f.path_lower.toLowerCase());
                                    return (
                                        <tr key={f.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 font-medium text-brand-600 cursor-pointer" onClick={() => handleEditFile(f)}>
                                                    <FileJson size={14} className="text-gray-400" />
                                                    {f.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {linkedLib ? (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
                                                        <LinkIcon size={12} />
                                                        {linkedLib.name}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Not linked</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleEditFile(f)} className="text-brand-600 mr-4 hover:underline">Edit</button>
                                                <button onClick={() => handleDeleteFile(f.path_lower)} className="text-red-600 hover:underline">Delete</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {files.length === 0 && !refreshing && (
                                    <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-500">No JSON files found in Dropbox.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {activeTab === 'associations' && canManageAssociations && (
                <>
                    <h2 className="text-2xl font-bold mb-8 text-gray-900 text-left">Associations</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
                        <div className="lg:col-span-1">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-left">
                                <h3 className="text-lg font-bold mb-4 text-gray-900">Add Association</h3>
                                <form onSubmit={handleAddAssociation} className="space-y-4">
                                    <Input label="Name" value={newAssociation.name} onChange={e => setNewAssociation({...newAssociation, name: e.target.value})} required />
                                    <Input label="Description" value={newAssociation.description} onChange={e => setNewAssociation({...newAssociation, description: e.target.value})} />
                                    <Button type="submit" className="w-full" isLoading={addingAssociation}>Create Association</Button>
                                </form>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                             <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {associations.map(a => (
                                            <tr key={a.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-medium text-gray-900">{a.name}</td><td className="px-6 py-4 text-right"><button onClick={() => handleDeleteAssociation(a.id)} className="text-red-600 hover:underline">Delete</button></td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </main>
      </div>
    </div>
  );
};