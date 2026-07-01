import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { prisma } from "../utils/prisma.ts";
import { kafkaClient } from "./kafkaClient.ts";
import { producer } from "./producer.ts";
import { TOPICS } from "../utils/topics.ts";

export async function startConsumer() {
    const consumer = kafkaClient.consumer({
        groupId : "chat",
    })

    await consumer.connect()

    await consumer.subscribe({
        topic : TOPICS.CHAT,
    })

    console.log("main consumer started")

    await consumer.run({
        autoCommit : false,
        eachBatchAutoResolve : false,
        eachBatch : async({ batch , pause , resolveOffset })=>{
            try{
                const parsed = batch.messages.map((el)=> JSON.parse(el.value?.toString()!))
                
                await prisma.messages.createMany({
                    data : parsed
                })
                
                resolveOffset(batch.lastOffset())
                
                await consumer.commitOffsets([{
                    topic : batch.topic,
                    partition : batch.partition,
                    offset : String(Number(batch.lastOffset()) + 1)
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
                    // send the data to retry topic
                    console.log("sending to retry topic")
                    await producer?.send({
                        topic : TOPICS.CHAT_RETRY,
                        messages : [{
                            key : batch.messages[0]?.key,
                            value : JSON.stringify(batch.messages.map((el)=> JSON.parse(el.value?.toString()!))),
                            headers : {
                                originalError : e.message,
                                failedAt : Date.now().toString(),
                                originalTopic : batch.topic,
                                originalPartition : String(batch.partition)
                            }
                        }],
                    })

                    resolveOffset(batch.lastOffset())

                    await consumer.commitOffsets([{
                        topic : batch.topic,
                        partition : batch.partition,
                        offset : String(Number(batch.lastOffset()) + 1)
                    }])
                    
                }
            }
        }
    })
}