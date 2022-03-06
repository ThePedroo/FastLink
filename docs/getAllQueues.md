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
  
## Observation

  This function can return {} if the option for the FastLink handle the Queue it's not set for true. See [connectNode](docs/connectNode.md) options for enable it.
