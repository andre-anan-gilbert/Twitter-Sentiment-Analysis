/** Kafka producer. */
import { Kafka, TopicMessages } from "kafkajs";
import { options } from "./config";
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

type TweetMessage = { tweet_id: number; tweet: string; timestamp: number };
type EventMessage = { event_type: string; timestamp: number };

/**
 * Sends messages to Kafka as batch.
 * @param tweetMessage The tweet message published as tracking-tweets.
 * @param eventMessage The event message published as tracking-events.
 */
export async function sendBatchMessage(tweetMessage: TweetMessage, eventMessage: EventMessage) {
    await producer.connect();

    const topicMessages: TopicMessages[] = [
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

/** Publishes a tweet to Kafka every 10s. */
async function streamTweets() {
    const tweetId = Math.floor(Math.random() * options.numberOfTweets);
    const tweet = await getTweet(tweetId.toString());
    const timestamp = Math.floor((new Date() as any) / 1000);
    sendBatchMessage(
        {
            tweet_id: tweet.tweetId,
            tweet: tweet.tweet,
            timestamp: timestamp,
        },
        { event_type: "streamed", timestamp: timestamp },
    );
}

// Initially stream 1 tweet, then stream 1 tweet every 10s
streamTweets();
setInterval(streamTweets, 10000);
