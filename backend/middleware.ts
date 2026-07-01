import type { NextFunction, Request, Response } from "express";
import { supabase } from "./utils/supabase.ts";
import { prisma } from "./utils/prisma.ts";

export async function authMiddleware(req : Request ,res : Response, next : NextFunction) {
    const token = req.headers?.authorization?.split(" ")[1]
    if(!token){
        return res.status(401).json({message : "unauthorized"})
    }

    const decoded = await supabase.auth.getUser(token)
    if(decoded.error){
        console.log(decoded.error)
        return res.status(401).json({message : decoded.error})
    }

    const user = await prisma.users.findFirst({
        where : {
            email : decoded.data.user.email
        }
    })

    if(!user){
        // TODO : use webhooks
        await prisma.users.create({
            data : {
                id : decoded.data.user.id,
                email : decoded.data.user.email!,
                name : decoded.data.user.email?.split("@")[0]!
            }
        })
    }

    req.userId = decoded.data.user.id
    req.userName = decoded.data.user.email?.split("@")[0]
    next()
    
}