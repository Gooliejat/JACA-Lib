// Dropbox OAuth Configuration
// You can get this key from the Dropbox App Console (https://www.dropbox.com/developers/apps)
export const DROPBOX_APP_KEY = 'r96fz9zusmf39ej'; 

// OPTIONAL: If your app requires a client secret (Standard Code Flow), add it here.
export const DROPBOX_APP_SECRET = 'wnwgggpecy0novt'; 

/**
 * MANUAL REDIRECT URI OVERRIDE
 * If you are getting "Invalid Redirect URI", set this string to EXACTLY 
 * what you have in your Dropbox App Console. 
 * Example: 'https://your-app-id.stackblitz.io'
 */
const MANUAL_REDIRECT_URI: string | null = null;

const getRedirectUri = () => {
    if (MANUAL_REDIRECT_URI) return MANUAL_REDIRECT_URI;

    const url = new URL(window.location.href);
    // Use the origin + pathname (stripping query params and hashes)
    // Most Dropbox apps expect the root URL or a specific file.
    let base = url.origin + url.pathname;
    
    // Ensure it doesn't end with a trailing slash if that's how it's registered
    // Or add index.html if your host requires it. 
    // Standard practice for SPAs is just the clean base URL.
    if (base.endsWith('/')) {
        base = base.slice(0, -1);
    }
    
    return base;
};

export const REDIRECT_URI = getRedirectUri();

// Legacy token (kept for reference)
export const DROPBOX_ACCESS_TOKEN = '';
