import { program as optionParser } from "commander";

export const CACHE_TIME_SECONDS = 15;
export const NUMBER_OF_TWEETS = 30;

export const options = optionParser
    .storeOptionsAsProperties(true)
    // Web server
    .option("--port <port>", "Web server port", "3000")
    // Kafka options
    .option("--kafka-broker <host:port>", "Kafka bootstrap host:port", "my-cluster-kafka-bootstrap:9092")
    .option("--kafka-topic-tweets <topic>", "Kafka topic to tracking tweets send to", "tracking-tweets")
    .option("--kafka-topic-events <topic>", "Kafka topic to tracking events send to", "tracking-events")
    .option(
        "--kafka-client-id <id>",
        "Kafka client ID",
        "my-app",
        // Causes: There is no leader for this topic-partition as we are in the middle of a leadership election
        // "tracker-" + Math.floor(Math.random() * 100000)
    )
    // Memcached options
    .option(
        "--memcached-hostname <hostname>",
        "Memcached hostname (may resolve to multiple IPs)",
        "my-memcached-service",
    )
    .option("--memcached-port <port>", "Memcached port", "11211")
    .option("--memcached-update-interval <ms>", "Interval to query DNS for memcached IPs", "5000")
    // Database options
    .option("--mariadb-host <host>", "MariaDB host", "my-app-mariadb-service")
    .option("--mariadb-port <port>", "MariaDB port", "3306")
    .option("--mariadb-schema <db>", "MariaDB Schema/database", "popular")
    .option("--mariadb-username <username>", "MariaDB username", "root")
    .option("--mariadb-password <password>", "MariaDB password", "mysecretpw")
    // Misc
    .addHelpCommand()
    .parse()
    .opts();
