const moment = require("moment");

function logging(message) {
  const dateTime = new Date();
  console.log(
    moment(dateTime).format("YY/MM/DD HH:MM:SS") + " INFO " + message
  );
}

module.exports = { logging };
