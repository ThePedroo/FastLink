# Get all Queues

  Get all server queues with musics.

  ```js
  getAllQueues()
  ```

## Example

  ```js
  const queues = Lavalink.getAllQueues()

  queues.forEach((x) => console.log(x))
  ```
  
## Observations

  This is a function from the [createPlayer](createPlayer.md)/[getPlayer](getPlayer.md) functions. You **will** need one of them for use this function.

  This function is ignored if the option for the FastLink handle the Queue it's not set for true. See [connectNode](connectNode.md) options for enable it.
