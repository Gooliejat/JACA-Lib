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
    Link as LinkIcon,
    UserCircle,
    MoreVertical
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
  const canManageCreds = isGroupAdmin;

  const [activeTab, setActiveTab] = useState<'files' | 'users' | 'associations' | 'music' | 'google_creds' | 'welcome'>(() => 'music');

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [musicLibSearch, setMusicLibSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const [showCredForm, setShowCredForm] = useState(false);
  const [newCred, setNewCred] = useState({ accountName: '', email: '', password: '', note: '' });
  const [visiblePassId, setVisiblePassId] = useState<string | null>(null);

  const [editingFile, setEditingFile] = useState<{name: string, content: string, isNew: boolean} | null>(null);
  const [saving, setSaving] = useState(false);

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [newUserAssocIds, setNewUserAssocIds] = useState<string[]>([]);
  const [addingUser, setAddingUser] = useState(false);

  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editAssocIds, setEditAssocIds] = useState<string[]>([]);
  const [editRole, setEditRole] = useState<string>('user');
  const [updatingUser, setUpdatingUser] = useState(false);

  const [newAssociation, setNewAssociation] = useState({ name: '', description: '' });
  const [addingAssociation, setAddingAssociation] = useState(false);

  const [viewingDatabase, setViewingDatabase] = useState<MusicDatabase | null>(null);
  const [dbRecords, setDbRecords] = useState<MusicRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [newRecordData, setNewRecordData] = useState<MusicRecord>({ nr: '', title: '', composer: '', arranged: '' });
  const [creatingRecord, setCreatingRecord] = useState(false);

  const [editingRecord, setEditingRecord] = useState<{ record: MusicRecord, originalIndex: number } | null>(null);
  const [updatingRecord, setUpdatingRecord] = useState(false);

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
    if (activeTab === 'associations' && canManageAssociations) loadAssociations();
  }, [activeTab]);

  const loadRoles = async () => {
     try {
         const roleData = await service.downloadJson('/roles.json');
         if (roleData && Array.isArray(roleData.roles)) {
             setRoles(roleData.roles);
         }
     } catch (e) { console.error("Failed to load roles", e); }
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
    } finally { setRefreshing(false); }
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
      } catch (e) { console.error(e); }
  };

  const loadAssociations = async () => {
      try {
          const assocData = await service.downloadJson('/associations.json');
          if (assocData && Array.isArray(assocData.associations)) {
              setAssociations(assocData.associations);
          }
      } catch (e) { console.error("Failed to load associations", e); }
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
      } catch (e) { console.log("No databases registry found, or empty"); } finally { setRefreshing(false); }
  };

  const loadGoogleCreds = async () => {
      if (!canManageCreds) return;
      setRefreshing(true);
      try {
          const credData = await service.downloadJson('/google_creds.json');
          if (credData && Array.isArray(credData.credentials)) {
              setGoogleCreds(credData.credentials);
          } else { setGoogleCreds([]); }
      } catch (e) { setGoogleCreds([]); console.log("No google credentials file found"); } finally { setRefreshing(false); }
  };

  const handleNavClick = (tab: typeof activeTab) => {
      setActiveTab(tab);
      setMobileMenuOpen(false);
  };

  const handleAddGoogleCred = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCred.accountName || !newCred.email) return;
      setLoading(true);
      try {
          const updated = [...googleCreds, { ...newCred, id: Date.now().toString(), createdAt: new Date().toISOString() }];
          await service.uploadJson('/google_creds.json', { credentials: updated });
          setGoogleCreds(updated);
          setNewCred({ accountName: '', email: '', password: '', note: '' });
          setShowCredForm(false);
      } catch (e) { alert("Failed to save credentials"); } finally { setLoading(false); }
  };

  const handleDeleteGoogleCred = async (id: string) => {
      if (!window.confirm("Delete these credentials?")) return;
      setDeletingId(id);
      try {
          const updated = googleCreds.filter(c => c.id !== id);
          await service.uploadJson('/google_creds.json', { credentials: updated });
          setGoogleCreds(updated);
      } catch (e) { alert("Failed to delete credentials"); } finally { setDeletingId(null); }
  };

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
      } catch (err) { alert("Failed to parse Excel file"); }
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
          setIsImporting(false); setImportStep(1); setImportWorkbook(null);
          setImportConfig({ name: '', associationId: '', mapping: { nr: '', title: '', composer: '', arranged: '' } });
          loadMusicDatabases();
      } catch (e) { alert("Failed to save database"); } finally { setLoading(false); }
  };

  const handleDeleteDatabase = async (db: MusicDatabase) => {
      if (!window.confirm(`Are you sure you want to delete "${db.name}"?`)) return;
      setDeletingId(db.id);
      try {
          try { await service.deleteFile(db.fileName); } catch (e) { console.warn("Deletion failed", e); }
          const regData = await service.downloadJson('/databases.json');
          if (regData && Array.isArray(regData.databases)) {
               const updated = regData.databases.filter((d: MusicDatabase) => d.id !== db.id);
               await service.uploadJson('/databases.json', { databases: updated });
          }
          await loadMusicDatabases();
          if (canManageFiles) await loadFiles();
      } catch (e) { alert("Failed to delete database registry"); } finally { setDeletingId(null); }
  };

  const handleOpenDatabase = async (db: MusicDatabase) => {
      setLoading(true);
      try {
          const content = await service.downloadJson(db.fileName);
          if (content && Array.isArray(content.records)) {
              setDbRecords(content.records);
              setViewingDatabase(db);
              setSearchTerm(''); setSortConfig(null);
          } else { alert("Database file is empty or corrupted."); }
      } catch (e) { alert("Failed to load database content."); } finally { setLoading(false); }
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
          setDbRecords(newRecords); setIsAddingRecord(false);
          setNewRecordData({ nr: '', title: '', composer: '', arranged: '' });
          await updateDatabaseRegistryCount(viewingDatabase, newRecords.length);
      } catch (err) { alert("Failed to add new record."); } finally { setCreatingRecord(false); }
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
    } catch (e) { alert("Failed to delete record"); } finally { setDeletingRecordIndex(null); }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!viewingDatabase || !editingRecord) return;
      setUpdatingRecord(true);
      try {
          const newRecords = [...dbRecords];
          newRecords[editingRecord.originalIndex] = editingRecord.record;
          await service.uploadJson(viewingDatabase.fileName, { records: newRecords });
          setDbRecords(newRecords); setEditingRecord(null);
      } catch (err) { alert("Failed to save record changes."); } finally { setUpdatingRecord(false); }
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
      } catch (e) { alert("Failed to export to Excel"); }
  };

  const handleCreateFile = () => setEditingFile({ name: 'new_file.json', content: '{\n  "key": "value"\n}', isNew: true });
  const handleEditFile = async (file: DropboxFileEntry) => {
      setLoading(true);
      try {
          const content = await service.downloadJson(file.path_lower);
          setEditingFile({ name: file.name, content: JSON.stringify(content, null, 2), isNew: false });
      } catch (e) { alert("Could not download file content"); } finally { setLoading(false); }
  };

  const handleDeleteFile = async (path: string) => {
      if(!window.confirm("Are you sure you want to delete this file?")) return;
      try { await service.deleteFile(path); loadFiles(); } catch (e) { alert("Failed to delete file"); }
  };

  const handleSaveFile = async () => {
      if (!editingFile) return;
      setSaving(true);
      try {
          let parsed;
          try { parsed = JSON.parse(editingFile.content); } catch (e) { alert("Invalid JSON format"); setSaving(false); return; }
          let path = '/' + editingFile.name; if (!path.endsWith('.json')) path += '.json';
          await service.uploadJson(path, parsed);
          setEditingFile(null); loadFiles();
      } catch (e) { alert("Failed to save file"); } finally { setSaving(false); }
  };

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
    setEditAssocIds(prev => prev.includes(assocId) ? prev.filter(id => id !== assocId) : [...prev, assocId]);
  };

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUser.username || !newUser.password) return;
      setAddingUser(true);
      try {
          const userData = await service.downloadJson('/users.json');
          const currentUsers: User[] = userData?.users || [];
          if (currentUsers.find(u => u.username === newUser.username)) {
              alert("Username already exists"); setAddingUser(false); return;
          }
          const hash = await hashPassword(newUser.password);
          let finalAssocIds = newUserAssocIds; if (isAdmin && !isGroupAdmin) finalAssocIds = user.associationIds || [];
          const userObj: User = { username: newUser.username, passwordHash: hash, role: newUser.role, createdAt: new Date().toISOString(), associationIds: finalAssocIds };
          const updatedUsers = [...currentUsers, userObj];
          await service.uploadJson('/users.json', { users: updatedUsers });
          loadUsers(); setNewUser({ username: '', password: '', role: 'user' }); setNewUserAssocIds([]);
      } catch (e) { alert("Failed to add user"); } finally { setAddingUser(false); }
  };

  const handleDeleteUser = async (username: string) => {
      if (username === user.username) { alert("Cannot delete yourself"); return; }
      if (!window.confirm(`Delete user ${username}?`)) return;
      setDeletingId(username);
      try {
          const userData = await service.downloadJson('/users.json');
          const currentUsers: User[] = userData?.users || [];
          const updatedUsers = currentUsers.filter(u => u.username !== username);
          await service.uploadJson('/users.json', { users: updatedUsers });
          await loadUsers();
      } catch (e) { alert("Failed to delete user"); } finally { setDeletingId(null); }
  };

  const handleEditUserClick = (u: User) => {
    setUserToEdit(u); setEditPassword(''); setEditAssocIds(u.associationIds || []); setEditRole(u.role);
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
          loadUsers(); setUserToEdit(null);
      } catch (e) { alert("Failed to update user"); } finally { setUpdatingUser(false); }
  };

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
          setAssociations(updatedAssocs); setNewAssociation({ name: '', description: '' });
      } catch (e) { alert("Failed to add association"); } finally { setAddingAssociation(false); }
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
      } catch (e) { alert("Failed to delete association"); } finally { setDeletingId(null); }
  };

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
                           <select className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 bg-white" value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={!isGroupAdmin && userToEdit.role === 'group_admin'}>
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
    const duplicateRecord = dbRecords.find(r => 
        r.title.trim().toLowerCase() === newRecordData.title.trim().toLowerCase() && 
        r.composer.trim().toLowerCase() === newRecordData.composer.trim().toLowerCase() &&
        r.arranged.trim().toLowerCase() === newRecordData.arranged.trim().toLowerCase()
    );

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 text-left">
          <div className="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
              <div className="mt-3">
                  <h3 className="text-lg leading-6 font-bold text-gray-900 mb-4 text-center">Add New Item</h3>
                  <form className="space-y-4" onSubmit={handleCreateRecord}>
                      <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-1"><Input label="Nr" value={newRecordData.nr} onChange={(e) => setNewRecordData({ ...newRecordData, nr: e.target.value })} /></div>
                          <div className="col-span-3"><Input label="Title" value={newRecordData.title} onChange={(e) => setNewRecordData({ ...newRecordData, title: e.target.value })} required /></div>
                      </div>
                      
                      {existingNrRecord && (
                           <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                               <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                               <div className="text-sm text-amber-900 font-medium">Number "{existingNrRecord.nr}" already exists for "{existingNrRecord.title}"</div>
                           </div>
                      )}

                      {duplicateRecord && (
                           <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                               <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                               <div className="text-sm text-amber-900 font-medium">Warning: A record with this Title, Composer, and Arranger already exists (Nr {duplicateRecord.nr}).</div>
                           </div>
                      )}

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
    const existingNrRecord = dbRecords.find((r, idx) => 
        r.nr === editingRecord.record.nr && 
        idx !== editingRecord.originalIndex && 
        editingRecord.record.nr !== ''
    );

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

                      {existingNrRecord && (
                           <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                               <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                               <div className="text-sm text-amber-900 font-medium">Number "{existingNrRecord.nr}" is already used by "{existingNrRecord.title}".</div>
                           </div>
                      )}

                      <Input label="Composer" value={editingRecord.record.composer} onChange={(e) => setEditingRecord({ ...editingRecord, record: { ...editingRecord.record, composer: e.target.value } })} />
                      <Input label="Arranged by" value={editingRecord.record.arranged} onChange={(e) => setEditingRecord({ ...editingRecord, record: { ...editingRecord.record, arranged: e.target.value } })} />
                      <div className="flex gap-3 pt-4">
                          <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditingRecord(null)}>Cancel</Button>
                          <Button type="submit" className="flex-1" isLoading={updatingRecord} disabled={!!existingNrRecord}>Save Changes</Button>
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
                  <div className="flex items-center gap-4 text-left">
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
                          <input type="text" className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm text-gray-900" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                          {searchTerm && (
                              <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
                          )}
                      </div>
                      <div className="flex items-center gap-2">
                         <Button onClick={handleOpenAddRecordModal} className="flex-1 md:flex-none flex items-center justify-center gap-2"><Plus size={16} /> Add Item</Button>
                         <Button variant="secondary" onClick={handleExportDatabase} className="flex-1 md:flex-none flex items-center justify-center gap-2 text-gray-700 font-bold font-bold"><Download size={16} /> Export</Button>
                      </div>
                  </div>
              </div>
              <div className="flex-1 p-4 md:p-8 overflow-auto">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden text-left">
                      <div className="hidden md:block overflow-x-auto">
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
                                    <tr key={r.originalIndex} className="hover:bg-gray-50 transition-colors">
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
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No records found.</td></tr>
                                )}
                            </tbody>
                        </table>
                      </div>

                      <div className="md:hidden divide-y divide-gray-100">
                          {/* MOBILE SORT CONTROLS */}
                          <div className="p-3 bg-gray-50/80 border-b flex items-center justify-between backdrop-blur-sm sticky top-0 z-10">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Sort Results By</span>
                              <div className="flex gap-1.5">
                                  <button 
                                      onClick={() => handleSort('nr')} 
                                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex items-center gap-1 ${sortConfig?.key === 'nr' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 active:bg-gray-100'}`}
                                  >
                                      Nr {sortConfig?.key === 'nr' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                                  </button>
                                  <button 
                                      onClick={() => handleSort('title')} 
                                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex items-center gap-1 ${sortConfig?.key === 'title' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 active:bg-gray-100'}`}
                                  >
                                      Title {sortConfig?.key === 'title' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                                  </button>
                              </div>
                          </div>

                          {displayedRecords.map((r) => (
                              <div key={r.originalIndex} className="p-4 bg-white active:bg-gray-50 transition-colors">
                                  <div className="flex justify-between items-start">
                                      <div className="flex-1 min-w-0 pr-4">
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded bg-gray-100 text-xs font-bold text-gray-600 border border-gray-200 uppercase tracking-tighter shrink-0">{r.nr}</span>
                                              <h4 className="font-bold text-gray-900 text-base leading-tight truncate">{r.title}</h4>
                                          </div>
                                          <div className="space-y-1 ml-[36px]">
                                              {r.composer && <p className="text-sm text-gray-600 font-medium truncate italic">{r.composer}</p>}
                                              {r.arranged && <p className="text-xs text-gray-500 truncate">Arranged: {r.arranged}</p>}
                                          </div>
                                      </div>
                                      <div className="flex flex-col gap-2 shrink-0">
                                          <Button size="sm" variant="secondary" className="px-3 py-2 text-brand-600" onClick={() => setEditingRecord({ record: r, originalIndex: r.originalIndex })}>
                                              <Pencil size={16} />
                                          </Button>
                                          <Button size="sm" variant="secondary" className="px-3 py-2 text-red-600" onClick={() => handleDeleteRecord(r.originalIndex)}>
                                              {deletingRecordIndex === r.originalIndex ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 size={16} />}
                                          </Button>
                                      </div>
                                  </div>
                              </div>
                          ))}
                          {displayedRecords.length === 0 && (
                                <div className="p-12 text-center text-gray-500 text-sm">No items found.</div>
                          )}
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
                          <div className="flex justify-between items-center pt-2"><button onClick={() => setImportStep(1)} className="text-sm text-gray-500 hover:text-gray-800 font-bold">Back</button><Button onClick={handleSaveImport} isLoading={loading}>Create Database</Button></div>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {renderEditUserModal()}
      {renderImportModal()}
      {editingFile && (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
                <Input value={editingFile.name} onChange={(e) => setEditingFile({...editingFile, name: e.target.value})} disabled={!editingFile.isNew} className="font-mono text-lg font-bold min-w-[300px]" />
                <div className="flex items-center gap-2"><Button variant="secondary" onClick={() => setEditingFile(null)} className="text-gray-700 font-bold">Cancel</Button><Button onClick={handleSaveFile} isLoading={saving} className="flex items-center gap-2 font-bold"><Save size={16} /> Save JSON</Button></div>
            </div>
            <div className="flex-1 p-6 overflow-hidden"><textarea className="w-full h-full p-4 font-mono text-sm bg-white border rounded-lg shadow-inner resize-none focus:outline-none text-gray-900" value={editingFile.content} onChange={(e) => setEditingFile({...editingFile, content: e.target.value})} spellCheck={false} /></div>
        </div>
      )}
      
      {mobileMenuOpen && <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-20 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 md:translate-x-0 md:static ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100"><h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><div className="bg-brand-600 rounded p-1"><Folder className="text-white w-4 h-4"/></div>DropBase</h1><p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">Sync Gateway</p></div>
        <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => handleNavClick('music')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors text-left ${activeTab === 'music' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><Music size={18} />Music Libraries</button>
            {canManageCreds && <button onClick={() => handleNavClick('google_creds')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors text-left ${activeTab === 'google_creds' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><ShieldCheck size={18} />Google Accounts</button>}
            {canManageFiles && <button onClick={() => handleNavClick('files')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors text-left ${activeTab === 'files' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><FileJson size={18} />My JSON Files</button>}
            {canManageUsers && <button onClick={() => handleNavClick('users')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors text-left ${activeTab === 'users' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><Users size={18} />User Database</button>}
            {canManageAssociations && <button onClick={() => handleNavClick('associations')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors text-left ${activeTab === 'associations' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><Building size={18} />Associations</button>}
        </nav>
        <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">{user.username.substring(0,2).toUpperCase()}</div>
                <div className="flex-1 overflow-hidden text-left"><p className="text-sm font-bold text-gray-900 truncate">{user.username}</p><p className="text-[10px] text-gray-500 capitalize tracking-wider font-bold">{roles.find(r => r.id === user.role)?.name || user.role}</p></div>
            </div>
            <Button variant="secondary" className="w-full justify-start gap-2 text-gray-700 font-bold" onClick={onLogout}><LogOut size={16} /> Sign Out</Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2 font-bold text-gray-800"><div className="bg-brand-600 rounded p-1"><Folder className="text-white w-4 h-4"/></div>DropBase</div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-600 rounded-md hover:bg-gray-100 transition-colors"><Menu /></button>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-8">
            {activeTab === 'music' && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
                        <div><h2 className="text-2xl font-extrabold text-gray-900">Music Libraries</h2><p className="text-sm text-gray-500">Access and manage sheet music databases.</p></div>
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative w-full md:w-64">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                                <input type="text" className="block w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-brand-500 text-gray-900" placeholder="Search libraries..." value={musicLibSearch} onChange={(e) => setMusicLibSearch(e.target.value)} />
                                {musicLibSearch && (
                                    <button onClick={() => setMusicLibSearch('')} className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"><X size={14} /></button>
                                )}
                            </div>
                            <div className="flex gap-2"><Button variant="secondary" onClick={loadMusicDatabases} disabled={refreshing} className="text-gray-700 flex-1 md:flex-none font-bold"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></Button>{canManageDatabases && <Button onClick={() => setIsImporting(true)} className="flex items-center gap-2 flex-[3] md:flex-none font-bold"><Plus size={16} /> Import Excel</Button>}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                        {musicDatabases
                            .filter(db => db.name.toLowerCase().includes(musicLibSearch.toLowerCase()))
                            .map(db => (
                                <div key={db.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col group">
                                    <div className="flex items-start justify-between mb-4"><div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform"><Database size={24} /></div>{canManageDatabases && <button onClick={() => handleDeleteDatabase(db)} className="text-gray-300 hover:text-red-500 transition-colors">{deletingId === db.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}</button>}</div>
                                    <h3 className="text-lg font-extrabold text-gray-900 mb-1">{db.name}</h3>
                                    <p className="text-sm text-gray-500 mb-4 font-medium">{associations.find(a => a.id === db.associationId)?.name || 'Private'}</p>
                                    <div className="mt-auto flex items-center justify-between"><span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full uppercase tracking-wider">{db.recordCount} Items</span><button onClick={() => handleOpenDatabase(db)} className="text-sm font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">Manage <ArrowRight size={14} /></button></div>
                                </div>
                        ))}
                    </div>
                </>
            )}

            {activeTab === 'users' && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">User Directory</h2>
                        <div className="relative w-full md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                            <input type="text" className="block w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-brand-500 text-gray-900" placeholder="Filter users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                            {userSearch && (
                                <button onClick={() => setUserSearch('')} className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"><X size={14} /></button>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
                        <div className="lg:col-span-1">
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-8">
                                <h3 className="text-lg font-bold mb-4 text-gray-900">Add New User</h3>
                                <form onSubmit={handleAddUser} className="space-y-4">
                                    <Input label="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required />
                                    <Input label="Password" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
                                    <div>
                                        <label className="text-sm font-bold mb-1.5 block text-gray-700">Role</label>
                                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-brand-500 transition-shadow font-medium" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                            {roles.filter(r => isGroupAdmin || r.id !== 'group_admin').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                    </div>
                                    {isGroupAdmin && (
                                        <div>
                                            <label className="text-sm font-bold mb-1.5 block text-gray-700">Access Groups</label>
                                            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/50">
                                                {associations.map(a => (
                                                    <label key={a.id} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-white p-1 rounded transition-colors text-gray-700 font-medium">
                                                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" checked={newUserAssocIds.includes(a.id)} onChange={() => toggleUserAssociation(a.id)} />
                                                        {a.name}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <Button type="submit" className="w-full py-3 font-bold text-base" isLoading={addingUser}>Create Member</Button>
                                </form>
                            </div>
                        </div>
                        <div className="lg:col-span-2 space-y-4">
                             <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="hidden md:block">
                                    <table className="min-w-full divide-y divide-gray-100 text-left">
                                        <thead className="bg-gray-50/50">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">User</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Role</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredUsers.map(u => (
                                                <tr key={u.username} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4"><div className="font-bold text-gray-900">{u.username}</div></td>
                                                    <td className="px-6 py-4"><span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded capitalize text-slate-600">{u.role}</span></td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Button variant="ghost" className="text-brand-600 font-bold mr-2" onClick={() => handleEditUserClick(u)}>Edit</Button>
                                                        {u.username !== user.username && <Button variant="ghost" className="text-red-500 font-bold" onClick={() => handleDeleteUser(u.username)}>Delete</Button>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="md:hidden divide-y divide-gray-100">
                                    {filteredUsers.map(u => (
                                        <div key={u.username} className="p-5 flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 font-bold text-sm">{u.username.substring(0,2).toUpperCase()}</div>
                                                    <div><h4 className="font-extrabold text-gray-900">{u.username}</h4><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{u.role}</p></div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="secondary" className="flex-1 py-2.5 font-bold text-xs" onClick={() => handleEditUserClick(u)}>Edit Profile</Button>
                                                {u.username !== user.username && (
                                                    <Button variant="secondary" className="flex-1 py-2.5 font-bold text-xs text-red-600" onClick={() => handleDeleteUser(u.username)}>
                                                        {deletingId === u.username ? <Loader2 className="animate-spin" /> : 'Remove'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'associations' && canManageAssociations && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Associations & Groups</h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
                        <div className="lg:col-span-1">
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-8">
                                <h3 className="text-lg font-bold mb-4 text-gray-900">Register Association</h3>
                                <form onSubmit={handleAddAssociation} className="space-y-4">
                                    <Input label="Name" value={newAssociation.name} onChange={e => setNewAssociation({...newAssociation, name: e.target.value})} placeholder="e.g. JACA Youth Orchestra" required />
                                    <div className="text-left">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-brand-500 h-24" value={newAssociation.description} onChange={e => setNewAssociation({...newAssociation, description: e.target.value})} placeholder="Describe the purpose of this group..." />
                                    </div>
                                    <Button type="submit" className="w-full font-bold" isLoading={addingAssociation}>Create Association</Button>
                                </form>
                            </div>
                        </div>
                        <div className="lg:col-span-2 grid grid-cols-1 gap-4">
                            {associations.map(a => (
                                <div key={a.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between group hover:border-brand-300 transition-colors">
                                    <div className="flex gap-4">
                                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl h-fit"><Building size={20} /></div>
                                        <div>
                                            <h4 className="font-extrabold text-gray-900 text-lg leading-snug">{a.name}</h4>
                                            <p className="text-sm text-gray-500 mt-1">{a.description || 'No description provided.'}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteAssociation(a.id)} className="text-gray-300 hover:text-red-500 transition-colors p-2">
                                        {deletingId === a.id ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'google_creds' && canManageCreds && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
                        <div>
                            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Google Service Accounts</h2>
                            <p className="text-sm text-gray-500">Securely store credentials for shared cloud resources.</p>
                        </div>
                        <Button onClick={() => setShowCredForm(!showCredForm)} className="flex items-center gap-2 font-bold">
                            {showCredForm ? <X size={16} /> : <Plus size={16} />} {showCredForm ? 'Close Form' : 'Add Credentials'}
                        </Button>
                    </div>

                    {showCredForm && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md mb-8 animate-in slide-in-from-top-4 duration-300 text-left">
                            <form onSubmit={handleAddGoogleCred} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <Input label="Account Display Name" value={newCred.accountName} onChange={e => setNewCred({...newCred, accountName: e.target.value})} required placeholder="e.g. Master Admin Console" />
                                <Input label="Email / Username" value={newCred.email} onChange={e => setNewCred({...newCred, email: e.target.value})} required placeholder="admin@organization.com" />
                                <div className="relative">
                                    <Input label="Password" type={visiblePassId === 'new' ? 'text' : 'password'} value={newCred.password} onChange={e => setNewCred({...newCred, password: e.target.value})} placeholder="••••••••" />
                                    <button type="button" onClick={() => setVisiblePassId(visiblePassId === 'new' ? null : 'new')} className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 transition-colors">
                                        {visiblePassId === 'new' ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="md:col-span-2 lg:col-span-3 flex items-end gap-4">
                                    <div className="flex-1"><Input label="Notes" value={newCred.note} onChange={e => setNewCred({...newCred, note: e.target.value})} placeholder="Usage instructions or specific purpose..." /></div>
                                    <Button type="submit" isLoading={loading} className="px-8 font-bold">Save Vault Entry</Button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 text-left">
                        {googleCreds.map(c => (
                            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:border-brand-200 hover:shadow-md transition-all">
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl"><ShieldCheck size={20} /></div>
                                            <h4 className="font-extrabold text-gray-900 truncate">{c.accountName}</h4>
                                        </div>
                                        <button onClick={() => handleDeleteGoogleCred(c.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                            {deletingId === c.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { navigator.clipboard.writeText(c.email); }}>
                                            <Mail size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-600 font-medium truncate flex-1">{c.email}</span>
                                            <Copy size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="flex items-center gap-2 group">
                                            <Key size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-600 font-mono flex-1">
                                                {visiblePassId === c.id ? c.password : '••••••••••••'}
                                            </span>
                                            <button onClick={() => setVisiblePassId(visiblePassId === c.id ? null : c.id)} className="text-brand-500 hover:text-brand-700 transition-colors">
                                                {visiblePassId === c.id ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                    {c.note && <div className="mt-4 pt-4 border-t border-gray-100"><p className="text-xs text-gray-500 italic leading-relaxed">{c.note}</p></div>}
                                </div>
                            </div>
                        ))}
                        {googleCreds.length === 0 && !showCredForm && (
                            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                                <ShieldCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                <h3 className="text-sm font-bold text-gray-900">No Service Accounts Found</h3>
                                <p className="text-xs text-gray-500 mt-1">Start by adding your first secure credential vault entry.</p>
                                <Button variant="secondary" onClick={() => setShowCredForm(true)} className="mt-4 font-bold">Add Entry Now</Button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'files' && canManageFiles && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
                        <div><h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dropbox Documents</h2><p className="text-sm text-gray-500">Manual JSON file management.</p></div>
                        <div className="flex gap-2"><Button variant="secondary" onClick={loadFiles} className="text-gray-700 flex-1 md:flex-none font-bold"><RefreshCw size={16} /></Button><Button onClick={handleCreateFile} className="flex-[3] md:flex-none font-bold">+ New JSON</Button></div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-left">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/50"><tr><th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Name</th><th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {files.map(f => (
                                    <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 flex items-center gap-3 font-bold text-gray-900 cursor-pointer" onClick={() => handleEditFile(f)}><FileJson size={16} className="text-brand-500" /> {f.name}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="ghost" className="text-brand-600 font-bold mr-2" onClick={() => handleEditFile(f)}>Edit</Button>
                                            <Button variant="ghost" className="text-red-500 font-bold" onClick={() => handleDeleteFile(f.path_lower)}>Delete</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </main>
      </div>
    </div>
  );
};
