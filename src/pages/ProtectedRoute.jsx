import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../database/supabase';

const ProtectedRoute = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          setSession(null);
        } else {
          setSession(session);
        }
      } catch (error) {
        console.error('Session check failed:', error);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        // Clear any cached data
        localStorage.clear();
        sessionStorage.clear();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session);
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show loading spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if no session
  if (!session) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;