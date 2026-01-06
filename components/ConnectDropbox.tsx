import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ExternalLink, HelpCircle, Copy, CheckCircle2, AlertCircle, Key, Globe, ChevronRight } from 'lucide-react';
import { AuthService } from '../services/authService';
import { DROPBOX_APP_KEY, REDIRECT_URI } from '../config';

interface ConnectDropboxProps {
  error?: string;
  onManualToken: (token: string) => void;
}

export const ConnectDropbox: React.FC<ConnectDropboxProps> = ({ error, onManualToken }) => {
  const [copied, setCopied] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);

  const handleConnectOAuth = async () => {
    if (!DROPBOX_APP_KEY || (DROPBOX_APP_KEY as string) === 'INSERT_YOUR_APP_KEY_HERE') {
      alert("Please configure your Dropbox App Key in config.ts first.");
      return;
    }
    await AuthService.startAuth();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      onManualToken(manualToken.trim());
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(REDIRECT_URI);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
             <div className="h-16 w-16 bg-brand-600 rounded-2xl flex items-center justify-center shadow-xl rotate-3">
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-white" stroke="currentColor" strokeWidth="2.5">
                   <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
             </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Connect to DropBase
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Choose a connection method to sync your database
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex gap-3 shadow-sm">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div className="text-sm text-red-800">
              <h3 className="font-bold">Connection Error</h3>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Method 1: OAuth (Standard) */}
        <div className="bg-white p-6 shadow-sm border border-slate-200 rounded-2xl overflow-hidden relative">
            <div className="flex items-start gap-4 mb-6">
                <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
                    <Globe size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Standard Access</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Recommended for most users. Uses secure OAuth 2.0 and persists your session using a refresh token.
                    </p>
                </div>
            </div>

            <Button onClick={handleConnectOAuth} className="w-full py-3.5 text-lg flex items-center justify-center gap-2 group">
                Connect with Dropbox <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Button>

            <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Redirect URI Configuration</p>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <code className="text-[10px] text-slate-600 truncate flex-1 font-mono">{REDIRECT_URI}</code>
                            <button onClick={copyToClipboard} className="text-brand-500 hover:text-brand-700 p-1 transition-colors">
                                {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Method 2: Manual Token (Development) */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
            <button 
                onClick={() => setShowManual(!showManual)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                        <Key size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">Manual Access Token</span>
                </div>
                <ChevronRight size={18} className={`text-slate-400 transition-transform ${showManual ? 'rotate-90' : ''}`} />
            </button>

            {showManual && (
                <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        Use a temporary access token generated from your <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-brand-600 font-bold hover:underline">Dropbox Console</a>. Ideal for testing.
                    </p>
                    <form onSubmit={handleManualSubmit} className="space-y-3">
                        <Input 
                            type="password"
                            placeholder="Paste your access token here..."
                            className="text-xs font-mono"
                            value={manualToken}
                            onChange={(e) => setManualToken(e.target.value)}
                        />
                        <Button type="submit" variant="secondary" className="w-full text-xs font-bold py-2.5" disabled={!manualToken.trim()}>
                            Connect with Token
                        </Button>
                    </form>
                </div>
            )}
        </div>

        <div className="text-center pt-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">
                JACA Lib Secure Gateway
            </p>
        </div>
      </div>
    </div>
  );
};