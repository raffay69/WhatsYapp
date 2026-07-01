import { Navigate, Outlet } from 'react-router'
import { Spinner } from './ui/spinner';
import { useAuth } from '@/hooks/auth';

function RouteGuard() {
    const { userId , loading } = useAuth()

    if(loading){
        return <div className='h-screen w-screen flex justify-center items-center'>
            <Spinner/>
        </div>
    }

    if(!userId){
        return <Navigate to={"/"}/>
    }

  return (
        <Outlet/>
  )
}

export default RouteGuard