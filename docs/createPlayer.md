# createPlayer

  Creates a player in a server.  

  ```js
  createPlayer({ guildId: <PRIu64 or String>, voiceChannelId: <PRIu64 or String> })
  ```

## Example

  ```js
  const player = Lavalink.createPlayer({ guildId: message.guild.id, voiceChannelId: message.member.voice.channel.id }) // Discord.js
  
  const player = Lavalink.createPlayer({ guildId: message.guildID, voiceChannelId: message.member.voiceState.channelID }) // Eris
  ```
  
## Observations

  You will need this function for use the [connect](connect.md), [getQueue](getQueue.md), [play](play.md), [playPlaylist](playPlaylist.md), [search](search.md), [stop](stop.md), [destroy](destroy.md), [setVolume](setVolume.md) and [setPaused](setPaused.md) functions. They are necessary for the bot to play a music.
