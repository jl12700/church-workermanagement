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
      
      <div className='flex-1 flex justify-center items-center px-4'>
        <div className='w-full max-w-[400px]'>
          
          <form 
            className='bg-white space-y-3 rounded-2xl w-full p-8 shadow-2xl relative' 
            onSubmit={handleLogin}
          >
            

            <div className='text-center mb-6'>
              <h1 className='text-4xl font-bold text-gray-800'>Login</h1>
              <p className='text-sm text-gray-500 mt-2 font-medium uppercase tracking-wider'>Admin Access</p>
            </div>

            {error && (
              <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4'>
                {error}
              </div>
            )}

            <div>
              <label className='block text-sm font-bold mb-1.5 text-gray-700'>Email:</label>
              <input 
                className='w-full focus:shadow-md h-11 rounded-xl px-3 outline-none border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all' 
                type='email' 
                placeholder='Enter your Email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className='block text-sm font-bold mb-1.5 text-gray-700'>Password:</label>
              <div className='relative'>
                <input 
                  className='w-full focus:shadow-md h-11 rounded-xl px-3 pr-10 outline-none border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all' 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder='Enter your Password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                >
                  {showPassword ? (
                  
                    <svg className=" cursor-pointer w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    
                    <svg className=" cursor-pointer w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className='flex flex-col space-y-2 pt-4'>
              <button 
                type='submit'
                className='cursor-pointer bg-blue-600 shadow-lg rounded-xl h-11 text-white font-bold hover:bg-blue-700 w-full transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2'
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </div>

            <div className='mt-6 pt-6 border-t border-gray-100'>
              <div className='flex items-start gap-2 text-xs text-gray-400'>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;