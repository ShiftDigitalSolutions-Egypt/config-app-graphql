# Channel and Message GraphQL Examples

## Channel Operations

### Create Channel
```graphql
mutation CreateChannel($input: CreateChannelInput!) {
  createChannel(createChannelInput: $input) {
    _id
    name
    description
    createdAt
    updatedAt
  }
}
```
Variables:
```json
{
  "input": {
    "name": "General Chat",
    "description": "Main discussion channel"
  }
}
```

### Get All Channels
```graphql
query GetChannels {
  channels {
    _id
    name
    description
    createdAt
    updatedAt
    messages {
      _id
      content
      author
      createdAt
    }
  }
}
```

### Get Channel by ID
```graphql
query GetChannel($id: ID!) {
  channel(id: $id) {
    _id
    name
    description
    createdAt
    updatedAt
    messages {
      _id
      content
      author
      createdAt
    }
  }
}
```

### Update Channel
```graphql
mutation UpdateChannel($id: ID!, $input: UpdateChannelInput!) {
  updateChannel(id: $id, updateChannelInput: $input) {
    _id
    name
    description
    createdAt
    updatedAt
  }
}
```
Variables:
```json
{
  "id": "YOUR_CHANNEL_ID",
  "input": {
    "name": "Updated Channel Name",
    "description": "Updated description"
  }
}
```

### Delete Channel
```graphql
mutation DeleteChannel($id: ID!) {
  deleteChannel(id: $id) {
    _id
    name
    description
  }
}
```

## Message Operations

### Create Message
```graphql
mutation CreateMessage($input: CreateChannelMessageInput!) {
  createChannelMessage(createChannelMessageInput: $input) {
    _id
    content
    author
    channelId
    createdAt
    updatedAt
    channel {
      _id
      name
      description
    }
  }
}
```
Variables:
```json
{
  "input": {
    "content": "Hello, this is my first message!",
    "author": "John Doe",
    "channelId": "YOUR_CHANNEL_ID"
  }
}
```

### Get All Messages
```graphql
query GetAllMessages {
  messages {
    _id
    content
    author
    channelId
    createdAt
    updatedAt
    channel {
      _id
      name
      description
    }
  }
}
```

### Get Messages by Channel
```graphql
query GetChannelMessages($channelId: ID!) {
  channelMessages(channelId: $channelId) {
    _id
    content
    author
    channelId
    createdAt
    updatedAt
    channel {
      _id
      name
      description
    }
  }
}
```

### Get Message by ID
```graphql
query GetMessage($id: ID!) {
  message(id: $id) {
    _id
    content
    author
    channelId
    createdAt
    updatedAt
    channel {
      _id
      name
      description
    }
  }
}
```

### Update Message
```graphql
mutation UpdateMessage($id: ID!, $input: UpdateChannelMessageInput!) {
  updateChannelMessage(id: $id, updateChannelMessageInput: $input) {
    _id
    content
    author
    channelId
    createdAt
    updatedAt
  }
}
```

### Delete Message
```graphql
mutation DeleteMessage($id: ID!) {
  deleteChannelMessage(id: $id) {
    _id
    content
    author
    channelId
  }
}
```

## Subscriptions (Real-time)

### Channel Subscriptions
```graphql
# Listen for new channels
subscription OnChannelCreated {
  channelCreated {
    _id
    name
    description
    createdAt
    updatedAt
  }
}

# Listen for updated channels
subscription OnChannelUpdated {
  channelUpdated {
    _id
    name
    description
    createdAt
    updatedAt
  }
}

# Listen for deleted channels
subscription OnChannelDeleted {
  channelDeleted {
    _id
    name
    description
  }
}
```

### Message Subscriptions
```graphql
# Listen for new messages
subscription OnMessageCreated {
  messageCreated {
    _id
    content
    author
    channelId
    createdAt
    updatedAt
    channel {
      _id
      name
    }
  }
}

# Listen for updated messages
subscription OnMessageUpdated {
  messageUpdated {
    _id
    content
    author
    channelId
    createdAt
    updatedAt
  }
}

# Listen for deleted messages
subscription OnMessageDeleted {
  messageDeleted {
    _id
    content
    author
    channelId
  }
}
```

## Complete Example Workflow

1. **Create a channel:**
   Use the `CreateChannel` mutation above

2. **Subscribe to channel updates** (in a new tab):
   Use the `OnChannelCreated` subscription

3. **Create a message in the channel:**
   Use the `CreateMessage` mutation with the channel ID

4. **Subscribe to message updates** (in another tab):
   Use the `OnMessageCreated` subscription

5. **Query all channels with their messages:**
   Use the `GetChannels` query which includes nested messages

6. **Update or delete as needed:**
   Use the respective update/delete mutations