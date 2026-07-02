import { supabase } from "@/lib/supabase"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { useState } from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router"
import { Spinner } from "./ui/spinner"
import { useAuth } from "@/hooks/auth"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./ui/empty"
import { Icon, Inbox, MailCheck, RefreshCcwIcon } from "lucide-react"

function Login() {
    const [ email , setEmail] = useState<string>()
    const [ password , setPassword ] = useState<string>()
    const [ confirmEmail , setConfirmEmail] = useState<boolean>(false)
    const { userId , loading} = useAuth()
    const navigate = useNavigate()

    async function signUp() {
        if(!email || !password){
            toast("Enter both email and password")
            return
        }
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        })

        if(data.user){
            setConfirmEmail(true)
        }
        
        if(error){
            toast(error.message)
            return
        }
    }

    async function login() {
        if(!email || !password){
            toast("Enter both email and password")
            return
        }
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if(data.user){
            toast("Welcome")
            navigate("/chat")
        }
        
        if(error){
            toast(error.message)
            return
        }
    }

    async function signOut() {
        const data = await supabase.auth.signOut()
        if(data.error){
            toast(data.error.message)
            return
        }
        toast("Signed Out")
    }

    if(loading){
        return <div className="w-screen h-screen flex justify-center items-center bg-stone-100">
            <Spinner/>
        </div>
    }

  return (
    <div className='w-screen h-screen flex justify-center items-center bg-stone-100'>
        {!userId ?
        confirmEmail ? 
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white shadow-sm p-8">
            <div className="flex flex-col items-center gap-2 mb-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h1 className="font-semibold tracking-tight text-stone-900 text-lg">WhatsYapp</h1>
            </div>

            <Empty>
                <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-emerald-50 text-emerald-600">
                    <MailCheck />
                </EmptyMedia>
                <EmptyTitle>Verify your email</EmptyTitle>
                <EmptyDescription className="text-pretty text-stone-500">
                    We sent a verification link to{" "}
                    <span className="font-medium text-stone-900">{email}</span>. Click the
                    link to activate your account.
                </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                <Button variant="outline" onClick={() => setConfirmEmail(false)}>
                    Back to login
                </Button>
                </EmptyContent>
            </Empty>
            </div>
        :
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white shadow-sm p-8">
            <div className="flex flex-col items-center gap-2 mb-8">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h1 className="font-semibold tracking-tight text-stone-900 text-lg">WhatsYapp</h1>
                <p className="text-sm text-stone-500 text-center">Sign in to keep the conversation going</p>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-stone-500 px-1">Email</label>
                    <Input
                        className="rounded-full"
                        type="email"
                        placeholder="you@example.com"
                        value={email ?? ""}
                        onChange={(e)=>setEmail(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-stone-500 px-1">Password</label>
                    <Input
                        className="rounded-full"
                        type="password"
                        placeholder="Enter password"
                        value={password ?? ""}
                        onChange={(e)=>setPassword(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2 mt-6">
                <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={login}>Login</Button>
                <Button variant="outline" className="rounded-full" onClick={signUp}>Create Account</Button>
            </div>
        </div>
        :
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white shadow-sm p-8 flex flex-col items-center gap-4 text-center">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <h1 className="font-semibold tracking-tight text-stone-900 text-lg">WhatsYapp</h1>
            <p className="text-sm text-stone-500">You're signed in</p>
            <Button variant="outline" className="rounded-full w-full" onClick={signOut}>Sign Out</Button>
            <Button variant="default" className="rounded-full w-full" onClick={()=> navigate("/chat")}>Start Yapping</Button>
        </div> 
        }
        
    </div>
  )
}

export default Login