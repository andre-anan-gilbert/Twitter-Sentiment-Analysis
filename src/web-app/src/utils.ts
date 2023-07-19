import moment from "moment";

export function logging(message: string) {
  const dateTime = new Date();
  console.log(
    moment(dateTime).format("YY/MM/DD HH:MM:SS") + " INFO " + message
  );
}
