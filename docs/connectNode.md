# Connect Node

  Connects to a Lavalink node and get it's events.

  ```js
  connectNode([{ host: <String>, secure: <Boolean>, password: <String>, port: <Int or boolean> }], { market: <String>, shards: <Int>, botId: <PRIu64 or String>, handleQueue: <Boolean> }, <Function>)
  ```

## Example

  ```js
  // Discord.js example

  const events = Lavalink.connectNode([{ host: 'example.com', secure: true, password: 'youshallnotpass', port: undefined }], { market: 'US', shards: 1, botId: '1234567891011121314' }, (guildId, payload) => {
    client.guilds.cache.get(guildId).shard.send(payload)
  })


  // Eris example

  const events = Lavalink.connectNode([{ host: 'example.com', secure: true, password: 'youshallnotpass', port: undefined }], { market: 'US', shards: 1, botId: '1234567891011121314' }, (guildId, payload) => {
    client.guilds.get(guildId).shard.ws.send(payload)
  })
  
  
  events.on('trackStart', () => console.log('Playing music, now!'))
  events.on('trackEnd', () => console.log('Stopped playing music! :(')
  ```
  
## Observations

  Just one node is supported for now, and handleQueue will make FastLink make and handle a music queue.
  
  This is the old getLavalinkEvents with the connectNode.
