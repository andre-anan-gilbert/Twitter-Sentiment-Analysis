/** Web server. */
import express, { Request, Response } from "express";
import os from "os";
import { options } from "./config";
import { getEvents, getPopular, getTweet, getTweets } from "./database";
import { sendBatchMessage } from "./kafka";
import { memcachedServers } from "./memcached";
import { logging } from "./utils";

const app = express();

// Use CSS file
app.use(express.static("public"));

/**
 * The web page content.
 * @param res The response to send to the browser.
 * @param html The tweets content.
 * @param cachedResult Indicates if the values rendered come from memcached.
 * @param loadingHTML The initial loading container of popular tweets.
 * @param eventsList The system events to be rendered as a bar chart.
 */
function sendResponse(res: Response, html: string, cachedResult: boolean, loadingHTML: string, eventsList: EventsList) {
    const getCurrentDateTime = () => {
        return new Date().toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    };

    res.send(`
        <!DOCTYPE html>
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
                    const maxRepetitions = Math.floor(Math.random() * 10) + 1; // Avoid fetching zero
                    showMessage(maxRepetitions);
                    for(let i = 0; i < maxRepetitions; i++) {
                        const tweetId = Math.floor(Math.random() * ${options.numberOfTweets})
                        fetch("/tweets/" + tweetId + "/fetched", {cache: 'no-cache'})
                    }
                }


                function scrollAndHighlightEntry(number) {
                    // Get the table element
                    const table = document.getElementById("allTweetsTable");
                    
                    // Get all the rows in the table
                    const rows = table.getElementsByTagName("tr");
                    
                    // Loop through the rows to find the matching entry
                    for (var i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        
                        // Get the value in the first column of the current row
                        const firstColumnValue = parseInt(row.cells[0].textContent);
                        
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
              
                // Generate one click for a certain tweet
                function generateClick(tweetId) {
                    fetch("/tweets/" + tweetId + "/clicked", {cache: 'no-cache'});
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
                // Setting the height of the all tweets table container using the row.
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

                const hidePopup = () => messagePopup.style.display = "none";

                function dismissMessage() {
                    messagePopup.style.opacity = 0;
                    setTimeout(hidePopup, 300);
                }


                // Define chart options for events chart
                const eventChartOptions = {
                    chart: {
                        type: 'bar',
                    },
                    series: [{
                        name: 'View count origin',
                        data: [${
                            eventsList && eventsList.length ? eventsList.map((evt: EventTuple) => evt[1]).join(",") : ""
                        }]
                    }],
                    dataLabels: {
                        enabled: true,
                        style: {
                          colors: ['rgba(0, 0, 0, 0.8)'], // Bar amount text color
                          fontSize: '14px' // Bar amount font size
                        }
                    },
                    xaxis: {
                        categories: [${
                            eventsList && eventsList.length
                                ? eventsList.map((evt: EventTuple) => '"' + evt[0] + '"').join(",")
                                : ""
                        }],
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
                const eventChart = new ApexCharts(document.querySelector("#eventChart"), eventChartOptions);
                eventChart.render();
            </script>
		    </body>
	      </html>
	`);
}

interface Tweet {
    tweetId: number;
    username: string;
    tweetContent: string;
}

interface PopularTweet extends Tweet {
    profilePictureUrl: string;
    sentiment: number;
    tweetViews: number;
}

type Event = { eventType: string; count: number };

type EventTuple = [string, number];
type EventsList = EventTuple[];

/** Returns the web page. */
app.get("/", (_req: Request, res: Response) => {
    Promise.all([getTweets(), getPopular(parseInt(options.topXTweets)), getEvents()]).then(values => {
        const [tweets, popularTweets, events] = values;

        // Creates a list of tweets
        const tweetsHtml = tweets.result
            .map(
                (tweet: Tweet) => `
                    <tr onclick="generateClick(${tweet.tweetId})">
                        <td>${tweet.tweetId}</td>
                        <td>${tweet.username}</td>
                        <td>${tweet.tweetContent}</td>
                    </tr>
                `,
            )
            .join("\n");

        // Creates a list of top 10 tweets
        let popularHtml = popularTweets
            .map(
                (popularTweet: PopularTweet) => `
                    <a href='javascript:scrollAndHighlightEntry(${popularTweet.tweetId});'>
                        <li>
                            <div class="sentiment-container ${
                                popularTweet.sentiment === 1 ? "positive" : "negative"
                            }-sentiment"></div>
                            <div class="sentiment-shade"></div>
                            <div class="profile-image">
                                <img src="${popularTweet.profilePictureUrl}" alt="User profile picture">
                            </div>
                            <div class="user-info">
                                <p class="user-name">${popularTweet.username}</p>
                                <p class="sentiment-indicator">Sentiment: ${
                                    popularTweet.sentiment === 1 ? "positive" : "negative"
                                }</p>
                            </div>
                            <div class="view-count">
                                ${popularTweet.tweetViews}
                            </div>
                        </li>
                    </a>
                `,
            )
            .join("\n");

        // At launch, a loading container is created for the popular tweets
        let showLoadingMessage = false;
        if (!popularHtml) {
            showLoadingMessage = true;
            popularHtml = `
                <a href=''>
                    <li>
                        <div aria-hidden="true" class="placeholder-wave w-75"><span class="placeholder w-100"></span</div>
                    </li>
                </a>
            `.repeat(10);
        }

        const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

        const eventsList = events.map((evt: Event) => [capitalizeFirstLetter(evt.eventType), evt.count]);

        // Upon launch, a notification will appear indicating the approximate wait time until the popular Tweets container is first seen
        let loadingHTML = "";
        if (showLoadingMessage) {
            loadingHTML = `
                <div class="no-data-message content-container alert alert-primary" role="alert">
                    <div class="alert-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>
                    <div class="alert-content">
                        Waiting for the database to come up and be filled with data...<br>
                        This takes about <b>three minutes</b>. Please <b>refresh</b> in a few seconds!
                    </div>
                </div>
            `;
        }

        const html = `
            <!-- Top 10 tweets list -->
            <div class="col-lg-5 col-md-12">
                <div id="topTweets" class="top-tweets content-container">
                    <h2>Top ${options.topXTweets} Tweets</h2>
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

/** Publishes the Kafka topics. */
app.get("/tweets/:id/:event", async (req: Request, _res: Response) => {
    const event = req.params["event"];
    const tweetId = req.params["id"];
    const tweet = await getTweet(tweetId);
    const timestamp = Math.floor((new Date() as any) / 1000);
    sendBatchMessage(
        {
            tweet_id: tweet.tweetId,
            tweet: tweet.tweet,
            timestamp: timestamp,
        },
        { event_type: event, timestamp: timestamp },
    );
});

app.listen(options.port, () => logging("Node app is running at http://localhost:" + options.port));
