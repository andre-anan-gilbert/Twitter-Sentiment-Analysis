const moment = require("moment");
const os = require("os");
const dns = require("dns").promises;
const { program: optionparser } = require("commander");
const { Kafka } = require("kafkajs");
const mariadb = require("mariadb");
const MemcachePlus = require("memcache-plus");
const express = require("express");

const app = express();

const CACHE_TIME_SECONDS = 15;
const NUMBER_OF_TWEETS = 30;

function logging(message) {
  const dateTime = new Date();
  console.log(
    moment(dateTime).format("YY/MM/DD HH:MM:SS") + " INFO " + message
  );
}

// -------------------------------------------------------
// Command-line options (with sensible defaults)
// -------------------------------------------------------

let options = optionparser
  .storeOptionsAsProperties(true)
  // Web server
  .option("--port <port>", "Web server port", 3000)
  // Kafka options
  .option(
    "--kafka-broker <host:port>",
    "Kafka bootstrap host:port",
    "my-cluster-kafka-bootstrap:9092"
  )
  .option(
    "--kafka-topic-tweets <topic>",
    "Kafka topic to tracking tweets send to",
    "tracking-tweets"
  )
  .option(
    "--kafka-topic-events <topic>",
    "Kafka topic to tracking events send to",
    "tracking-events"
  )
  .option(
    "--kafka-client-id < id > ",
    "Kafka client ID",
    "my-app"
    // Causes: There is no leader for this topic-partition as we are in the middle of a leadership election
    // "tracker-" + Math.floor(Math.random() * 100000)
  )
  // Memcached options
  .option(
    "--memcached-hostname <hostname>",
    "Memcached hostname (may resolve to multiple IPs)",
    "my-memcached-service"
  )
  .option("--memcached-port <port>", "Memcached port", 11211)
  .option(
    "--memcached-update-interval <ms>",
    "Interval to query DNS for memcached IPs",
    5000
  )
  // Database options
  .option("--mariadb-host <host>", "MariaDB host", "my-app-mariadb-service")
  .option("--mariadb-port <port>", "MariaDB port", 3306)
  .option("--mariadb-schema <db>", "MariaDB Schema/database", "popular")
  .option("--mariadb-username <username>", "MariaDB username", "root")
  .option("--mariadb-password <password>", "MariaDB password", "mysecretpw")
  // Misc
  .addHelpCommand()
  .parse()
  .opts();

// -------------------------------------------------------
// Database Configuration
// -------------------------------------------------------

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

// -------------------------------------------------------
// Memcache Configuration
// -------------------------------------------------------

//Connect to the memcached instances
let memcached = null;
let memcachedServers = [];

async function getMemcachedServersFromDns() {
  try {
    // Query all IP addresses for this hostname
    let queryResult = await dns.lookup(options.memcachedHostname, {
      all: true,
    });

    // Create IP:Port mappings
    let servers = queryResult.map(
      (el) => el.address + ":" + options.memcachedPort
    );

    // Check if the list of servers has changed
    // and only create a new object if the server list has changed
    if (memcachedServers.sort().toString() !== servers.sort().toString()) {
      logging("Updated memcached server list to " + servers);
      memcachedServers = servers;

      //Disconnect an existing client
      if (memcached) await memcached.disconnect();

      memcached = new MemcachePlus(memcachedServers);
    }
  } catch (e) {
    logging("Unable to get memcache servers (yet)");
  }
}

//Initially try to connect to the memcached servers, then each 5s update the list
getMemcachedServersFromDns();
setInterval(
  () => getMemcachedServersFromDns(),
  options.memcachedUpdateInterval
);

//Get data from cache if a cache exists yet
async function getFromCache(key) {
  if (!memcached) {
    logging(
      `No memcached instance available, memcachedServers = ${memcachedServers}`
    );
    return null;
  }
  return await memcached.get(key);
}

// -------------------------------------------------------
// Kafka Configuration
// -------------------------------------------------------

// Kafka connection
const kafka = new Kafka({
  clientId: options.kafkaClientId,
  brokers: [options.kafkaBroker],
  retry: {
    retries: 0,
  },
});

const producer = kafka.producer();
// End

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
// End

// -------------------------------------------------------
// HTML helper to send a response to the client
// -------------------------------------------------------

