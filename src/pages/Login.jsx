

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../layout/topbar';
import { supabase } from '../database/supabase';

const Login = () => {
  const navigate = useNavigate();
  

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

 
  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
     
      navigate('/dashboard');
    }
  };


  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
     
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (signInError) {
        throw signInError;
      }

     
      const userRole = data.user?.user_metadata?.role;
      
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('role')
        .eq('user_id', data.user.id)
        .single();

     
      const isAdmin = userRole === 'admin' || adminData?.role === 'admin' || adminData?.role === 'super_admin';

      if (!isAdmin) {
       
        await supabase.auth.signOut(); 
        setError('Access denied. This account does not have admin privileges.');
        setLoading(false);
        return;
      }

      navigate('/dashboard');

    } catch (err) {
      console.error('Login error:', err);
      
   
      if (err.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (err.message.includes('Email not confirmed')) {
        setError('Please verify your email address before logging in.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

 
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      alert('Password reset link sent! Please check your email.');
    } catch (err) {
      console.error('Password reset error:', err);
      setError('Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='bg-gradient-to-b from-[#1b2430] to-[#121820] min-h-screen flex flex-col'>
      <Topbar />
      
      <div className='bg-gradient-to-b from-[#1b2430] to-[#121820] flex-1 flex justify-center items-center px-4'>
        <form 
          className='bg-white space-y-3 rounded-lg w-full max-w-[400px] p-8 shadow-2xl' 
          onSubmit={handleLogin}
        >
          <div className='text-center mb-6'>
            <h1 className='text-4xl font-bold text-gray-800'>Login</h1>
            <p className='text-sm text-gray-500 mt-2'>Admin Access Only</p>
          </div>

         
          {error && (
            <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm'>
              <div className='flex items-start gap-2'>
                <svg className='w-5 h-5 flex-shrink-0 mt-0.5' fill='currentColor' viewBox='0 0 20 20'>
                  <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' clipRule='evenodd' />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

         
          <div>
            <label className='block text-sm font-bold mb-1.5 text-gray-700'>
              Email:
            </label>
            <input 
              className='w-full focus:shadow-md h-10 rounded-lg px-3 outline-none border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all' 
              type='email' 
              placeholder='Enter your Email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete='email'
              required
            />
          </div>

        
          <div>
            <label className='block text-sm font-bold mb-1.5 text-gray-700'>
              Password:
            </label>
            <div className='relative'>
              <input 
                className='w-full focus:shadow-md h-10 rounded-lg px-3 pr-10 outline-none border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all' 
                type={showPassword ? 'text' : 'password'} 
                placeholder='Enter your Password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete='current-password'
                required
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700'
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' />
                  </svg>
                ) : (
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
                  </svg>
                )}
              </button>
            </div>
          </div>

      
          <div className='flex flex-col space-y-2 pt-2'>
            <button 
              type='submit'
              className='bg-blue-500 shadow-lg rounded-lg px-4 h-10 text-white font-bold hover:bg-blue-600 w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className='animate-spin h-5 w-5' fill='none' viewBox='0 0 24 24'>
                    <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                    <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
                  </svg>
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
            
            <button
              type='button'
              onClick={handleForgotPassword}
              className='text-blue-600 hover:text-red-500 hover:underline text-sm font-medium transition-colors'
              disabled={loading}
            >
              Forgot Password?
            </button>
          </div>

         
          <div className='mt-6 pt-6 border-t border-gray-200'>
            <div className='flex items-start gap-2 text-xs text-gray-500'>
              <svg className='w-4 h-4 flex-shrink-0 mt-0.5' fill='currentColor' viewBox='0 0 20 20'>
                <path fillRule='evenodd' d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z' clipRule='evenodd' />
              </svg>
              <p>Only authorized personnel with admin credentials can access this system.</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;