# Remove track

  Removes a track from the queue.

  ```js
  <Player>.removeTrack(<Int or String>)
  ```

## Example

  ```js
  // Discord.js example
  
  const player = Lavalink.getPlayer(message.guild.id)

  player.removeTrack(1)
  
  
  // Eris example
  
  const player = Lavalink.getPlayer(message.guildID)
  
  player.removeTrack(1)
  ```
  
## Observations

  This is a function from the [createPlayer](createPlayer.md)/[getPlayer](getPlayer.md) functions. You **will** need one of them for use this function.
