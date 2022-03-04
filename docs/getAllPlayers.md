# Get all Players

  Get all players, paused, playing or stopped.

  ```js
  getAllPlayers()
  ```

## Example

  ```js
  const players = Lavalink.getAllPlayers()

  players.forEach((x) => console.log(x))
  ```
  
## Observations

  You can only use this function if the guildId has a player on it. If it doesn't, see [createPlayer](docs/createPlayer.md) function.
