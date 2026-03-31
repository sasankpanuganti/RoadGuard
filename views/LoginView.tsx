import React, { useState } from 'react';
import { Button } from '../components/Button';
import { User, UserRole } from '../types';

import { supabase } from '../services/supabaseClient';

interface LoginViewProps {
  onLogin?: (user: User) => void; // Optional now as AuthContext handles state
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<UserRole>(UserRole.USER);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) throw new Error("Name is required");

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: role,
              name: name
            }
          }
        });
        if (error) throw error;
        alert('Check your email for the login link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 aurora-bg z-0"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay"></div>

      {/* Abstract Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-lg px-4">
        <div className="text-center mb-12 w-full">
          <div className="inline-block mb-4 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium tracking-wider uppercase">
            Intelligent Infrastructure
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-white to-blue-200 mb-4 whitespace-nowrap overflow-visible">
            ROADGUARD
          </h1>
          <p className="text-slate-400 text-lg font-light max-w-sm mx-auto">
            AI-powered pothole detection and reporting system.
          </p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@roadguard.ai"
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setRole(UserRole.USER)}
                    className={`flex-1 py-2 rounded-xl border transition-colors ${role === UserRole.USER
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-slate-950/50 border-slate-700 text-slate-500 hover:border-slate-600'
                      }`}
                  >
                    User
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole(UserRole.ADMIN)}
                    className={`flex-1 py-2 rounded-xl border transition-colors ${role === UserRole.ADMIN
                      ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                      : 'bg-slate-950/50 border-slate-700 text-slate-500 hover:border-slate-600'
                      }`}
                  >
                    Admin
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="gradient"
              fullWidth
              isLoading={isLoading}
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>

            <div className="text-center text-sm text-slate-400 mt-4">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="hover:text-blue-400 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="absolute bottom-8 text-slate-600 text-sm">
        &copy; {new Date().getFullYear()} RoadGuard AI. All rights reserved.
      </div>
    </div>
  );
};