import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { Header } from './components/Header';
import { LoginView } from './views/LoginView';
import { UserDashboard } from './views/UserDashboard';
import { AdminDashboard } from './views/AdminDashboard';
import { Modal } from '@/components/Modal';
import { Button } from './components/Button';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const { user } = session;
        setCurrentUser({
          id: user.id,
          name: user.user_metadata.name || 'User',
          email: user.email || '',
          role: (user.user_metadata.role as UserRole) || UserRole.USER
        });
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const { user } = session;
        setCurrentUser({
          id: user.id,
          name: user.user_metadata.name || 'User',
          email: user.email || '',
          role: (user.user_metadata.role as UserRole) || UserRole.USER
        });
      } else {
        setCurrentUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setCurrentUser(null);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser && editName.trim()) {
      try {
        const { error } = await supabase.auth.updateUser({
          data: { name: editName }
        });

        if (error) throw error;

        // Optimistic update
        setCurrentUser({ ...currentUser, name: editName });
        setIsProfileOpen(false);
      } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100">
      {currentUser && (
        <Header
          user={currentUser}
          onLogout={handleLogout}
          onProfileClick={() => {
            setEditName(currentUser.name);
            setIsProfileOpen(true);
          }}
        />
      )}

      <main>
        {!currentUser ? (
          <LoginView />
        ) : currentUser.role === UserRole.ADMIN ? (
          <AdminDashboard />
        ) : (
          <UserDashboard user={currentUser} />
        )}
      </main>

      {/* Profile Edit Modal */}
      {currentUser && (
        <Modal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          title="Edit Profile"
        >
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full flex items-center justify-center border-4 border-slate-900 shadow-xl">
                <span className="text-3xl font-bold text-slate-400">
                  {editName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email ID</label>
              <input
                type="text"
                value={currentUser.email}
                disabled
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-600 mt-2">Email cannot be changed.</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setIsProfileOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gradient"
                fullWidth
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default App;