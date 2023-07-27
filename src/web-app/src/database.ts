/** MariaDB connector and queries. */
import mariadb from "mariadb";
import { options } from "./config";
import { getFromCache, memcached } from "./memcached";
import { logging } from "./utils";

const pool = mariadb.createPool({
    host: options.mariadbHost,
    port: options.mariadbPort,
    database: options.mariadbSchema,
    user: options.mariadbUsername,
    password: options.mariadbPassword,
    connectionLimit: 5,
});

type QueryData = string[] | number[];

/** Queries data from MariaDB. */
async function executeQuery(query: string, data: QueryData) {
    let connection: mariadb.PoolConnection;
    try {
        connection = await pool.getConnection();
        logging("Executing query " + query);
        const result = await connection.query({ rowsAsArray: true, sql: query }, data);
        return result;
    } finally {
        if (connection) connection.end();
    }
}

type Tweet = (number | string)[];

/** Queries all tweets. */
export async function getTweets() {
    const key = "tweets";
    const cacheData = await getFromCache(key);
    if (cacheData) {
        logging(`Cache hit for key = ${key}, cacheData = ${JSON.stringify(cacheData)}`);
        return { result: cacheData, cached: true };
    }
    logging(`Cache miss for key = ${key}, querying database`);
    const data = await executeQuery("SELECT tweet_id, tweet, author FROM tweets ORDER BY tweet_id", []);
    if (!data) throw "No tweets data found";
    const result = data.map((row: Tweet[]) => ({
        tweetId: row?.[0],
        tweetContent: row?.[1],
        username: row?.[2],
    }));
    logging("Got result = " + JSON.stringify(result) + " storing in cache");
    if (memcached) await memcached.set(key, result, options.cacheTime);
    return { result, cached: false };
}

/** Queries the top x tweets. */
export async function getPopular(topXTweets: number) {
    const query = `
        SELECT 
            popular.tweet_id, 
            popular.sentiment, 
            popular.count, 
            tweets.author, 
            tweets.profile_picture_url 
        FROM popular JOIN tweets ON tweets.tweet_id = popular.tweet_id 
        ORDER BY popular.count DESC, tweets.author 
        LIMIT ?
    `;
    const result = await executeQuery(query, [topXTweets]);
    return result.map((row: Tweet[]) => ({
        tweetId: row?.[0],
        sentiment: row?.[1],
        tweetViews: row?.[2],
        username: row?.[3],
        profilePictureUrl: row?.[4],
    }));
}

type Event = (string | number)[];

/** Queries all events. */
export async function getEvents() {
    const result = await executeQuery("SELECT event_type, count FROM events ORDER BY count DESC", []);
    return result.map((row: Event[]) => ({
        eventType: row?.[0],
        count: row?.[1],
    }));
}

/** Queries a specific tweet given a tweet id. */
export async function getTweet(tweetId: string) {
    const query = "SELECT tweet_id, tweet, author FROM tweets WHERE tweet_id = ?";
    const key = tweetId;
    const cacheData = await getFromCache(key);
    if (cacheData) {
        logging(`Cache hit for key = ${key}, cacheData = ${JSON.stringify(cacheData)}`);
        return { ...cacheData, cached: true };
    }
    logging(`Cache miss for key = ${key}, querying database`);
    const data = (await executeQuery(query, [tweetId]))?.[0]; // Grab first entry
    if (!data) throw "No data found for this tweet";
    const result = {
        tweetId: data?.[0],
        tweet: data?.[1],
        author: data?.[2],
    };
    logging(`Got result = ${JSON.stringify(result)}, storing in cache`);
    if (memcached) await memcached.set(key, result, options.cacheTime);
    return { ...result, cached: false };
}
