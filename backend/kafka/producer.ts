import { kafkaClient } from "./kafkaClient.ts";

async function createProduer(){
    try{
        const producer = kafkaClient.producer({
            idempotent : true
        })

        await producer.connect()

        return producer
    }catch(e){
        if(e instanceof Error){
            console.log(e.message)
            return
        }
    }
}

export const producer = await createProduer()