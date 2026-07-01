import { Kafka } from "kafkajs";

export const kafkaClient = new Kafka({
    brokers : [process.env.KAFKA_URL!],
    clientId : "chat_app_kafka_client",
    sasl : {
        username : process.env.KAFKA_USERNAME!,
        password : process.env.KAFKA_PASSWORD!,
        mechanism : "plain"
    },
    ssl : {
        ca : process.env.CA_CERT
    }
})