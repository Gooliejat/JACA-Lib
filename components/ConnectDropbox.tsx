import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ExternalLink, HelpCircle } from 'lucide-react';

interface ConnectDropboxProps {
  onConnect: (token: string) => void;
  error?: string;
}

export const ConnectDropbox: React.FC<ConnectDropboxProps> = ({ onConnect, error }) => {
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      onConnect(token.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
             <div className="h-16 w-16 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-white" stroke="currentColor" strokeWidth="2">
                   <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
             </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connect to DropBase
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your Dropbox Access Token to access your database.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <Input
                label="Dropbox Access Token"
                type="password"
                placeholder="sl.B7..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              <div className="mt-2 text-xs text-gray-500 flex items-start gap-1">
                 <HelpCircle size={14} className="mt-0.5" /> 
                 <span>
                    Don't have a token? Go to the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-500 font-medium inline-flex items-center">Dropbox App Console <ExternalLink size={10} className="ml-0.5"/></a>, create an app (Scoped Access), and generate an Access Token.
                 </span>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Button type="submit" className="w-full" isLoading={false}>
                Connect to Dropbox
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
