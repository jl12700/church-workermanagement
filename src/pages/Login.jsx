import React from 'react'
import Topbar from '../layout/topbar'
import { useNavigate } from 'react-router-dom'

const Login = () => {
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();

        navigate('/dashboard');
    };

return (
    <div className='bg-linear-to-b from-[#1b2430] to-[#121820] min-h-screen flex flex-col'>
    {/*forms*/}
    <Topbar/>
    <div className='bg-linear-to-b from-[#1b2430] to-[#121820] flex-1  flex justify-center items-center'>
    <form className='bg-white space-y-3 rounded-lg w-[400px] h-[400px] flex justify-center flex-col items-center' action="" onSubmit={handleLogin}>
        <div className='text-4xl font-bold mb-8'>
            <p>Login</p>
        </div>
        <div>
            <p class='text-sm font-bold mb-1.5'>Email:</p>
            <input className='w-[300px] focus:shadow-md h-10 rounded-lg px-2 flex outline-none border border-black shadow-black' type='text' placeholder='Enter your Email'></input>
        </div>
        <div>
            <p class='text-sm font-bold mb-1.5'>Password:</p>
            <input className='w-[300px] focus:shadow-md h-10 rounded-lg px-2 flex outline-none border border-black shadow-black'type='password' placeholder='Enter your Password'></input>
        </div>
        <div className='flex flex-col space-y-2'>
            <button className='bg-blue-400 shadow rounded-lg px-4  h-10 text-white font-bold hover:bg-blue-500 w-[300px]'>Login</button>
            <a className='text-black underline hover:text-red-500 hover:underline' href=''>Forgot Password?</a>
        </div>
        <div>
        </div>
        
    </form>
    </div>
    </div>
)
}

export default Login