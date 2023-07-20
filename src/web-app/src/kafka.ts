import { Kafka } from "kafkajs";
import { NUMBER_OF_TWEETS, options } from "./config";
import { getTweet } from "./database";
import { logging } from "./utils";

const kafka = new Kafka({
    clientId: options.kafkaClientId,
    brokers: [options.kafkaBroker],
    retry: {
        retries: 0,
    },
});

const producer = kafka.producer();

// Send tracking message to Kafka
export async function sendBatchMessage(
    tweetMessage: { tweet_id: any; tweet: string; timestamp: number },
    eventMessage: { event_type: string; timestamp: number },
) {
    await producer.connect();

    const topicMessages = [
        {
            topic: options.kafkaTopicTweets,
            messages: [{ value: JSON.stringify(tweetMessage) }],
        },
        {
            topic: options.kafkaTopicEvents,
            messages: [{ value: JSON.stringify(eventMessage) }],
        },
    ];

    await producer
        .sendBatch({ topicMessages: topicMessages })
        .then(result => logging(`Sent message = ${JSON.stringify(result)} to kafka`))
        .catch(err => logging(`Error sending to kafka ${err}`));
}

// Simulate data streaming
async function streamTweets() {
    const tweetId = Math.floor(Math.random() * NUMBER_OF_TWEETS);
    const tweet = await getTweet(tweetId.toString());
    const timestamp = Math.floor((new Date() as any) / 1000);

    // Send the tracking message to Kafka
    sendBatchMessage(
        {
            tweet_id: tweet.tweetId,
            tweet: tweet.tweet,
            timestamp: timestamp,
        },
        { event_type: "streamed", timestamp: timestamp },
    );
}

function initialStreamOfTweets() {
    for (let i = 0; i < 5; i++) streamTweets();
}

initialStreamOfTweets();
setInterval(streamTweets, 30000);
