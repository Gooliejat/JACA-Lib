// Note: We use a direct fetch implementation to avoid heavy SDK dependencies.

const DBX_API_URL = 'https://api.dropboxapi.com/2';
const DBX_CONTENT_URL = 'https://content.dropboxapi.com/2';

// Define the root folder for the application
const ROOT_FOLDER = '/JACA Lib';

export class DropboxService {
  private accessToken: string;

  constructor(token: string) {
    this.accessToken = token;
  }

  /**
   * Helper to ensure all paths are relative to the ROOT_FOLDER.
   */
  private getScopedPath(path: string): string {
      if (!path) return ROOT_FOLDER;

      const lowerPath = path.toLowerCase();
      const lowerRoot = ROOT_FOLDER.toLowerCase();

      if (lowerPath === lowerRoot || lowerPath.startsWith(`${lowerRoot}/`)) {
          return path;
      }

      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      if (!cleanPath) return ROOT_FOLDER;
      
      return `${ROOT_FOLDER}/${cleanPath}`;
  }

  private async rpcRequest(endpoint: string, body: any = null) {
    // FIX: Dropbox requires a valid JSON body. If body is null, we must send the string 'null', 
    // otherwise fetch sends nothing and Dropbox API fails with "could not decode input as JSON".
    const requestBody = body ? JSON.stringify(body) : 'null';

    const response = await fetch(`${DBX_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid or Expired Dropbox Token');
        
        const errText = await response.text();
        let errorMessage = `Dropbox API Error (${response.status})`;
        
        try {
            const err = JSON.parse(errText);
            const summary = err.error_summary || '';
            
            // Check for missing scope errors
            if (summary.includes('missing_scope')) {
                if (summary.includes('account_info.read')) {
                    errorMessage = "Missing Permission: Please enable 'account_info.read' in the Permissions tab of your Dropbox App Console.";
                } else if (summary.includes('files.content.read')) {
                    errorMessage = "Missing Permission: Please enable 'files.content.read' in your Dropbox App Console.";
                } else {
                    errorMessage = `Missing Permissions: Your app needs more scopes (${summary}).`;
                }
            } else {
                errorMessage = summary || errorMessage;
            }
        } catch (e) {
            if (errText) errorMessage = errText;
        }
        throw new Error(errorMessage);
    }
    return response.json();
  }

  private async contentUpload(endpoint: string, fileContent: string, path: string, mode: 'add' | 'overwrite' = 'overwrite') {
    const args = { path, mode, autorename: false, mute: false, strict_conflict: false };

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
      const args = { path: path };
      const response = await fetch(`${DBX_CONTENT_URL}${endpoint}`, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Dropbox-API-Arg': JSON.stringify(args),
          }
      });

      if (!response.ok) {
          if (response.status === 409) return null; 
          const err = await response.text();
          throw new Error('Download Failed: ' + err);
      }
      return response.json();
  }

  async getCurrentAccount(): Promise<any> {
    return await this.rpcRequest('/users/get_current_account');
  }

  async listFiles(path: string = ''): Promise<any[]> {
    const scopedPath = this.getScopedPath(path);
    try {
      const data = await this.rpcRequest('/files/list_folder', {
        path: scopedPath,
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      });
      return data.entries;
    } catch (error: any) {
        if (error.message?.includes('path/not_found')) return [];
        throw error;
    }
  }

  async fileExists(path: string): Promise<boolean> {
      try {
          await this.rpcRequest('/files/get_metadata', { path: this.getScopedPath(path) });
          return true;
      } catch (e) {
          return false;
      }
  }

  async downloadJson(path: string): Promise<any | null> {
      return this.contentDownload('/files/download', this.getScopedPath(path));
  }

  async uploadJson(path: string, data: any): Promise<void> {
      const jsonString = JSON.stringify(data, null, 2);
      await this.contentUpload('/files/upload', jsonString, this.getScopedPath(path));
  }

  async deleteFile(path: string): Promise<void> {
      await this.rpcRequest('/files/delete_v2', { path: this.getScopedPath(path) });
  }
}