function sendResponse(res, html, cachedResult, loadingHTML, eventsList) {
  const getCurrentDateTime = () => new Date().toLocaleString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});
  res.send(`<!DOCTYPE html>
  <html lang="en">
  <head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Twitter Sentiment Analysis - Big Data</title>
			<!-- <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/mini.css/3.0.1/mini-default.min.css"> -->
      
      <!-- Bootstrap and custom styles -->
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65" crossorigin="anonymous">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
      <link type="text/css" rel="stylesheet" href="style.css">

      <!-- Apexcharts js -->
      <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
      
      <link rel="shortcut icon" href="//abs.twimg.com/favicons/twitter.2.ico">
			<script>
        function fetchRandomTweets() {
          const maxRepetitions = Math.floor(Math.random() * 50) + 1; // Avoid fetching zero
          showMessage(maxRepetitions);
          for(var i = 0; i < maxRepetitions; ++i) {
            const tweetId = Math.floor(Math.random() * ${NUMBER_OF_TWEETS})
            fetch("/tweets/" + tweetId + "/fetched", {cache: 'no-cache'})
          }
          // await sleep(10000); // Show for 10s and then auto-dismiss
          // dismissMessage();
        }


        function scrollAndHighlightEntry(number) {
          // Get the table element
          var table = document.getElementById("allTweetsTable");
          
          // Get all the rows in the table
          var rows = table.getElementsByTagName("tr");
          
          // Loop through the rows to find the matching entry
          for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            
            // Get the value in the first column of the current row
            var firstColumnValue = parseInt(row.cells[0].textContent);
            
            // Check if the value matches the input number
            if (firstColumnValue === number) {
              // Scroll to the matching row
              row.scrollIntoView({ behavior: "smooth", block: "center" });
              
              // Add a highlight class to the row
              row.classList.add("highlight");
              
              // Remove the highlight class after 3 seconds
              setTimeout(function() {
                row.classList.remove("highlight");
              }, 3000);
              
              // Exit the loop since the matching entry is found
              break;
            }
          }
        }
			</script>
		</head>
		<body>
      <div class="app-bar">
        <i class="bi bi-twitter"></i>
        <h1 class="heading">Sentiment Analyzer</h1>
        <a class="btn btn-primary" onclick="fetchRandomTweets()" role="button"><i class="bi bi-dice-5"></i> Generate tweet views!</a>
      </div>
    
      <div class="container-fluid">
          <div class="app-content">

            ${loadingHTML}
            <div id="contentRow" class="row">
              ${html}
            </div>

            <div class="row">
              <div class='col-lg-6 col-md-12'>
                <div class='content-container'>
                  <h2>Page Information</h2>
                  <div class='page-info-wrapper'>

                    <div class="page-info-container">
                      <i class="bi bi-hdd-rack-fill"></i>
                      <div class="page-info-content">
                        <p>Server</p>
                        <p>${os.hostname()}</p>
                      </div>
                    </div>

                    <div class="page-info-container">
                      <i class="bi bi-calendar-date"></i>
                      <div class="page-info-content">
                        <p>Generation date</p>
                        <p>${getCurrentDateTime()}</p>
                      </div>
                    </div>
                    
                    <div class="page-info-container">
                      <i class="bi bi-memory"></i>
                      <div class="page-info-content">
                        <p>Memcached Servers (${memcachedServers.length})</p>
                        <p>${memcachedServers.join(" and  ")}</p>
                      </div>
                    </div>
                    
                    <div class="page-info-container">
                      <i class="bi bi-menu-button-wide-fill"></i>
                      <div class="page-info-content">
                        <p>Result from cache</p>
                        <p>${cachedResult}</p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <div class='col-lg-6 col-md-12 events-container-wrapper'>
                <div class='content-container events-container'>
                  <h2>System Events</h2>
                  <div id="eventChart"></div>
                </div>
              </div>

            </div>

          </div>
      </div>

      <!-- Bundle for bootstrap -->
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-kenU1KFdBIe4zVF0s0G1M5b4hcpxyD9F7jL+jjXkk+Q2h455rYXK/7HAuoJl+0I4" crossorigin="anonymous"></script>
      <script>
        // Setting the heigth of the all tweets table contianer using the row.
        document.getElementById("contentRow").style.height = document.getElementById("topTweets").offsetHeight + "px";
        
        let messagePopup = document.getElementById("messagePopup");
        let timer;
        function showMessage(maxRepetitions) {
          document.getElementById("out").innerHTML = "Fetching <b>" + maxRepetitions + "</b> random tweets!";
          messagePopup.style.display = "flex";
          messagePopup.style.opacity = 1;
          clearTimeout(timer);
          timer = setTimeout(dismissMessage, 10000);
        }

        let hidePopup = () => messagePopup.style.display = "none";

        function dismissMessage() {
          messagePopup.style.opacity = 0;
          setTimeout(hidePopup, 300);
        }


        // Define chart options for events chart
        var eventChartOptions = {
          chart: {
            type: 'bar',
          },
          series: [{
            name: 'View count origin',
            data: [${(eventsList && eventsList.length) ? eventsList.map(e => e[1]).join(",") : ""}]
          }],
          xaxis: {
            categories: [${(eventsList && eventsList.length) ? eventsList.map(e => "\"" + e[0] + "\"").join(",") : ""}],
          },
          yaxis: {
            labels: {
              formatter: function (value) {
                return Number(value).toLocaleString();
              }
            }
          },
          plotOptions: {
            bar: {
              borderRadius: 3,
              dataLabels: {
                position: 'center',
              },
              colors: {
                backgroundBarColors: 'rgb(29, 155, 240)',
                backgroundBarOpacity: 0,
                barBorderWidth: 0,
              },
            }
          },
          options: {
            responsie: true,
          }
        };

        // Create the chart
        var eventChart = new ApexCharts(document.querySelector("#eventChart"), eventChartOptions);
        eventChart.render();
      </script>
		</body>
	</html>
	`);
}

