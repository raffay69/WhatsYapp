import { prisma } from "../utils/prisma.ts";
import { TOPICS } from "../utils/topics.ts";
import { kafkaClient } from "./kafkaClient.ts";

export async function startDLQConsumer() {
    const consumer = kafkaClient.consumer({
        groupId : "chat-dlq"
    })

    await consumer.connect()

    await consumer.subscribe({
        topic : TOPICS.CHAT_DLQ,
    })

    console.log("dlq consumer started")

    await consumer.run({
        autoCommit : false,
        eachMessage : async({message , topic , partition})=>{
            try{

                await prisma.failed.create({
                    data : {
                        messages : message.value?.toString()!,
                        latestError : message.headers?.latestError?.toString()!,
                        originalError : message.headers?.originalError?.toString()!,
                        failedAt : message.headers?.failedAt?.toString()!,
                        originalTopic : message.headers?.originalTopic?.toString()!,
                        originalPartition : message.headers?.originalPartition?.toString()!
                    }
                })

                console.log("logged the data in db")

                await consumer.commitOffsets([{
                    topic,
                    partition,
                    offset : String(Number(message.offset) + 1)
                }])

            } catch(e){
                if(e instanceof Error){
                    console.log(e.message)
                }
            }
        }
    })
}