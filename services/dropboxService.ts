import { Dropbox, DropboxResponse, files } from 'dropbox';

// Note: Using the official 'dropbox' SDK would typically require installing it via npm.
// Since I am generating code that must run in a specific environment, I will assume 'dropbox' is available 
// or I will implement a lightweight fetch wrapper if the SDK is too heavy to assume. 
// For this environment, a direct fetch implementation is more robust as it removes hidden dependency issues.

const DBX_API_URL = 'https://api.dropboxapi.com/2';
const DBX_CONTENT_URL = 'https://content.dropboxapi.com/2';

export class DropboxService {
  private accessToken: string;

  constructor(token: string) {
    this.accessToken = token;
  }

  private async rpcRequest(endpoint: string, body: any = null) {
    const response = await fetch(`${DBX_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid Dropbox Token');
        const err = await response.json();
        throw new Error(err.error_summary || 'Dropbox API Error');
    }
    return response.json();
  }

  private async contentUpload(endpoint: string, fileContent: string, path: string, mode: 'add' | 'overwrite' = 'overwrite') {
    // Dropbox-API-Arg needs to be a JSON string in the header
    const args = {
        path,
        mode,
        autorename: false,
        mute: false,
        strict_conflict: false
    };

    const response = await fetch(`${DBX_CONTENT_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify(args),
        'Content-Type': 'application/octet-stream',
      },
      body: fileContent,
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err || 'Upload Failed');
    }
    return response.json();
  }

  private async contentDownload(endpoint: string, path: string) {
      const args = { path };
      const response = await fetch(`${DBX_CONTENT_URL}${endpoint}`, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Dropbox-API-Arg': JSON.stringify(args),
          }
      });

      if (!response.ok) {
          if (response.status === 409) return null; // File not found usually
          throw new Error('Download Failed');
      }
      return response.json(); // Returns the file content (assuming JSON)
  }

  async listFiles(path: string = ''): Promise<any[]> {
    try {
      const data = await this.rpcRequest('/files/list_folder', {
        path,
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      });
      return data.entries;
    } catch (error: any) {
        // Handle root folder empty or error
        console.error("List files error", error);
        return [];
    }
  }

  async fileExists(path: string): Promise<boolean> {
      try {
          await this.rpcRequest('/files/get_metadata', { path });
          return true;
      } catch (e) {
          return false;
      }
  }

  async downloadJson(path: string): Promise<any | null> {
      return this.contentDownload('/files/download', path);
  }

  async uploadJson(path: string, data: any): Promise<void> {
      const jsonString = JSON.stringify(data, null, 2);
      await this.contentUpload('/files/upload', jsonString, path);
  }

  async deleteFile(path: string): Promise<void> {
      await this.rpcRequest('/files/delete_v2', { path });
  }
}
