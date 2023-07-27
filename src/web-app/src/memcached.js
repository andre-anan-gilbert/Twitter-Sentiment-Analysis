/** Memcached servers. */
import { promises as dns } from "dns";
import MemcachePlus from "memcache-plus";
import { options } from "./config.js";
import { logging } from "./utils.js";

export let memcached = null;
export let memcachedServers = [];

/** Gets the memcached servers. */
async function getMemcachedServersFromDns() {
    try {
        // Query all IP addresses for this hostname
        const queryResult = await dns.lookup(options.memcachedHostname, {
            all: true,
        });

        // Create IP:Port mappings
        const servers = queryResult.map(el => el.address + ":" + options.memcachedPort);

        // Check if the list of servers has changed
        // and only create a new object if the server list has changed
        if (memcachedServers.sort().toString() !== servers.sort().toString()) {
            logging("Updated memcached server list to " + servers);
            memcachedServers = servers;

            // Disconnect an existing client
            if (memcached) await memcached.disconnect();

            memcached = new MemcachePlus(memcachedServers);
        }
    } catch (error) {
        logging("Unable to get memcache servers (yet)");
    }
}

/**
 * Gets the data from memcached.
 * @param key The key of the stored value.
 * @return The cached value, if it exists.
 */
export async function getFromCache(key) {
    if (!memcached) {
        logging(`No memcached instance available, memcachedServers = ${memcachedServers}`);
        return null;
    }
    return await memcached.get(key);
}

// Initially try to connect to the memcached servers, then update the server list every 5s
getMemcachedServersFromDns();
setInterval(getMemcachedServersFromDns, options.memcachedUpdateInterval);
