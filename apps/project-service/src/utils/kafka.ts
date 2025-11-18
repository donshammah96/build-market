import { createConsumer, createKafkaClient, createProducer } from "@repo/kafka";

const kafka = createKafkaClient("project-service");

export const producer = createProducer(kafka);
export const consumer = createConsumer(kafka, "project-service-group");

export const connectKafka = async () => {
  await producer.connect();
  await consumer.connect();
};
