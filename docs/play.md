# Play Music

  Starts playing a music.

  ```js
  <Player>.play(<String>)
  ```

## Example

  ```js
  // Discord.js example

  const player = Lavalink.getPlayer(message.guild.id)

  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].encoded)


  // Eris example

  const player = Lavalink.getPlayer(message.guildID)

  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].encoded)
  ```
  
## Observations

  This is a function from the [createPlayer](createPlayer.md)/[getPlayer](getPlayer.md) functions. You **will** need one of them for use this function.
