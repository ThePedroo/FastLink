# Connect Node

  Connects to a Lavalink node.

  ```js
  connectNode([{ host: <String>, secure: <Boolean>, password: <String>, port: <Int or boolean> }], { shards: <Int>, botId: <PRIu64 or String>, handleQueue: <Boolean> }, <Function>)
  ```

## Example

  ```js
  // Discord.js example

  Lavalink.connectNode([{ host: 'example.com', secure: true, password: 'youshallnotpass', port: undefined }], { shards: 1, botId: '1234567891011121314' }, (guildId, payload) => {
    client.guilds.cache.get(guildId).shard.send(payload)
  })

  // Eris example

  Lavalink.connectNode([{ host: 'example.com', secure: true, password: 'youshallnotpass', port: undefined }], { shards: 1, botId: '1234567891011121314' }, (guildId, payload) => {
    client.guilds.get(guildId).shard.ws.send(payload)
  })
  ```
  
## Observations

  Just one node is supported for now, and handleQueue will make FastLink make and handle a music queue.
