import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { kafkaClient } from "./kafkaClient.ts";
import { producer } from "./producer.ts";
import { retryWrapper } from "../utils/retryWrapper.ts";
import { prisma } from "../utils/prisma.ts";
import { TOPICS } from "../utils/topics.ts";

export async function startRetryConsumer() {
    const consumer = kafkaClient.consumer({
        groupId : "chat-retry"
    })

    await consumer.connect()

    await consumer.subscribe({
        topic : TOPICS.CHAT_RETRY,
    })

    console.log("retry consumer started")

    await consumer.run({
        autoCommit : false,
        eachMessage : async({message , topic , partition , pause})=>{
            try{

                const parsed = JSON.parse(message.value?.toString()!)

                await retryWrapper(async ()=>{
                    await prisma.messages.createMany({
                        data : parsed
                    })
                }, 3)
                
                await consumer.commitOffsets([{
                    topic,
                    partition,
                    offset : String(Number(message.offset) + 1)
                }])

            }catch(e){
                if(e instanceof PrismaClientKnownRequestError){
                    // indicates db overload
                    if(e.code === "P1002" || e.code === "P5011"){
                        console.log(e.message)
                        console.log("pausing consumer briefly")
                        const resume = pause()
                        setTimeout(() => {
                            resume()
                            console.log("restarting consumer")
                        }, 30000);
                        return
                    }
                    console.log(e.message)
                    // send the data to dlq 
                    await producer?.send({
                        topic : TOPICS.CHAT_DLQ,
                        messages : [{
                            key : message.key,
                            value : message.value,
                            headers : {
                                ...message.headers,
                                latestError : e.message,
                                failedAt : Date.now().toString()
                            }
                        }]
                    })

                    await consumer.commitOffsets([{
                        topic,
                        partition,
                        offset : String(Number(message.offset) + 1)
                    }])
                }
            }
        }
    })
}