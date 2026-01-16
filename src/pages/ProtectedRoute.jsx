import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../database/supabase';

const ProtectedRoute = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

 
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!session) {
  
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;