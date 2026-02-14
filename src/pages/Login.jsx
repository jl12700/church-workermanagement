import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../layout/Topbar';
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
    if (session) navigate('/dashboard');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (signInError) throw signInError;

      const { data: adminData } = await supabase
        .from('admins')
        .select('role')
        .eq('user_id', data.user.id)
        .single();

      const isAdmin = data.user?.user_metadata?.role === 'admin' || adminData?.role === 'admin' || adminData?.role === 'super_admin';

      if (!isAdmin) {
        await supabase.auth.signOut(); 
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message.includes('Invalid') ? 'Invalid email or password.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='bg-gradient-to-b from-[#1b2430] to-[#121820] min-h-screen flex flex-col'>
      <Topbar />
      
      <div className='flex-1 flex justify-center items-center px-4 py-8'>
        <div className='w-full max-w-[440px]'>
          
          <form 
            className='bg-white rounded-2xl w-full p-10 shadow-2xl relative overflow-hidden' 
            onSubmit={handleLogin}
          >
            {/* Subtle decorative element - maintains brand colors */}
            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600'></div>

            {/* Header Section - Improved hierarchy */}
            <div className='text-center mb-8'>
              <h1 className='text-3xl font-bold text-gray-800 mb-2'>
                Event Management System
              </h1>
              <p className='text-xs text-gray-500 font-semibold uppercase tracking-widest'>
                Authorized Access Only
              </p>
            </div>

            {/* Error Message - Enhanced visibility */}
            {error && (
              <div className='bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3.5 rounded-r-lg text-sm mb-6 flex items-start gap-3 animate-slideIn'>
                <svg className='w-5 h-5 flex-shrink-0 mt-0.5' fill='currentColor' viewBox='0 0 20 20'>
                  <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' clipRule='evenodd' />
                </svg>
                <span className='flex-1'>{error}</span>
              </div>
            )}

            {/* Form Fields - Improved spacing and visual clarity */}
            <div className='space-y-5'>
              <div>
                <label 
                  htmlFor='email' 
                  className='block text-sm font-semibold mb-2 text-gray-700'
                >
                  Email Address
                </label>
                <input 
                  id='email'
                  className='w-full h-12 rounded-xl px-4 outline-none border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-200 text-gray-800 placeholder-gray-400' 
                  type='email' 
                  placeholder='Enter your Email Address'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete='email'
                />
              </div>

              <div>
                <label 
                  htmlFor='password' 
                  className='block text-sm font-semibold mb-2 text-gray-700'
                >
                  Password
                </label>
                <div className='relative'>
                  <input 
                    id='password'
                    className='w-full h-12 rounded-xl px-4 pr-12 outline-none border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-200 text-gray-800 placeholder-gray-400' 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder='Enter your password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete='current-password'
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:text-blue-600'
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
            </div>

            {/* Submit Button - Enhanced prominence */}
            <div className='mt-8'>
              <button 
                type='submit'
                className='cursor-pointer w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base'
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className='animate-spin h-5 w-5' viewBox='0 0 24 24'>
                      <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' fill='none' />
                      <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>

            {/* Footer - Cleaner spacing */}
            <div className='mt-8 pt-6 border-t border-gray-100 text-center'>
              <p className='text-xs text-gray-400'>
                © {new Date().getFullYear()} JCTGBTG-LIPA
              </p>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Login;