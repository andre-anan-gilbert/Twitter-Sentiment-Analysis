const { Kafka } = require("kafkajs");
const { NUMBER_OF_TWEETS, options } = require("./config.js");
const { logging } = require("./utils.js");
const { getTweet } = require("./database.js");

const kafka = new Kafka({
  clientId: options.kafkaClientId,
  brokers: [options.kafkaBroker],
  retry: {
    retries: 0,
  },
});

const producer = kafka.producer();

// Send tracking message to Kafka
async function sendBatchMessage(tweetMessage, eventMessage) {
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
    .then((result) =>
      logging(`Sent message = ${JSON.stringify(result)} to kafka`)
    )
    .catch((err) => logging(`Error sending to kafka ${err}`));
}

// Simulate data streaming
async function streamTweets() {
  const tweetId = Math.floor(Math.random() * NUMBER_OF_TWEETS);
  const tweet = await getTweet(tweetId.toString());
  const timestamp = Math.floor(new Date() / 1000);

  // Send the tracking message to Kafka
  sendBatchMessage(
    {
      tweet_id: tweet.tweetId,
      tweet: tweet.tweet,
      timestamp: timestamp,
    },
    { event_type: "streamed", timestamp: timestamp }
  );
}

function initialStreamOfTweets() {
  for (let i = 0; i < 10; i++) streamTweets();
}

initialStreamOfTweets();
setInterval(streamTweets, 10000);

module.exports = { sendBatchMessage };
