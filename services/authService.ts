import { DROPBOX_APP_KEY, REDIRECT_URI } from '../config';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/crypto';
import { DropboxTokenResponse } from '../types';

const DBX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DBX_TOKEN_URL = 'https://api.dropbox.com/oauth2/token';

const VERIFIER_STORAGE_KEY = 'dropbase_code_verifier';

export class AuthService {
  
  static async startAuth() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    // Save verifier for the callback step
    sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);

    const paramsRecord: Record<string, string> = {
      client_id: DROPBOX_APP_KEY,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline', // Request refresh token
      force_reapprove: 'true', // Forces the login screen so users can switch accounts
    };

    const params = new URLSearchParams(paramsRecord);

    // Determine if we are in an iframe (like StackBlitz preview)
    const isInIframe = window.self !== window.top;
    
    // Construct Auth URL
    const authUrl = `${DBX_AUTH_URL}?${params.toString()}`;

    // Redirect
    window.location.href = authUrl;
  }

  static async exchangeCodeForToken(code: string): Promise<DropboxTokenResponse> {
    const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
    
    if (!verifier) {
      throw new Error("No code verifier found. Please try connecting again.");
    }

    const params: Record<string, string> = {
      code,
      grant_type: 'authorization_code',
      client_id: DROPBOX_APP_KEY,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    };

    // NOTE: We DO NOT send client_secret here even if configured.
    // Dropbox API does not support CORS for the token endpoint when client_secret is present.
    // Standard PKCE (public client) flow works without the secret.
    
    const body = new URLSearchParams(params);

    const response = await fetch(DBX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error_description || 'Failed to exchange code for token');
    }

    // Clear verifier after use
    sessionStorage.removeItem(VERIFIER_STORAGE_KEY);

    return response.json();
  }

  static async refreshAccessToken(refreshToken: string): Promise<DropboxTokenResponse> {
    const params: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: DROPBOX_APP_KEY,
    };

    // No client_secret here for browser-side requests (CORS)

    const body = new URLSearchParams(params);

    const response = await fetch(DBX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    return response.json();
  }
}