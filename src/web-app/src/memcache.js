const dns = require("dns").promises;
const MemcachePlus = require("memcache-plus");
const { options } = require("./config.js");
const { logging } = require("./utils.js");

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

module.exports = { memcached, memcachedServers, getFromCache };
