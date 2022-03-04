# Get Queue

  Gets a queue, good for see what's the current music and see what's next.

  ```js
  getQueue(<PRIu64 or String>)
  ```

## Example

  ```js
  // Discord.js example
  
  const queue = Lavalink.getQueue(message.guild.id)

  queue.forEach((x) => console.log(x))
  
  // Eris example
  
  const queue = Lavalink.getQueue(message.guildID)

  queue.forEach((x) => console.log(x))
  ```
  
## Observations

  This function can return {} if the option for the FastLink handle the Queue it's not set for true. See [connectNode](docs/connectNode.md) options for enable it.
