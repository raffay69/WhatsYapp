import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import React, { useEffect, useRef, useState } from "react"
import { Spinner } from "./ui/spinner"
import { Separator } from "./ui/separator"
import { EllipsisVertical, MessageCircleWarning, Send, TrashIcon, UserRoundPlus, UserRoundX, View } from "lucide-react"
import { Input } from "./ui/input"
import { toast } from "sonner"
import { useAuth } from "@/hooks/auth"
import axios, { AxiosError } from "axios"
import { io, Socket } from "socket.io-client"
import { supabase } from "@/lib/supabase"
import { LoaderOne } from "./ui/loader"
import { BACKEND_URL } from "@/constants"

interface UserType {
    id : string,
    name : string,
    email : string
}


interface messageType {
    id : string
    message : string
    senderId : string
    senderName : string
    createdAt : Date
    conversationId? : string
}

interface ConversationType {
    id    : string
    Members : string[]
    type     : string
    GroupName? : string ,
    GroupAdmin? : string ,
    messages : messageType[]
}

const { data : { session }} = await supabase.auth.getSession()

const socket = io( BACKEND_URL , {
    auth : {
        token : session?.access_token
    }
})

function getInitial(name : string | undefined){
    return name?.trim()?.charAt(0)?.toUpperCase() || "?"
}

