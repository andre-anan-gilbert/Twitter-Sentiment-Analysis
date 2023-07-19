const mariadb = require("mariadb");
const { CACHE_TIME_SECONDS, options } = require("./config.js");
const { memcached, getFromCache } = require("./memcache.js");
const { logging } = require("./utils.js");

const pool = mariadb.createPool({
  host: options.mariadbHost,
  port: options.mariadbPort,
  database: options.mariadbSchema,
  user: options.mariadbUsername,
  password: options.mariadbPassword,
  connectionLimit: 5,
});

async function executeQuery(query, data) {
  let connection;
  try {
    connection = await pool.getConnection();
    logging("Executing query " + query);
    let res = await connection.query({ rowsAsArray: true, sql: query }, data);
    return res;
  } finally {
    if (connection) connection.end();
  }
}

async function getTweets() {
  const key = "tweets";
  let cacheData = await getFromCache(key);

  if (cacheData) {
    logging(
      `Cache hit for key = ${key}, cacheData = ${JSON.stringify(cacheData)}`
    );
    return { result: cacheData, cached: true };
  } else {
    logging(`Cache miss for key = ${key}, querying database`);
    const data = await executeQuery(
      "SELECT tweet_id, tweet, author FROM tweets ORDER BY tweet_id",
      []
    );
    if (data) {
      let result = data.map((row) => ({
        tweetId: row?.[0],
        tweetContent: row?.[1],
        userName: row?.[2],
      }));
      logging("Got result = " + JSON.stringify(result) + " storing in cache");
      if (memcached) await memcached.set(key, result, CACHE_TIME_SECONDS);
      return { result, cached: false };
    } else {
      throw "No tweets data found";
    }
  }
}

async function getPopular(maxCount) {
  const query =
    "SELECT popular.tweet_id, popular.sentiment, popular.count, tweets.author, tweets.profile_picture_url FROM popular JOIN tweets ON tweets.tweet_id = popular.tweet_id ORDER BY count DESC LIMIT ?";
  return (await executeQuery(query, [maxCount])).map((row) => ({
    tweetId: row?.[0],
    sentiment: row?.[1],
    count: row?.[2],
    author: row?.[3],
    profile_picture_url: row?.[4],
  }));
}

async function getEvents() {
  return (
    await executeQuery(
      "SELECT event_type, count FROM events ORDER BY count DESC",
      []
    )
  ).map((row) => ({
    eventType: String(row?.[0]),
    count: row?.[1],
  }));
}

async function getTweet(tweetId) {
  const query = "SELECT tweet_id, tweet, author FROM tweets WHERE tweet_id = ?";
  const key = tweetId;
  let cacheData = await getFromCache(key);

  if (cacheData) {
    logging(
      `Cache hit for key = ${key}, cacheData = ${JSON.stringify(cacheData)}`
    );
    return { ...cacheData, cached: true };
  } else {
    logging(`Cache miss for key = ${key}, querying database`);

    let data = (await executeQuery(query, [tweetId]))?.[0]; // first entry
    if (data) {
      let result = {
        tweetId: data?.[0],
        tweet: data?.[1],
        author: data?.[2],
      };
      logging(`Got result = ${JSON.stringify(result)}, storing in cache`);
      if (memcached) await memcached.set(key, result, CACHE_TIME_SECONDS);
      return { ...result, cached: false };
    } else {
      throw "No data found for this tweet";
    }
  }
}

module.exports = {
  getTweets,
  getPopular,
  getEvents,
  getTweet,
};
