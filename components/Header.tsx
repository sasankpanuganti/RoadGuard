import React from 'react';
import { APP_NAME } from '../constants';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => Promise<void> | void;
  onProfileClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onProfileClick }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="RoadGuard AI Logo"
            className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-blue-900/20"
          />
          <h1 className="text-xl font-bold text-white tracking-tight">{APP_NAME}</h1>
        </div>

        {user && (
          <div className="flex items-center gap-6">
            <div
              className="hidden sm:flex items-center gap-2 text-sm text-slate-400 hover:bg-slate-800/50 py-1.5 px-3 rounded-lg cursor-pointer transition-colors"
              onClick={onProfileClick}
              role="button"
              title="Edit Profile"
            >
              <div className="flex flex-col items-end">
                <span className="text-slate-200 font-medium leading-none mb-1">{user.name}</span>
                <span className="text-blue-400 uppercase text-[10px] tracking-wider font-bold leading-none">{user.role}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};