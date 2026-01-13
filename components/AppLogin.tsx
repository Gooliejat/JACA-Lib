import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Lock } from 'lucide-react';

interface AppLoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onResetToken: () => void;
}

export const AppLogin: React.FC<AppLoginProps> = ({ onLogin, onResetToken }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-full shadow-sm">
                <Lock className="w-8 h-8 text-brand-600" />
            </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" isLoading={loading}>
              Sign In
            </Button>
            
            <div className="mt-4 border-t pt-4 text-center">
                <button 
                  type="button"
                  onClick={onResetToken} 
                  className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
                >
                  Switch Dropbox Account
                </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};