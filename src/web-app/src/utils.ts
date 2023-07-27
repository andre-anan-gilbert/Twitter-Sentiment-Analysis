import moment from "moment";

/** Logs messages in PySpark format. */
export function logging(message: string) {
    const date = new Date();
    console.log(moment(date).format("YY/MM/DD HH:MM:SS") + " INFO " + message);
}
