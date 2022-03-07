# Play playlist

  Starts playing a playlist.

  ```js
  <Player>.playPlaylist(<Object>)
  ```

## Example

  ```js
  // Discord.js example

  const player = Lavalink.getPlayer(message.guild.id)

  let track = player.search('Some random playlist')

  player.playPlaylist(track)


  // Eris example

  const player = Lavalink.getPlayer(message.guildID)

  let track = player.search('Some random playlist')

  player.playPlaylist(track)
  ```
  
## Observations

  This is a function from the [createPlayer](docs/createPlayer.md)/[getPlayer](docs/getPlayer.md) functions. You **will** need one of them for use this function.
