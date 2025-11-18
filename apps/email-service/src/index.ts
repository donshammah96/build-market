import sendMail from "../utils/mailer";
import { createConsumer, createKafkaClient } from "@repo/kafka";

const kafka = createKafkaClient("email-service");
const consumer = createConsumer(kafka, "email-service");

const start = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe([
      {
        topicName: "user.created",
        topicHandler: async (message) => {
          const { email, username } = message.value;

          if (email) {
            await sendMail({
              email,
              subject: "Welcome to Build Market App",
              text: `Welcome ${username}. You account has been created!`,
            });
          }
        },
      },
      {
        topicName: "project.created",
        topicHandler: async (message) => {
          const { email, projectName, status } = message.value;

          if (email) {
            await sendMail({
              email,
              subject: "Project has been created",
              text: `Hello! Your project: Project Name: ${projectName}, Status: ${status}`,
            });
          }
        },
      },
    ]);
  } catch (error) {
    console.log(error);
  }
};

start();