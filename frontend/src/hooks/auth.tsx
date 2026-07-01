import { supabase } from "@/lib/supabase";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthContextType{
    userId : string | null,
    loading : boolean, 
    userName : string,
    getAccessToken : () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({children} : {children : ReactNode}){
    const [ userId , setUserId] = useState<string | null>(null)
    const [ loading , setLoading ] = useState<boolean>(true)
    const [ userName , setUserName ] = useState<string>("")
    
    useEffect(()=>{
        async function main() {
            const { data : {session} , error} = await supabase.auth.getSession()
            setUserId(session?.user.id! || null)
            setUserName(session?.user.email?.split("@")[0] || "no_name")
            setLoading(false)
        }

        main()
        
        const { data } = supabase.auth.onAuthStateChange(( e, session)=>{
            setUserId(session?.user.id || null)
        })

        return ()=>{
            data.subscription.unsubscribe()
        }
        
    },[])

    async function getAccessToken(){
        const { data : {session} , error} = await supabase.auth.getSession()
        return session?.access_token || null
    }


    return (
        <AuthContext.Provider value={{userId , loading , userName , getAccessToken}}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(){
    const context = useContext(AuthContext)
    if(!context) throw Error("useAuth must be within AuthProvider")
    return context
}
