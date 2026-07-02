import express from "express"
import cors from "cors"
import { authMiddleware } from "./middleware.ts"
import { prisma } from "./utils/prisma.ts"
import { Server } from "socket.io"
import { createServer } from "http"
import { supabase } from "./utils/supabase.ts"
import { createAdapter as clusterAdapter } from "@socket.io/cluster-adapter"
import { createAdapter as redisAdapter} from "@socket.io/redis-adapter"
import { setupWorker } from "@socket.io/sticky"
import { producer } from "./kafka/producer.ts"
import { startConsumer } from "./kafka/mainConsumer.ts"
import { startRetryConsumer } from "./kafka/retryConsumer.ts"
import { startDLQConsumer } from "./kafka/dlqConsumer.ts"
import { TOPICS } from "./utils/topics.ts"
import Redis from "ioredis"

const app = express()
const server = createServer(app)
const io = new Server(server , {
    cors : {
        origin : "*"
    }
})

const pubClient = new Redis({
    host : process.env.REDIS_HOST,
    username : process.env.REDIS_USERNAME,
    password : process.env.REDIS_PASSWORD,
    port : Number(process.env.REDIS_PORT),
});

const subClient = pubClient.duplicate();

io.adapter(redisAdapter(pubClient , subClient))
// io.adapter(clusterAdapter()) 
// setupWorker(io) 

app.use(cors())
app.use(express.json())

// start the consumers
startConsumer()
startRetryConsumer()
startDLQConsumer()



app.get("/users" , authMiddleware , async (req , res)=>{
    try{
        const allUsers = await prisma.users.findMany({
            where : {
                id : {
                    not : req.userId
                }
            }
        })
        res.status(200).json(allUsers)
    } catch(e){
        console.log(e)
        if(e instanceof Error){
            return res.status(500).json({message : e.message})
        }
    }
})

app.get("/conversations" , authMiddleware , async (req , res)=>{
    const convsersations = await prisma.conversations.findMany({
        where : {
            Members : {
                has : JSON.stringify({ id : req.userId , name : req.userName})
            },
        },
        include : {
            messages : {
                orderBy : {
                    createdAt : "desc"
                },
                take : 1
            }
        }
    })

    const sorted = convsersations.sort((a , b)=> (b.messages[0]?.createdAt.getTime() || 0) - (a.messages[0]?.createdAt.getTime() || 0))

    res.status(200).json(sorted)
})

app.post("/create/single" , authMiddleware , async (req ,res)=>{
    const { id , name } = req.body

    // check if this convo already exists or not
    const found = await prisma.conversations.findFirst({
        where : {
            type : 'Single',
            Members : {
                hasEvery : [JSON.stringify({id , name}) , JSON.stringify({id : req.userId , name : req.userName})]
            }
        }
    })

    if(found){
        // chat already exists
        return res.status(400).json({message : "chat_exists"})
    }

    // create a chat
    await prisma.conversations.create({
        data : {
            type : "Single",
            Members : [JSON.stringify({id , name}) , JSON.stringify({id : req.userId , name : req.userName})] 
        }
    })

    io.emit("convo_created" , id )

    res.status(200).json({message : "chat_created"})

})


app.post("/create/group" , authMiddleware , async(req , res)=>{
    const { groupName , member } = req.body

    await prisma.conversations.create({
        data : {
            type : 'Group',
            GroupName : groupName,
            GroupAdmin : req.userId,
            Members : [...member.map((el : { id : string , name : string}) => JSON.stringify({ id : el.id , name : el.name})) , JSON.stringify({id : req.userId , name : req.userName})]
        }
    })

    io.emit("gc_created" , member)
    res.status(200).json({message : "grp_created"})
})


app.get("/conversation/:id" , authMiddleware , async(req , res)=>{
    const { id } = req.params
    const data = await prisma.conversations.findFirst({
        where : {
            id : String(id) 
        },
        include : {
            messages : {
                orderBy : {
                    createdAt : "asc"
                }
            }
        }
    })

    res.status(200).json(data)
})


app.post("/member/remove", authMiddleware , async(req , res)=>{
    const { id , memberId } = req.body
    const members = await prisma.conversations.findFirst({
        where : {
            id
        },
        select : {
            Members : true
        }
    })

    const filteredMembers = members?.Members.map((el)=> JSON.parse(el as string)).filter((elem) => elem.id != memberId).map((el)=> JSON.stringify(el))
    await prisma.conversations.update({
        where : {
            id 
        },
        data : {
            Members : filteredMembers
        }
    })

    io.emit("gc_removed" , { id , memberId })

    res.status(200).json({message : "member_removed"})
})

app.post("/member/add" , authMiddleware , async (req ,res)=>{
    const { id , newMembers } = req.body

    const oldData = await prisma.conversations.findFirst({
        where : {
            id
        }
    })

    await prisma.conversations.update({
        where : {
            id
        },
        data : {
            Members : [ ...oldData?.Members! , ...newMembers.map((el : {id : string , name : string})=> JSON.stringify({id : el.id , name : el.name})) ]
        }
    })

    io.emit("gc_added" , newMembers)

    res.status(200).json({message : "member_added"})
})


app.delete("/conversation/:id" , authMiddleware , async(req , res)=>{
    const { id } = req.params
    await prisma.conversations.delete({
        where : {
            id : id as string
        }
    })
    io.emit("convo_delete" , id)
    res.status(200).json({message : "delete_successful"})
})

io.use(async (socket , next)=>{
    try{
        const token = socket.handshake.auth.token
        const decoded = await supabase.auth.getUser(token)
        if(decoded.error){
            throw new Error("unauthorized")
        }
        socket.userId = decoded.data.user.id
        next()
    }catch(e){
        if(e instanceof Error){
            console.log(e.message)
        }
    }
})


io.on("connection" , (socket)=>{
    socket.on("join_convo" , (conversationId)=>{
        socket.join(conversationId)
    })

    socket.on("sent_message" , async ({conversationId , message , sendersId , sendersName})=>{

        io.to(conversationId).emit("receive_message" , { id : crypto.randomUUID() ,  message ,  sendersId , sendersName , createdAt : Date.now() })

        await producer?.send({
            topic : TOPICS.CHAT,
            messages : [{
                key : conversationId,
                value : JSON.stringify({
                    message,
                    senderId : sendersId,
                    senderName : sendersName,
                    conversationId
                })
            }]
        })
    })

    socket.on("typing" , ({id , userId , userName})=>{
        io.to(id).emit("receive_typing" , {id , userId , userName})
    })
})


// listening on port 8080 (if using cluster mode)
const PORT = process.env.PORT || 3001

server.listen(PORT,()=>{
    console.log(`running on ${PORT} `)
})