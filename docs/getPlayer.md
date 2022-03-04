# Get Player

  Gets a player, for start create a player, see createPlayer.

  ```js
  getPlayer(<PRIu64 or String>)
  ```

## Example

  ```js
  // Discord.js example
  
  const player = Lavalink.getPlayer(message.guild.id)

  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].track)
  
  
  // Eris example
  
  const player = Lavalink.getPlayer(message.guildID)

  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].track)
  ```
  
## Observations

  You can only use this function if the guildId has a player on it. If it doesn't, see [createPlayer](docs/createPlayer.md) function