function Chat() {
    const [ users , setUsers] = useState<UserType[] | null>(null)
    const [ open1 , setOpen1] = useState<boolean>(false)
    const [ open2 , setOpen2] = useState<boolean>(false)
    const [ loading , setLoading ] = useState<boolean>()
    const [ individualUser , setIndividualUser ] = useState<string>()
    const [ groupChat , setGroupChat ] = useState<string[]>([])
    const [ conversation , setConversation] = useState<ConversationType[]>([])
    const [ convoLoading , setConvoLoading ] = useState<boolean>()
    const [ chatLoading , setChatLoading ] = useState<boolean>()
    const [ chat , setChat ] = useState<ConversationType>()
    const [ selectedConvo , setSelectedConvo ] = useState<string>()
    const [ creating , setCreating ] = useState<boolean>()
    const { userId , getAccessToken , userName } = useAuth()
    const [ groupName , setGroupName ] = useState<string>() 
    const [ sendMessage , setSendMessage ] = useState<string>("")
    const [ deleteDialog , setDeleteDialog ] = useState(false)
    const [ viewDialog , setViewDialog] = useState(false)
    const [ addMembers , setAddMembers ] = useState(false)
    const [ filteredUsers , setFilteredUsers] = useState<UserType[] | null>(null)
    const [ addGroupMembers , setAddGroupMembers ] = useState<string[]>()
    const [ typing , setTyping ] = useState<{isTyping : boolean , userName : string}>()
    const [ deleting , setDeleting ] = useState<boolean>()
    const anchor = useComboboxAnchor()
    const chatRef = useRef<HTMLDivElement | null>(null)
    let timeout : NodeJS.Timeout | null = null

    useEffect(()=>{
        chatRef.current?.scrollTo({
            top : chatRef.current.scrollHeight,
            behavior : 'smooth'
        })
    },[chat?.messages , typing])

    useEffect(()=>{
        loadConverstations()
    },[])

    useEffect(()=>{
        socket.on("connect_error" , (err)=>{
            toast(err.message)
        })

        socket.on("receive_message" , ({id , message ,  sendersId , sendersName , createdAt})=>{
            //@ts-ignore
            setChat((prev)=>({ ...prev! , messages : [ ...prev?.messages , { id , senderId : sendersId, senderName : sendersName , message , createdAt }]}))
        })

        socket.on("receive_typing" , ({id , userId : receivedUserID , userName})=>{
            if(selectedConvo === id && userId != receivedUserID ){
                if(timeout) clearTimeout(timeout)
                setTyping({
                    isTyping : true,
                    userName
                })
                timeout = setTimeout(()=>{
                    setTyping({
                        isTyping : false ,
                        userName : ""
                    })
                },500)
            }
        })

        socket.on("convo_created" , (id)=>{
            if(id === userId) loadConverstations()
        })

        socket.on("gc_created" , (member)=>{
            const found = member.find((el : {id : string , name : string}) => el.id === userId)
            if(found) loadConverstations()
        })

        socket.on("convo_delete" , (id)=>{
            if(selectedConvo === id) setSelectedConvo("")
            const found = conversation.find((el)=> el.id === id)
            console.log(found)
            if(found) loadConverstations()
        })

        socket.on("gc_added" , (newMembers)=>{
            console.log(newMembers)
            const found = newMembers.find((el : { id : string , name : string})=> el.id === userId )
            if(found) loadConverstations()
        })

        socket.on("gc_removed" , ({ id , memberId})=>{
            if(selectedConvo === id && memberId === userId) setSelectedConvo("")
            if(memberId === userId) loadConverstations()
            toast("You are removed from this chat!!!!!")
        })

        return ()=>{
            socket.off("receive_message")
            socket.off("receive_typing")
            socket.off("convo_delete")
            socket.off("convo_created")
            socket.off("gc_created")
            socket.off("gc_added")
            socket.off("gc_removed")
        }
    },[selectedConvo , userId , conversation]) 

    useEffect(()=>{
        if(!selectedConvo) return
        fetchConvo()
    },[selectedConvo])

    async function fetchConvo(convoId? : string) {
        try{
            setChatLoading(true)
            const res = await axios.get(`${BACKEND_URL}/conversation/${convoId ? convoId : selectedConvo}` , {
                headers : {
                    Authorization : `Bearer ${await getAccessToken()}`
                }
            })
            setChat(res.data)
        } catch(e){
            toast("Failed to load this conversation. Please try again.")
        } finally {
            setChatLoading(false)
        }
    }

    async function loadConverstations() {
        try{
            setConvoLoading(true)
            const res = await axios.get<ConversationType[]>(`${BACKEND_URL}/conversations` , {
                headers : {
                    Authorization : `Bearer ${await getAccessToken()}`
                }
            })
            setConversation(res.data)
        } catch(e){
            toast("Failed to load your conversations. Please try again.")
        } finally {
            setConvoLoading(false)
        }
    }

    async function loadUsers(type : "add" | "none"){
        try{
            setLoading(true)
            const res = await axios.get<UserType[]>(`${BACKEND_URL}/users` , {
                headers : {
                    Authorization : `Bearer ${await getAccessToken()}`
                }
            })
            setUsers(res.data)

            if(type === "add"){
                const filtered = []
                const gcMembers = chat?.Members.map((el)=> JSON.parse(el)).map((el)=> el.id) || []
                for(let user of res.data!){
                    if(!gcMembers.includes(user.id)){
                        filtered.push(user)
                    }
                }
                console.log(filtered)
                setFilteredUsers(filtered)
            }
        } catch(e){
            toast("Failed to load users. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    async function createChat() {
        try{
            setCreating(true)
            const parsedData = JSON.parse(individualUser!)
            const res = await axios.post(`${BACKEND_URL}/create/single` , parsedData , {
                headers : {
                    Authorization : `Bearer ${await getAccessToken()}`
                }
            })
            if(res.status === 200){
                toast("Chat Created")
                setOpen1(false)
                loadConverstations()
                return
            }
        } catch(e){
            if(e instanceof AxiosError){
                if(e.response?.data.message === "chat_exists"){
                    toast("This Chat already exists")
                } else {
                    toast("Failed to create chat. Please try again.")
                }
            } else {
                toast("Something went wrong. Please try again.")
            }
        } finally {
            setCreating(false)
            setIndividualUser("")
        }
    }

    async function createGroupChat() {
        try{
            setCreating(true)
            const res = await axios.post(`${BACKEND_URL}/create/group` , {
                groupName , member : groupChat
            }, {
                headers : {
                    Authorization : `Bearer ${await getAccessToken()}`
                }
            })
            toast("Group Chat Created")
            loadConverstations()
            setOpen2(false)
        } catch(e){
            toast("Failed to create group chat. Please try again.")
        } finally {
            setCreating(false)
            setGroupChat([])
            setGroupName("")
        }
    }

    async function removeMember(id : string , memberId : string){
        try{
            const res = await axios.post(`${BACKEND_URL}/member/remove` , {
                id , memberId
            } , {
                headers : {
                    Authorization : `Bearer ${await getAccessToken()}`
                }
            })

            if(res.status === 200){
                toast("member removed")
                fetchConvo(id)
            }
        } catch(e){
            toast("Failed to remove member. Please try again.")
        }
    }

    async function addMember(id : string) {
        try{
            setCreating(true)
            await axios.post(`${BACKEND_URL}/member/add` , {
                id , newMembers : addGroupMembers
            },{
                headers : {
                    Authorization : `Bearer ${await getAccessToken()}`
                }
            })
            toast("member added")
            fetchConvo(id)
            setAddGroupMembers([])
            setAddMembers(false)
        } catch(e){
            toast("Failed to add member. Please try again.")
        } finally {
            setCreating(false)
        }
    }

    async function deleteChat(id:string|undefined) {
        try{
            setDeleting(true)
            await axios.delete(`${BACKEND_URL}/conversation/${id}` , {
                headers : {
                    Authorization : `Bearer ${await getAccessToken()}`
                }
            })
            setDeleteDialog(false)
            toast("Conversation Deleted Successfully")
            loadConverstations()
        } catch(e){
            toast("Failed to delete conversation. Please try again.")
        } finally {
            setDeleting(false)
        }
    }

    function joinConvo(id : string){
        setSelectedConvo(id)
        socket.emit("join_convo" , id)
    }

    function sendingMessage(conversationId : string , sendersId : string , sendersName : string){
        if(!sendMessage.trim()) return
        setTyping({
            isTyping : false,
            userName : ""
        })
        socket.emit("sent_message" , {conversationId , message : sendMessage , sendersId , sendersName})
        setSendMessage("")
    }


  return (
    <div className="h-screen w-screen flex justify-center items-center bg-stone-100">
        <div className="w-[1500px] h-[700px] rounded-2xl border border-stone-200 bg-white shadow-sm flex flex-col overflow-hidden">
            {/* app header */}
            <div className="flex items-center gap-2 px-6 py-4 border-b border-stone-200 shrink-0">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="font-semibold tracking-tight text-stone-900">WhatsYapp</span>
            </div>

            <div className="flex flex-1 min-h-0">
            <div className="border-r border-stone-200 grow flex flex-col min-h-0">
                <div className="flex gap-2 m-4">
                    <Dialog open={open1} onOpenChange={setOpen1}>
                            <DialogTrigger asChild>
                            <Button size="sm" className="rounded-full" onClick={()=>loadUsers("none")}>Create Chat</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-sm rounded-2xl">
                            <DialogHeader>
                                <DialogTitle>Select User to start a chat</DialogTitle>
                            </DialogHeader>
                            <Select value={individualUser} onValueChange={(value)=>setIndividualUser(value)}>
                                {loading ? <Spinner className="mx-auto mt-5 mb-5" fontSize={8}/> : 
                                <>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a User" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users?.length! > 0 ? 
                                        users?.map((el)=>
                                            <SelectItem value={JSON.stringify({id : el.id , name : el.name})}>{el.name}</SelectItem>
                                        )
                                        :
                                        <SelectGroup>
                                            <SelectLabel>No Users Available</SelectLabel>
                                        </SelectGroup>
                                    }
                                </SelectContent>
                                </>
                                }
                                </Select>
                            <DialogFooter>
                                <DialogClose asChild>
                                <Button variant="outline" className="rounded-full" onClick={()=>setIndividualUser("")}>Cancel</Button>
                                </DialogClose>
                                <Button type="submit" className="rounded-full" onClick={createChat} disabled={loading || !individualUser}>{creating ? <Spinner fontSize={3} /> : "Create Chat"}</Button>
                            </DialogFooter>
                            </DialogContent>
                    </Dialog>

                    <Dialog modal={false} open={open2} onOpenChange={setOpen2}>
                            <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="rounded-full" onClick={()=>loadUsers("none")}>Create Group Chat</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-sm rounded-2xl">
                            <DialogHeader>
                                <DialogTitle>Enter Group Chats name</DialogTitle>
                            </DialogHeader>    
                            <Input className="rounded-full" value={groupName} onChange={(e)=> setGroupName(e.target.value)} placeholder="9/11 flight crew..."/>
                            <DialogHeader>
                                <DialogTitle>Select Users to start a Group chat</DialogTitle>
                            </DialogHeader>
                            {loading ? <Spinner className="mx-auto mt-5 mb-5" fontSize={8}/> : 
                            <Combobox
                                multiple
                                autoHighlight
                                value={groupChat}
                                onValueChange={(value)=>setGroupChat(value)}
                                items={users ?? []}
                                >
                                <ComboboxChips ref={anchor} className="w-full max-w-xs rounded-xl">
                                    <ComboboxValue>
                                    {(values) => (
                                        <React.Fragment>
                                        {values.map((value : { id :string , name : string}) => (
                                            <ComboboxChip key={value.id}>{value.name}</ComboboxChip>
                                        ))}
                                        <ComboboxChipsInput />
                                        </React.Fragment>
                                    )}
                                    </ComboboxValue>
                                </ComboboxChips>
                                <ComboboxContent anchor={anchor}>
                                    <ComboboxEmpty>No Users Available.</ComboboxEmpty>
                                    <ComboboxList>
                                    {(item) => (
                                        <ComboboxItem key={item.id} value={item}>
                                        {item.name}
                                        </ComboboxItem>
                                    )}
                                    </ComboboxList>
                                </ComboboxContent>
                                </Combobox>
                                }
                            <DialogFooter>
                                <DialogClose asChild>
                                <Button variant="outline" className="rounded-full" onClick={()=>{
                                    setGroupName("")
                                    setGroupChat([])
                                }}>Cancel</Button>
                                </DialogClose>
                                <Button type="submit" className="rounded-full" onClick={createGroupChat} disabled={loading || groupChat?.length == 0}>{creating ? <Spinner fontSize={3}/> : "Create Group Chat"}</Button>
                            </DialogFooter>
                            </DialogContent>
                    </Dialog>

                    <Dialog modal={true} open={deleteDialog} onOpenChange={(open)=>setDeleteDialog(open)}>
                        <DialogContent className="sm:max-w-sm rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Delete This Chat?</DialogTitle>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                            <Button variant="outline" className="rounded-full">Cancel</Button>
                            </DialogClose>
                            <Button variant="destructive" className="rounded-full" onClick={()=>deleteChat(chat?.id)}>{deleting ? <Spinner fontSize={3} /> : "Delete"}</Button>
                        </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={viewDialog} onOpenChange={(open)=>setViewDialog(open)}>
                        <DialogContent className="sm:max-w-sm rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>{chat?.GroupName}</DialogTitle>
                        </DialogHeader>
                        <DialogDescription>
                            {chat?.Members.length} Members
                        </DialogDescription>
                        {chat?.Members.map((el)=> JSON.parse(el)).map((el)=> (
                            <Item variant="muted" size="xs" className="rounded-xl">
                                <ItemMedia>
                                    <div className="h-8 w-8 shrink-0 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-medium">
                                        {getInitial(el.name)}
                                    </div>
                                </ItemMedia>
                                <ItemContent>
                                <ItemTitle>
                                        <p>{el.name}</p>
                                    </ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                    <p className="text-xs text-stone-500">{el.id === chat.GroupAdmin && "admin"}</p>
                                    <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="destructive" size="xs" className="rounded-full" disabled={el.id === chat.GroupAdmin} onClick={()=> removeMember(chat.id , el.id)}>
                                            <UserRoundX />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Remove Member</p>
                                    </TooltipContent>
                                    </Tooltip>
                                </ItemActions>
                            </Item>
                        ))}
                        </DialogContent>
                    </Dialog>


                    <Dialog modal={false} open={addMembers} onOpenChange={setAddMembers}>
                        <DialogContent className="sm:max-w-sm rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Add Members to {chat?.GroupName}</DialogTitle>
                        </DialogHeader>
                        {loading ? <Spinner className="mx-auto mt-5 mb-5" fontSize={8}/> : 
                        <Combobox
                            multiple
                            autoHighlight
                            value={addGroupMembers}
                            onValueChange={(value)=>setAddGroupMembers(value)}
                            items={filteredUsers ?? []}
                            >
                            <ComboboxChips ref={anchor} className="w-full max-w-xs rounded-xl">
                                <ComboboxValue>
                                {(values) => (
                                    <React.Fragment>
                                    {values.map((value : { id :string , name : string}) => (
                                        <ComboboxChip key={value.id}>{value.name}</ComboboxChip>
                                    ))}
                                    <ComboboxChipsInput />
                                    </React.Fragment>
                                )}
                                </ComboboxValue>
                            </ComboboxChips>
                            <ComboboxContent anchor={anchor}>
                                <ComboboxEmpty>No Users Available.</ComboboxEmpty>
                                <ComboboxList>
                                {(item) => (
                                    <ComboboxItem key={item.id} value={item}>
                                    {item.name}
                                    </ComboboxItem>
                                )}
                                </ComboboxList>
                            </ComboboxContent>
                            </Combobox>
                            }
                        <DialogFooter>
                            <DialogClose asChild>
                            <Button variant="outline" className="rounded-full" onClick={()=> setAddGroupMembers([])}>Cancel</Button>
                            </DialogClose>
                            <Button type="submit" className="rounded-full" onClick={()=>addMember(chat?.id!)} disabled={loading || addGroupMembers?.length == 0}>{creating ? <Spinner fontSize={3}/> : "Add Members"}</Button>
                        </DialogFooter>
                        </DialogContent>
                    </Dialog>

                </div>
                {/* side bar */}
                <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
                    {convoLoading ? 
                    <div className="flex justify-center items-center mt-[300px]">
                        <Spinner/>
                    </div>
                     :
                    conversation.length === 0 ? 
                    <div className="flex flex-col justify-center items-center mt-[260px] text-stone-400 gap-1">
                        <MessageCircleWarning className="h-5 w-5" />
                        <h2 className="text-sm">No conversations yet</h2>
                    </div> : 
                    <div>
                        <ItemGroup className="gap-1">
                            {conversation.map((el) => (
                            <Item key={el.id} variant="outline" asChild role="listitem" onClick={()=>joinConvo(el.id)} className={`rounded-xl border-transparent cursor-pointer transition-colors hover:bg-stone-50 ${selectedConvo === el.id ? "bg-emerald-50" : ""}`}>
                                <a>
                                <ItemMedia>
                                    <div className="h-9 w-9 shrink-0 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center text-sm font-medium">
                                        {getInitial(el.type === "Single" ? el.Members.map((elem)=> JSON.parse(elem)).filter((el)=> el.id != userId)[0]?.name : el.GroupName)}
                                    </div>
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle className="line-clamp-1 text-stone-900">
                                    {el.type === "Single" ? el.Members.map((elem)=> JSON.parse(elem)).filter((el)=> el.id != userId)[0].name : el.GroupName}
                                    </ItemTitle>
                                <ItemDescription className="line-clamp-1 text-stone-500">{el.messages[0]?.message}</ItemDescription>
                                </ItemContent>
                                </a>
                            </Item>
                            ))}
                        </ItemGroup>
                    </div>
                    }
                </div>
            </div>
            {/* chat section */}
            { selectedConvo ? 
            <div className="grow-40 flex flex-col min-h-0">
                <div className="flex justify-between items-center px-6 py-4 shrink-0">
                    <div className="font-medium text-stone-900">{chatLoading ? "Loading..." : chat?.type === "Single" ? chat.Members.map((el)=> JSON.parse(el)).filter((el)=> el.id != userId)[0].name : chat?.GroupName}</div>
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="rounded-full"><EllipsisVertical/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="rounded-xl">
                            <DropdownMenuGroup>
                            {chat?.type === "Group" && 
                            <>
                            <DropdownMenuItem onClick={()=>setViewDialog(true)}>
                                <View/>
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>{
                                loadUsers("add")
                                setAddMembers(true)}}>
                                <UserRoundPlus />
                                Add Members
                            </DropdownMenuItem>
                            </>
                            }
                            <DropdownMenuItem variant="destructive" onSelect={(e)=>setDeleteDialog(true)}>
                                <TrashIcon/>
                                Delete
                            </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                        </DropdownMenu>
                </div>
                <Separator/>
                <div className="flex-1 min-h-0 flex flex-col justify-between">
                    <div ref={chatRef} className="flex-1 min-h-0 overflow-y-auto">
                    {chatLoading ? <div className="flex justify-center mt-[200px]"><Spinner/></div> :
                     chat?.messages.length === 0 ? 
                     <div className="flex justify-center mt-[200px] text-stone-400 text-sm">Start a conversation</div> :
                     <div>
                        <ItemGroup className="flex flex-col gap-2 w-full p-4">
                        {chat?.messages.map((el) => (
                            <div
                            key={el.id}
                            className={`flex w-full ${
                                el.senderId === userId
                                ? "justify-end"
                                : "justify-start"
                            }`}
                            >
                            <Item
                                variant="muted"
                                className={`max-w-[70%] border-none rounded-2xl ${
                                el.senderId === userId ? "bg-emerald-600 text-white rounded-br-sm" : "bg-stone-100 text-stone-900 rounded-bl-sm"
                                }`}
                            >
                                <ItemContent>
                                <ItemTitle>
                                    <div className="flex flex-col gap-1">
                                    {chat.type === "Group" && <p className={`text-xs ${el.senderId === userId ? "text-emerald-100 text-right" : "text-stone-500 text-left"}`}>{el.senderName}</p>}
                                    <p className="whitespace-pre-wrap break-words">{el.message}</p>
                                    </div>
                                </ItemTitle>
                                </ItemContent>
                            </Item>
                            </div>
                        ))}
                        {typing?.isTyping && 
                            <Item
                                variant="muted"
                                className="w-17 border-none rounded-2xl bg-stone-100"
                            >
                                <ItemContent>
                                <ItemTitle>
                                    <div className="flex flex-col gap-1">
                                    {chat?.type === "Group" && <p className={`text-xs text-stone-500 text-left}`}>{typing.userName}</p>}
                                    <LoaderOne/>
                                    </div>
                                </ItemTitle>
                                </ItemContent>
                            </Item>
                        }
                        </ItemGroup>
                        
                     </div>
                    }
                    </div>
                    <div className="flex items-center gap-2 p-4 shrink-0">
                        <Input className="rounded-full" value={sendMessage} onChange={(e)=>{
                            socket.emit("typing" , { id : chat?.id , userId , userName})
                            setSendMessage(e.target.value)}}
                            onKeyDown={(e)=>{
                                if(e.key === "Enter"){
                                    sendingMessage(chat?.id! , userId! , userName )
                                }
                            }}
                            placeholder="Type a message"
                            />
                        <Button size="icon" className="rounded-full shrink-0 bg-emerald-600 hover:bg-emerald-700" disabled={chatLoading || !sendMessage.trim()}  onClick={()=>sendingMessage(chat?.id! , userId! , userName )}
                        ><Send/></Button>
                    </div>
                </div>
            </div>
            : <div className="grow-40 flex">
                <Empty className="border-none">
                    <EmptyHeader>
                        <EmptyMedia variant="icon" className="bg-stone-100 text-stone-400">
                        <MessageCircleWarning />
                        </EmptyMedia>
                        <EmptyTitle className="text-stone-900">No Chat Selected</EmptyTitle>
                        <EmptyDescription className="text-stone-500">
                        Select a chat to start chatting
                        </EmptyDescription>
                    </EmptyHeader>
                    </Empty>
            </div>}
            </div>
        </div>
    </div>
  )
}

export default Chat