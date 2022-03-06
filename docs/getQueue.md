# Get Queue

  Gets a queue, good for see what's the current music and see what's next.

  ```js
  getQueue(<PRIu64 or String>)
  ```

## Example

  ```js
  // Discord.js example
  
  const player = Lavalink.getPlayer(message.guild.id)
  
  const queue = Player.getQueue()

  queue.forEach((x) => console.log(x))
  
  // Eris example
  
  const player = Lavalink.getPlayer(message.guildID)
  
  const queue = Plater.getQueue()

  queue.forEach((x) => console.log(x))
  ```
  
## Observations

  This is a function from the [createPlayer](docs/createPlayer.md)/[getPlayer](docs/getPlayer.md) functions. You **will** need one of them for use this function.

  This function is ignored if the option for the FastLink handle the Queue it's not set for true. See [connectNode](docs/connectNode.md) options for enable it.
