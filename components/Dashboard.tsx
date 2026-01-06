import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { User, DropboxFileEntry, Association, Role, MusicDatabase, MusicRecord } from '../types';
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
    AlertTriangle
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

  // Determine initial tab based on permissions
  const [activeTab, setActiveTab] = useState<'files' | 'users' | 'associations' | 'music' | 'welcome'>(() => {
      // Prioritize Music tab if permissions allow, as it's a core feature
      return 'music';
  });

  const [files, setFiles] = useState<DropboxFileEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [musicDatabases, setMusicDatabases] = useState<MusicDatabase[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingRecordIndex, setDeletingRecordIndex] = useState<number | null>(null);

  // Layout State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    loadAssociations(); // Needed for Users and Music tabs generally
    
    if (activeTab === 'files' && canManageFiles) {
        loadFiles();
        loadMusicDatabases(); // Ensure we have DB names for the file list
    }
    if (activeTab === 'users' && canManageUsers) loadUsers();
    if (activeTab === 'music') loadMusicDatabases();

    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              
              // Filter based on user association
              if (!isGroupAdmin) {
                  const myAssocIds = user.associationIds || [];
                  dbs = dbs.filter(db => myAssocIds.includes(db.associationId));
              }
              setMusicDatabases(dbs);
          }
      } catch (e) {
          // If 409 (not found), that's fine, just empty
          console.log("No databases registry found, or empty");
      } finally {
          setRefreshing(false);
      }
  };

  const handleNavClick = (tab: typeof activeTab) => {
      setActiveTab(tab);
      setMobileMenuOpen(false);
  };

  // --- MUSIC DATABASE LOGIC ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (workbook.SheetNames.length === 0) {
              alert("Excel file contains no sheets.");
              return;
          }

          // We use the first sheet to determine headers/mapping
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length === 0) {
              alert("First sheet is empty");
              return;
          }

          const headers = jsonData[0] as string[];
          setExcelHeaders(headers);
          setImportWorkbook(workbook); // Store workbook to process all sheets later
          setImportStep(2);
          
          // Auto-guess mapping
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
          console.error(err);
          alert("Failed to parse Excel file");
      }
  };

  const handleSaveImport = async () => {
      if (!importConfig.name || !importConfig.associationId) {
          alert("Please provide a name and select an association.");
          return;
      }
      if (!importConfig.mapping.title) {
          alert("Please map at least the Title column.");
          return;
      }
      if (!importWorkbook) {
          alert("No workbook loaded.");
          return;
      }

      setLoading(true);
      try {
          let allRecords: MusicRecord[] = [];

          // Process ALL sheets
          importWorkbook.SheetNames.forEach(sheetName => {
              const sheet = importWorkbook.Sheets[sheetName];
              // Use header:1 to get raw array of arrays
              const sheetData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
              
              if (sheetData.length > 1) {
                  const headers = sheetData[0] as string[];
                  const rows = sheetData.slice(1);

                  const sheetRecords = rows.map(row => {
                      const getValue = (targetHeaderName: string) => {
                          if (!targetHeaderName) return '';
                          const index = headers.indexOf(targetHeaderName);
                          if (index === -1) return '';
                          return row[index] ? String(row[index]) : '';
                      };

                      return {
                          nr: getValue(importConfig.mapping.nr),
                          title: getValue(importConfig.mapping.title),
                          composer: getValue(importConfig.mapping.composer),
                          arranged: getValue(importConfig.mapping.arranged)
                      };
                  }).filter(r => r.title); // Basic validation
                  
                  allRecords = [...allRecords, ...sheetRecords];
              }
          });

          // 2. Upload Content File
          const fileId = `db_${Date.now()}`;
          const fileName = `/music_${fileId}.json`;
          
          await service.uploadJson(fileName, { records: allRecords });

          // 3. Update Registry
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
              if (regData && Array.isArray(regData.databases)) {
                  currentRegistry = regData.databases;
              }
          } catch (e) { /* ignore */ }

          await service.uploadJson('/databases.json', { databases: [...currentRegistry, newDbEntry] });

          // Reset
          setIsImporting(false);
          setImportStep(1);
          setImportWorkbook(null);
          setImportConfig({ name: '', associationId: '', mapping: { nr: '', title: '', composer: '', arranged: '' } });
          loadMusicDatabases();

      } catch (e) {
          console.error(e);
          alert("Failed to save database");
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteDatabase = async (db: MusicDatabase) => {
      if (!window.confirm(`Are you sure you want to delete "${db.name}"? This action cannot be undone.`)) return;
      setDeletingId(db.id);

      try {
          // Try to delete content file, but don't fail entire op if file is already missing
          try {
            await service.deleteFile(db.fileName);
          } catch (e) {
            console.warn("File deletion failed or file missing, proceeding to remove registry entry", e);
          }
          
          // Update Registry
          const regData = await service.downloadJson('/databases.json');
          if (regData && Array.isArray(regData.databases)) {
               const updated = regData.databases.filter((d: MusicDatabase) => d.id !== db.id);
               await service.uploadJson('/databases.json', { databases: updated });
          }
          await loadMusicDatabases();
      } catch (e) {
          console.error(e);
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
              setSortConfig(null); // Reset sort
          } else {
              alert("Database file is empty or corrupted.");
          }
      } catch (e) {
          console.error(e);
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
              if (!isNaN(val) && val > maxNr) {
                  maxNr = val;
              }
          });
      }
      
      setNewRecordData({ 
          nr: (maxNr + 1).toString(), 
          title: '', 
          composer: '', 
          arranged: '' 
      });
      setIsAddingRecord(true);
  };

  const updateDatabaseRegistryCount = async (db: MusicDatabase, newCount: number) => {
    try {
        // Optimistically update local state
        const updatedDbs = musicDatabases.map(d => 
            d.id === db.id ? { ...d, recordCount: newCount } : d
        );
        setMusicDatabases(updatedDbs);

        // Update remote databases.json
        await service.uploadJson('/databases.json', { databases: updatedDbs });
    } catch (e) {
        console.error("Failed to update database registry record count", e);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!viewingDatabase) return;
      setCreatingRecord(true);
      try {
          // Add to local list
          const newRecords = [...dbRecords, newRecordData];
          
          // Upload
          await service.uploadJson(viewingDatabase.fileName, { records: newRecords });
          
          // Update View
          setDbRecords(newRecords);
          setIsAddingRecord(false);
          setNewRecordData({ nr: '', title: '', composer: '', arranged: '' });

          // Update Registry Count
          await updateDatabaseRegistryCount(viewingDatabase, newRecords.length);

      } catch (err) {
          console.error(err);
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
        // The index passed is the original index from the database
        newRecords.splice(index, 1);

        await service.uploadJson(viewingDatabase.fileName, { records: newRecords });
        setDbRecords(newRecords);

        // Update Registry Count
        await updateDatabaseRegistryCount(viewingDatabase, newRecords.length);
    } catch (e) {
        console.error(e);
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
          // 1. Update local state
          const newRecords = [...dbRecords];
          if (editingRecord.originalIndex >= 0 && editingRecord.originalIndex < newRecords.length) {
              newRecords[editingRecord.originalIndex] = editingRecord.record;
          } else {
              throw new Error("Record index out of bounds");
          }

          // 2. Upload new file content
          await service.uploadJson(viewingDatabase.fileName, { records: newRecords });
          
          // 3. Update view
          setDbRecords(newRecords);
          setEditingRecord(null);

      } catch (err) {
          console.error(err);
          alert("Failed to save record changes.");
      } finally {
          setUpdatingRecord(false);
      }
  };

  const handleSort = (key: keyof MusicRecord) => {
      setSortConfig(current => {
          if (current?.key === key) {
              // Toggle direction
              return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
          }
          // Default to asc for new key
          return { key, direction: 'asc' };
      });
  };

  const handleExportDatabase = () => {
      if (!viewingDatabase || dbRecords.length === 0) return;

      try {
          // Create export data with nice headers
          const exportData = dbRecords.map(r => ({
              'Nr': r.nr,
              'Title': r.title,
              'Composer': r.composer,
              'Arranged by': r.arranged
          }));

          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
          
          // Generate nice filename
          const safeName = viewingDatabase.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          XLSX.writeFile(wb, `${safeName}_export.xlsx`);
      } catch (e) {
          console.error(e);
          alert("Failed to export to Excel");
      }
  };

  // --- FILE ACTIONS (Legacy) ---
  const handleCreateFile = () => {
      setEditingFile({
          name: 'new_file.json',
          content: '{\n  "key": "value"\n}',
          isNew: true
      });
  };

  const handleEditFile = async (file: DropboxFileEntry) => {
      setLoading(true);
      try {
          const content = await service.downloadJson(file.path_lower);
          setEditingFile({
              name: file.name,
              content: JSON.stringify(content, null, 2),
              isNew: false
          });
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
          try {
              parsed = JSON.parse(editingFile.content);
          } catch (e) {
              alert("Invalid JSON format");
              setSaving(false);
              return;
          }

          let path = '/' + editingFile.name;
          if (!path.endsWith('.json')) path += '.json';

          await service.uploadJson(path, parsed);
          setEditingFile(null);
          loadFiles();
      } catch (e) {
          console.error(e);
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
      setNewUserAssocIds(prev => 
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
          const userObj: User = {
              username: newUser.username,
              passwordHash: hash,
              role: newUser.role,
              createdAt: new Date().toISOString(),
              associationIds: newUserAssocIds
          };

          const updatedUsers = [...currentUsers, userObj];
          await service.uploadJson('/users.json', { users: updatedUsers });
          
          loadUsers(); // Reload to refresh list based on filters
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

  // --- EDIT USER ACTIONS ---
  
  const handleEditUserClick = (u: User) => {
      setUserToEdit(u);
      setEditPassword('');
      setEditAssocIds(u.associationIds || []);
      setEditRole(u.role);
  };

  const toggleEditUserAssociation = (assocId: string) => {
      setEditAssocIds(prev => 
          prev.includes(assocId) 
              ? prev.filter(id => id !== assocId)
              : [...prev, assocId]
      );
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
                  if (editPassword.trim()) {
                      newPassHash = await hashPassword(editPassword.trim());
                  }
                  return {
                      ...u,
                      passwordHash: newPassHash,
                      role: editRole,
                      associationIds: editAssocIds
                  };
              }
              return u;
          }));

          await service.uploadJson('/users.json', { users: updatedUsers });
          loadUsers();
          setUserToEdit(null);
      } catch (e) {
          console.error(e);
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

          const newAssocObj: Association = {
              id: Date.now().toString(),
              name: newAssociation.name,
              description: newAssociation.description,
              createdAt: new Date().toISOString()
          };

          const updatedAssocs = [...currentAssocs, newAssocObj];
          await service.uploadJson('/associations.json', { associations: updatedAssocs });

          setAssociations(updatedAssocs);
          setNewAssociation({ name: '', description: '' });
      } catch (e) {
          console.error(e);
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


  // --- RENDERING ---

  // Modal for Edit User
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
                           <select 
                             className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                             value={editRole}
                             onChange={(e) => setEditRole(e.target.value)}
                             disabled={!isGroupAdmin && userToEdit.role === 'group_admin'} // Normal admins cannot edit group admin role
                           >
                              {roles.filter(r => isGroupAdmin || r.id !== 'group_admin').map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                           </select>
                        </div>

                        <Input 
                            label="New Password"
                            type="password"
                            placeholder="Leave blank to keep current"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                        />

                        <div className="pt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Associations</label>
                            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                                {availableAssocs.length === 0 && <p className="text-xs text-gray-400">No available associations.</p>}
                                {availableAssocs.map(assoc => (
                                    <div key={assoc.id} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id={`edit-user-assoc-${assoc.id}`}
                                            className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                                            checked={editAssocIds.includes(assoc.id)}
                                            onChange={() => toggleEditUserAssociation(assoc.id)}
                                        />
                                        <label htmlFor={`edit-user-assoc-${assoc.id}`} className="ml-2 block text-sm text-gray-700 truncate cursor-pointer select-none">
                                            {assoc.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="secondary" className="flex-1" onClick={() => setUserToEdit(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="flex-1" isLoading={updatingUser}>
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
     );
  };

  // Modal for Add Record
  const renderAddRecordModal = () => {
    if (!isAddingRecord) return null;

    // Check for duplicate Nr
    const existingNrRecord = dbRecords.find(r => r.nr === newRecordData.nr && newRecordData.nr !== '');
    
    // Check for duplicate Content (Title + Composer + Arranged)
    const existingContentRecord = dbRecords.find(r => 
        r.title.trim().toLowerCase() === newRecordData.title.trim().toLowerCase() && 
        r.composer.trim().toLowerCase() === newRecordData.composer.trim().toLowerCase() && 
        r.arranged.trim().toLowerCase() === newRecordData.arranged.trim().toLowerCase() &&
        newRecordData.title.trim() !== ''
    );

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                  <h3 className="text-lg leading-6 font-bold text-gray-900">Add New Item</h3>
                  <form className="mt-4 text-left space-y-4" onSubmit={handleCreateRecord}>
                      <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-1">
                              <Input 
                                  label="Nr"
                                  value={newRecordData.nr}
                                  onChange={(e) => setNewRecordData({ ...newRecordData, nr: e.target.value })}
                              />
                          </div>
                          <div className="col-span-3">
                              <Input 
                                  label="Title"
                                  value={newRecordData.title}
                                  onChange={(e) => setNewRecordData({ ...newRecordData, title: e.target.value })}
                                  required
                              />
                          </div>
                          
                          {existingNrRecord && (
                                <div className="col-span-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                                        <div className="text-sm text-amber-900">
                                            <p className="font-semibold mb-1">Number "{existingNrRecord.nr}" already exists</p>
                                            <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs opacity-90">
                                                <span className="font-medium text-amber-700">Title:</span>
                                                <span>{existingNrRecord.title}</span>
                                                <span className="font-medium text-amber-700">Composer:</span>
                                                <span>{existingNrRecord.composer}</span>
                                                {existingNrRecord.arranged && (
                                                    <>
                                                        <span className="font-medium text-amber-700">Arranged:</span>
                                                        <span>{existingNrRecord.arranged}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                          )}

                          {existingContentRecord && (
                              <div className="col-span-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                  <div className="flex items-start gap-3">
                                      <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                                      <div className="text-sm text-amber-900">
                                          <p className="font-semibold mb-1">Duplicate item found at Record #{existingContentRecord.nr}</p>
                                          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs opacity-90">
                                                <span className="font-medium text-amber-700">Title:</span>
                                                <span>{existingContentRecord.title}</span>
                                                <span className="font-medium text-amber-700">Composer:</span>
                                                <span>{existingContentRecord.composer}</span>
                                                {existingContentRecord.arranged && (
                                                    <>
                                                        <span className="font-medium text-amber-700">Arranged:</span>
                                                        <span>{existingContentRecord.arranged}</span>
                                                    </>
                                                )}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                      <Input 
                          label="Composer"
                          value={newRecordData.composer}
                          onChange={(e) => setNewRecordData({ ...newRecordData, composer: e.target.value })}
                      />
                       <Input 
                          label="Arranged by"
                          value={newRecordData.arranged}
                          onChange={(e) => setNewRecordData({ ...newRecordData, arranged: e.target.value })}
                      />
                      <div className="flex gap-3 pt-4">
                          <Button type="button" variant="secondary" className="flex-1" onClick={() => { setIsAddingRecord(false); setNewRecordData({ nr: '', title: '', composer: '', arranged: '' }); }}>
                              Cancel
                          </Button>
                          <Button type="submit" className="flex-1" isLoading={creatingRecord} disabled={!!existingNrRecord}>
                              Add Item
                          </Button>
                      </div>
                  </form>
              </div>
          </div>
      </div>
    );
  };

  // Modal for Edit Record
  const renderEditRecordModal = () => {
      if (!editingRecord) return null;

      const existingRecord = dbRecords.find((r, i) => r.nr === editingRecord.record.nr && i !== editingRecord.originalIndex);

      return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
                <div className="mt-3 text-center">
                    <h3 className="text-lg leading-6 font-bold text-gray-900">Edit Record</h3>
                    <form className="mt-4 text-left space-y-4" onSubmit={handleUpdateRecord}>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1">
                                <Input 
                                    label="Nr"
                                    value={editingRecord.record.nr}
                                    onChange={(e) => setEditingRecord({
                                        ...editingRecord,
                                        record: { ...editingRecord.record, nr: e.target.value }
                                    })}
                                />
                            </div>
                            <div className="col-span-3">
                                <Input 
                                    label="Title"
                                    value={editingRecord.record.title}
                                    onChange={(e) => setEditingRecord({
                                        ...editingRecord,
                                        record: { ...editingRecord.record, title: e.target.value }
                                    })}
                                    required
                                />
                            </div>
                            
                            {existingRecord && (
                                <div className="col-span-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                                        <div className="text-sm text-amber-900">
                                            <p className="font-semibold mb-1">Number "{existingRecord.nr}" already exists</p>
                                            <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs opacity-90">
                                                <span className="font-medium text-amber-700">Title:</span>
                                                <span>{existingRecord.title}</span>
                                                <span className="font-medium text-amber-700">Composer:</span>
                                                <span>{existingRecord.composer}</span>
                                                {existingRecord.arranged && (
                                                    <>
                                                        <span className="font-medium text-amber-700">Arranged:</span>
                                                        <span>{existingRecord.arranged}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <Input 
                            label="Composer"
                            value={editingRecord.record.composer}
                            onChange={(e) => setEditingRecord({
                                ...editingRecord,
                                record: { ...editingRecord.record, composer: e.target.value }
                            })}
                        />
                         <Input 
                            label="Arranged by"
                            value={editingRecord.record.arranged}
                            onChange={(e) => setEditingRecord({
                                ...editingRecord,
                                record: { ...editingRecord.record, arranged: e.target.value }
                            })}
                        />
                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditingRecord(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="flex-1" isLoading={updatingRecord}>
                                Save Record
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      );
  };

  // Render Music Import Modal
  const renderImportModal = () => {
      if (!isImporting) return null;
      const availableAssocs = getAvailableAssociations();

      return (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
              <div className="relative mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-xl bg-white max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-gray-900">Import Music Database</h3>
                      <button onClick={() => { setIsImporting(false); setImportStep(1); setImportWorkbook(null); }} className="text-gray-400 hover:text-gray-600"><X /></button>
                  </div>

                  {importStep === 1 && (
                      <div className="space-y-6 text-center py-8">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 hover:bg-gray-50 transition-colors">
                              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                              <p className="text-sm text-gray-600 mb-4">Select an .xls or .xlsx file to import</p>
                              <p className="text-xs text-gray-400 mb-4">All visible sheets will be imported.</p>
                              <input 
                                  type="file" 
                                  accept=".xls,.xlsx" 
                                  onChange={handleFileSelect} 
                                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 mx-auto max-w-xs"
                              />
                          </div>
                      </div>
                  )}

                  {importStep === 2 && (
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Input 
                                  label="Database Name" 
                                  value={importConfig.name} 
                                  onChange={e => setImportConfig({...importConfig, name: e.target.value})} 
                                  placeholder="e.g., Concert Band Library"
                              />
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Association</label>
                                  <select 
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                      value={importConfig.associationId}
                                      onChange={e => setImportConfig({...importConfig, associationId: e.target.value})}
                                  >
                                      <option value="">Select Association...</option>
                                      {availableAssocs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </select>
                              </div>
                          </div>

                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-3">Map Excel Columns</h4>
                              <p className="text-xs text-gray-500 mb-4">Match the columns from your Excel file to the database fields.</p>
                              
                              <div className="grid grid-cols-2 gap-4">
                                  {['nr', 'title', 'composer', 'arranged'].map(field => {
                                      let label = field.charAt(0).toUpperCase() + field.slice(1);
                                      if (field === 'arranged') label = 'Arranged by';
                                      
                                      return (
                                          <div key={field}>
                                              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{label}</label>
                                              <select 
                                                  className="w-full text-sm border-gray-300 rounded-md"
                                                  value={(importConfig.mapping as any)[field]}
                                                  onChange={(e) => setImportConfig({
                                                      ...importConfig, 
                                                      mapping: { ...importConfig.mapping, [field]: e.target.value }
                                                  })}
                                              >
                                                  <option value="">(Skip)</option>
                                                  {excelHeaders.map((h, i) => (
                                                      <option key={i} value={h}>{h}</option>
                                                  ))}
                                              </select>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                          
                          <div className="flex justify-between items-center pt-2">
                              <button onClick={() => {setImportStep(1); setImportWorkbook(null);}} className="text-sm text-gray-500 hover:text-gray-800">Back to file</button>
                              <Button onClick={handleSaveImport} isLoading={loading}>Create Database</Button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- VIEW DATABASE COMPONENT ---
  if (viewingDatabase) {
      let displayedRecords = dbRecords.map((r, index) => ({ ...r, originalIndex: index }));
      
      // Filter
      displayedRecords = displayedRecords.filter(r => 
          r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
          r.composer.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.nr.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // Apply Sort
      if (sortConfig) {
          displayedRecords.sort((a, b) => {
              const aVal = (a[sortConfig.key] || '').toString();
              const bVal = (b[sortConfig.key] || '').toString();

              // Use localeCompare with numeric: true for natural sorting (handles "1, 2, 10" correctly)
              const comparison = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
              
              return sortConfig.direction === 'asc' ? comparison : -comparison;
          });
      }

      const renderSortIcon = (key: keyof MusicRecord) => {
          if (sortConfig?.key !== key) return <div className="w-4 h-4 ml-1"></div>;
          return sortConfig.direction === 'asc' 
              ? <ChevronUp className="w-4 h-4 ml-1" />
              : <ChevronDown className="w-4 h-4 ml-1" />;
      };

      const SortableHeader = ({ label, field, widthClass }: { label: string, field: keyof MusicRecord, widthClass?: string }) => (
          <th 
              className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none ${widthClass || ''}`}
              onClick={() => handleSort(field)}
          >
              <div className="flex items-center">
                  {label}
                  {renderSortIcon(field)}
              </div>
          </th>
      );

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
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Search className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                              type="text"
                              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                              placeholder="Search..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              autoFocus
                          />
                      </div>
                      {(isGroupAdmin || isAdmin) && (
                          <div className="flex items-center gap-2">
                             <Button onClick={handleOpenAddRecordModal} className="flex items-center justify-center gap-2">
                                <Plus size={16} /> Add Item
                             </Button>
                             <Button variant="secondary" onClick={handleExportDatabase} className="flex items-center justify-center gap-2">
                                <Download size={16} /> Export
                             </Button>
                          </div>
                      )}
                  </div>
              </div>

              <div className="flex-1 p-4 md:p-8 overflow-auto">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <SortableHeader label="Nr" field="nr" widthClass="w-24" />
                                    <SortableHeader label="Title" field="title" />
                                    <SortableHeader label="Composer" field="composer" />
                                    <SortableHeader label="Arranged by" field="arranged" />
                                    {canManageDatabases && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayedRecords.map((r) => (
                                    <tr key={r.originalIndex} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{r.nr}</td>
                                        <td className="px-6 py-3 text-sm text-gray-900 font-semibold">{r.title}</td>
                                        <td className="px-6 py-3 text-sm text-gray-500">{r.composer}</td>
                                        <td className="px-6 py-3 text-sm text-gray-500">{r.arranged}</td>
                                        {canManageDatabases && (
                                            <td className="px-6 py-3 text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button 
                                                        onClick={() => setEditingRecord({ record: r, originalIndex: r.originalIndex })}
                                                        className="text-brand-600 hover:text-brand-900 p-1 rounded hover:bg-brand-50"
                                                        title="Edit Record"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteRecord(r.originalIndex)}
                                                        className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                                        title="Delete Record"
                                                        disabled={deletingRecordIndex === r.originalIndex}
                                                    >
                                                        {deletingRecordIndex === r.originalIndex ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {displayedRecords.length === 0 && (
                                    <tr>
                                        <td colSpan={canManageDatabases ? 5 : 4} className="px-6 py-12 text-center text-gray-500">
                                            No records match your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                      </div>
                  </div>
              </div>
          </div>
      )
  }

  // --- JSON EDITOR VIEW ---
  if (editingFile) {
      return (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <Input 
                        value={editingFile.name} 
                        onChange={(e) => setEditingFile({...editingFile, name: e.target.value})}
                        disabled={!editingFile.isNew}
                        className="font-mono text-lg font-bold min-w-[300px]"
                        placeholder="filename.json"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setEditingFile(null)}>Cancel</Button>
                    <Button onClick={handleSaveFile} isLoading={saving} className="flex items-center gap-2">
                        <Save size={16} /> Save JSON
                    </Button>
                </div>
            </div>
            <div className="flex-1 p-6 overflow-hidden">
                <textarea 
                    className="w-full h-full p-4 font-mono text-sm bg-white border rounded-lg shadow-inner resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={editingFile.content}
                    onChange={(e) => setEditingFile({...editingFile, content: e.target.value})}
                    spellCheck={false}
                />
            </div>
        </div>
      );
  }

  const availableAssocsForAdd = getAvailableAssociations();

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {renderEditUserModal()}
      {renderImportModal()}
      
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-50 z-20 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
            fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out
            md:translate-x-0 md:static md:inset-auto
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <div className="bg-brand-600 rounded p-1">
                    <Folder className="text-white w-4 h-4"/>
                </div>
                DropBase
            </h1>
            <p className="text-xs text-gray-400 mt-1">v1.9.1</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
            <button 
                onClick={() => handleNavClick('music')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'music' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <Music size={18} />
                Music Libraries
            </button>

            {canManageFiles && (
                <button 
                    onClick={() => handleNavClick('files')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'files' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <FileJson size={18} />
                    My JSON Files
                </button>
            )}
            {canManageUsers && (
                <button 
                    onClick={() => handleNavClick('users')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'users' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <Users size={18} />
                    User Database
                </button>
            )}
            {canManageAssociations && (
                <button 
                    onClick={() => handleNavClick('associations')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'associations' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <Building size={18} />
                    Associations
                </button>
            )}
        </nav>

        <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">
                    {user.username.substring(0,2).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
                    <div className="flex items-center gap-1">
                        <Shield size={10} className="text-brand-500"/>
                        <p className="text-xs text-gray-500 capitalize">{roles.find(r => r.id === user.role)?.name || user.role}</p>
                    </div>
                </div>
            </div>
            <Button variant="secondary" className="w-full justify-start gap-2" onClick={onLogout}>
                <LogOut size={16} /> Sign Out
            </Button>
        </div>
      </div>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2 font-bold text-gray-800">
                <div className="bg-brand-600 rounded p-1">
                    <Folder className="text-white w-4 h-4"/>
                </div>
                DropBase
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-600 rounded-md hover:bg-gray-100">
                <Menu />
            </button>
        </div>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
            
            {activeTab === 'welcome' && (
                <div className="text-center py-20">
                    <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <Lock className="w-12 h-12 text-gray-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Welcome to DropBase</h2>
                    <p className="text-gray-500 mt-2">You are logged in as {user.username}.</p>
                    <p className="text-gray-400 mt-1 text-sm">Please select an option from the sidebar.</p>
                </div>
            )}

            {activeTab === 'music' && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Music Libraries</h2>
                            <p className="text-gray-500">Access and manage sheet music databases.</p>
                        </div>
                        <div className="flex gap-2">
                             <Button variant="secondary" onClick={loadMusicDatabases} disabled={refreshing}>
                                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            </Button>
                            {canManageDatabases && (
                                <Button onClick={() => setIsImporting(true)} className="flex items-center gap-2">
                                    <Plus size={16} /> <span className="hidden sm:inline">Import Excel</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {musicDatabases.map(db => {
                            const assocName = associations.find(a => a.id === db.associationId)?.name || 'Unknown Association';
                            const isDeleting = deletingId === db.id;
                            return (
                                <div key={db.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
                                            <Database size={24} />
                                        </div>
                                        {canManageDatabases && (
                                            <button 
                                                onClick={() => handleDeleteDatabase(db)} 
                                                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                                disabled={isDeleting}
                                            >
                                                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                            </button>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{db.name}</h3>
                                    <p className="text-sm text-gray-500 mb-4">{assocName}</p>
                                    
                                    <div className="mt-auto flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                            {db.recordCount} Records
                                        </span>
                                        <button 
                                            onClick={() => handleOpenDatabase(db)} 
                                            className="text-sm font-medium text-brand-600 hover:text-brand-800 flex items-center gap-1"
                                            disabled={isDeleting}
                                        >
                                            Open <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {musicDatabases.length === 0 && (
                             <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                                <Music className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900">No Music Libraries Found</h3>
                                <p className="text-gray-500 mt-1 max-w-sm mx-auto">
                                    {canManageDatabases 
                                        ? "Get started by importing an Excel file to create a new database." 
                                        : "You don't have access to any music libraries yet. Contact your administrator."}
                                </p>
                                {canManageDatabases && (
                                    <div className="mt-6">
                                        <Button onClick={() => setIsImporting(true)}>Import First Database</Button>
                                    </div>
                                )}
                             </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'files' && canManageFiles && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Files</h2>
                            <p className="text-gray-500">Manage your JSON documents stored in Dropbox.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={loadFiles} disabled={refreshing}>
                                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            </Button>
                            <Button onClick={handleCreateFile} className="flex items-center gap-2">
                                <Plus size={16} /> New JSON
                            </Button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {loading && <div className="p-8 text-center text-gray-500">Loading content...</div>}
                        {!loading && files.length === 0 && (
                            <div className="p-12 text-center">
                                <FileJson className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900">No JSON files found</h3>
                                <p className="text-gray-500 mt-1">Create a new file to get started.</p>
                            </div>
                        )}
                        {!loading && files.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Database</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {files.map((file) => {
                                        const linkedDb = musicDatabases.find(db => 
                                            db.fileName.toLowerCase() === file.path_lower.toLowerCase()
                                        );
                                        return (
                                        <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <FileJson className="flex-shrink-0 h-5 w-5 text-gray-400 mr-3" />
                                                    <div className="text-sm font-medium text-brand-600 cursor-pointer" onClick={() => handleEditFile(file)}>
                                                        {file.name}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {linkedDb ? (
                                                    <div className="flex items-center">
                                                        <Database className="w-4 h-4 mr-2 text-brand-500"/>
                                                        <span className="font-medium text-gray-900">{linkedDb.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">Unlinked File</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={() => handleEditFile(file)} className="text-brand-600 hover:text-brand-900 mr-4">Edit</button>
                                                <button onClick={() => handleDeleteFile(file.path_lower)} className="text-red-600 hover:text-red-900">Delete</button>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                          </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'users' && canManageUsers && (
                <>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">User Database</h2>
                            <p className="text-gray-500">Manage users and their association links.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Add User Form */}
                        <div className="lg:col-span-1">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Add New User</h3>
                                <form onSubmit={handleAddUser} className="space-y-4">
                                    <Input 
                                        label="Username" 
                                        value={newUser.username}
                                        onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                                        required
                                    />
                                    <Input 
                                        label="Password" 
                                        type="password"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                        required
                                    />
                                    <div>
                                       <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                       <select 
                                         className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                         value={newUser.role}
                                         onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                                       >
                                          {roles.filter(r => isGroupAdmin || r.id !== 'group_admin').map(r => (
                                              <option key={r.id} value={r.id}>{r.name}</option>
                                          ))}
                                       </select>
                                    </div>
                                    
                                    <div className="pt-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Link Associations</label>
                                        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                                            {availableAssocsForAdd.length === 0 && <p className="text-xs text-gray-400">No associations available to assign.</p>}
                                            {availableAssocsForAdd.map(assoc => (
                                                <div key={assoc.id} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id={`user-assoc-${assoc.id}`}
                                                        className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                                                        checked={newUserAssocIds.includes(assoc.id)}
                                                        onChange={() => toggleUserAssociation(assoc.id)}
                                                    />
                                                    <label htmlFor={`user-assoc-${assoc.id}`} className="ml-2 block text-sm text-gray-700 truncate cursor-pointer select-none">
                                                        {assoc.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Button type="submit" className="w-full" isLoading={addingUser}>
                                        Create User
                                    </Button>
                                </form>
                            </div>
                        </div>

                        {/* User List */}
                        <div className="lg:col-span-2">
                             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Associations</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {users.map((u) => {
                                            const roleName = roles.find(r => r.id === u.role)?.name || u.role;
                                            const isDeleting = deletingId === u.username;
                                            return (
                                            <tr key={u.username}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs mr-3">
                                                            {u.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="text-sm font-medium text-gray-900">{u.username}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {u.associationIds && u.associationIds.length > 0 ? (
                                                            u.associationIds.map(id => {
                                                                const name = associations.find(a => a.id === id)?.name || id;
                                                                return (
                                                                    <span key={id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                        {name}
                                                                    </span>
                                                                );
                                                            })
                                                        ) : (
                                                            <span className="text-xs text-gray-400">None</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'group_admin' ? 'bg-purple-100 text-purple-800' : (u.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800')}`}>
                                                        {roleName}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button 
                                                        onClick={() => handleEditUserClick(u)} 
                                                        className="text-brand-600 hover:text-brand-900 mr-3 disabled:opacity-50"
                                                        disabled={isDeleting}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteUser(u.username)} 
                                                        className="text-red-600 hover:text-red-900 disabled:opacity-50 inline-flex items-center gap-1"
                                                        disabled={u.username === user.username || isDeleting}
                                                    >
                                                        {isDeleting ? <Loader2 className="animate-spin" size={12} /> : "Delete"}
                                                    </button>
                                                </td>
                                            </tr>
                                        )})}
                                        {users.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                                    No accessible users found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                  </table>
                                </div>
                             </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'associations' && canManageAssociations && (
                <>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Associations</h2>
                            <p className="text-gray-500">Manage organizations or groups.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Add Association Form */}
                        <div className="lg:col-span-1">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">New Association</h3>
                                <form onSubmit={handleAddAssociation} className="space-y-4">
                                    <Input 
                                        label="Name" 
                                        value={newAssociation.name}
                                        onChange={(e) => setNewAssociation({...newAssociation, name: e.target.value})}
                                        required
                                        placeholder="e.g. Acme Corp"
                                    />
                                    <Input 
                                        label="Description" 
                                        value={newAssociation.description}
                                        onChange={(e) => setNewAssociation({...newAssociation, description: e.target.value})}
                                        placeholder="Optional description"
                                    />
                                    <Button type="submit" className="w-full" isLoading={addingAssociation}>
                                        Add Association
                                    </Button>
                                </form>
                            </div>
                        </div>

                        {/* Association List */}
                        <div className="lg:col-span-2">
                             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {associations.map((a) => {
                                            const isDeleting = deletingId === a.id;
                                            return (
                                            <tr key={a.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{a.name}</div>
                                                    <div className="text-xs text-gray-400">ID: {a.id}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {a.description || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button 
                                                        onClick={() => handleDeleteAssociation(a.id)} 
                                                        className="text-red-600 hover:text-red-900 disabled:opacity-50 inline-flex items-center gap-1"
                                                        disabled={isDeleting}
                                                    >
                                                        {isDeleting ? <Loader2 className="animate-spin" size={12} /> : "Delete"}
                                                    </button>
                                                </td>
                                            </tr>
                                        )})}
                                        {associations.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                                    No associations defined.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                  </table>
                                </div>
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