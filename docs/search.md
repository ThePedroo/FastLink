# Search

  Search for musics similar or equal to the url / name.

  ```js
  <Player>.search(<String>)
  ```

## Example

  ```js
  // Discord.js example

  const player = Lavalink.getPlayer(message.guild.id)

  let track = player.search('Rick Astley - Never Gonna Give You Up')

  console.log(track.tracks[0].info)


  // Eris example

  const player = Lavalink.getPlayer(message.guildID)

  let track = player.search('Rick Astley - Never Gonna Give You Up')

  console.log(track.tracks[0].info)
  ```
  
## Observations

  This is a function from the [createPlayer](createPlayer.md)/[getPlayer](getPlayer.md) functions. You **will** need one of them for use this function.