// -------------------------------------------------------
// Start page
// -------------------------------------------------------

// Get list of tweets (from cache or db)
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

// Get popular tweets (from db only)
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

// Use CSS file
app.use(express.static("public"));

// Return HTML for start page
app.get("/", (req, res) => {
  const topX = 10;
  Promise.all([getTweets(), getPopular(topX), getEvents()]).then((values) => {
    const tweets = values[0];
    const popular = values[1];
    const events = values[2];

    let tweetsHtml = tweets.result
      .map(
        (pop) =>
          `<tr>
              <td>${pop.tweetId}</td>
              <td>${pop.userName}</td>
              <td>${pop.tweetContent}</td>
          </tr>`
      )
      .join("\n");

    let popularHtml = popular
      .map(
        (pop) =>
          `<a href='javascript:scrollAndHighlightEntry(${pop.tweetId});'>
          <li>
            <div class="sentiment-container ${
              pop.sentiment == 1 ? "positive" : "negative"
            }-sentiment"></div>
            <div class="sentiment-shade"></div>
            <div class="profile-image">
              <img src="${pop.profile_picture_url}" alt="User profile picture">
            </div>
            <div class="user-info">
              <p class="user-name">${pop.author}</p>
              <p class="sentiment-indicator">Sentiment: ${
                pop.sentiment == 1 ? "positive" : "negative"
              }</p>
            </div>
            <div class="view-count">
              ${pop.count}
            </div>
        </li>
      </a>`
      )
      .join("\n");

    let showLoadingMessage = false;
    if (!popularHtml) {
      showLoadingMessage = true;

      popularHtml = `<a href=''>
        <li>
          <div aria-hidden="true" class="placeholder-wave w-75"><span class="placeholder w-100"></span</div>
        </li>
      </a>`.repeat(10);
    }

    function capitalizeFirstLetter(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    const eventsList = events.map((e) => [capitalizeFirstLetter(e.eventType), e.count]);

    let loadingHTML = "";
    if (showLoadingMessage) {
      loadingHTML = `
        <div class="no-data-message content-container alert alert-primary" role="alert">
          <div class="alert-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>
          <div class="alert-content">
            Waiting for the database to come up and be filled with data...<br>
            This takes about <b>three minutes</b>. Please <b>refresh</b> in a few seconds!
          </div>
        </div>`;
    } else {
      loadingHTML = "";
    }

    const html = `
    <!-- Top 10 tweets list -->
    <div class="col-lg-5 col-md-12">
        <div id="topTweets" class="top-tweets content-container">
          <h2>Top ${topX} Tweets</h2>
          <ol> ${popularHtml} </ol>
        </div>
    </div>

    <!-- All tweets list -->
    <div class="col-lg-7 col-md-12 right-column">
        <div class="all-tweets content-container">
          <h2>All Tweets</h2>
          <div class="table-wrapper">
            <table id="allTweetsTable">
                <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Content</th>
                </tr>
                ${tweetsHtml}
            </table>
          </div>
        </div>
    </div>

    <div id="messagePopup" class="fetch-confirmation alert alert-dismissable fade show" role="alert">
      <i class="bi bi-check-circle-fill"></i>
      <span id="out"></span>
      <button type="button" class="btn-close" onclick="dismissMessage()" aria-label="Close"></button>
    </div>
    `;
    sendResponse(res, html, tweets.cached, loadingHTML, eventsList);
  });
});

// -------------------------------------------------------
// Get a specific tweet (from cache or DB)
// -------------------------------------------------------

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

app.get("/tweets/:id/:event", async (req, res) => {
  let event = req.params["event"];
  let tweetId = req.params["id"];
  const tweet = await getTweet(tweetId);
  const timestamp = Math.floor(new Date() / 1000);

  // Send the tracking message to Kafka
  sendBatchMessage(
    {
      tweet_id: tweet.tweetId,
      tweet: tweet.tweet,
      timestamp: timestamp,
    },
    { event_type: event, timestamp: timestamp }
  );

  // Send reply to browser
  getTweet(tweetId)
    .then((data) => {
      sendResponse(
        res,
        `<h1>${data.tweetId}</h1><p>${data.author}</p>` +
          data.tweet
            .split("\n")
            .map((p) => `<p>${p}</p>`)
            .join("\n"),
        data.cached
      );
    })
    .catch((err) => {
      sendResponse(res, `<h1>Error</h1><p>${err}</p>`, false);
    });
});

// Simulate data streaming
setInterval(async () => {
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
}, 5000);

// -------------------------------------------------------
// Main method
// -------------------------------------------------------

app.listen(options.port, function () {
  logging(
    "Node app is running at http://localhost:" +
      options.port +
      " in popular-slides-web"
  );
});
