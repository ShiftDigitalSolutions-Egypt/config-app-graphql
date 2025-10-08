# Config App - NestJS GraphQL MongoDB Application

A complete NestJS application with GraphQL, MongoDB, and real-time subscriptions using MongoDB Change Streams. Features a **Channel** and **ChannelMessage** system for real-time communication.

## 🚀 Features

- **NestJS Framework**: Modern Node.js framework
- **GraphQL (Code-First)**: Auto-generated schema with queries, mutations, and subscriptions
- **MongoDB with Mongoose**: NoSQL database with ODM
- **Real-time Subscriptions**: MongoDB Change Streams + GraphQL subscriptions
- **Channel System**: Communication channels with messages
- **Relationship Management**: Proper Channel ↔ ChannelMessage relationships
- **Environment Configuration**: `.env` file support
- **Hot Module Replacement (HMR)**: Fast development with live reload
- **TypeScript**: Full TypeScript support
- **Validation**: Input validation with class-validator

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (running locally on port 27017 or provide custom URI)
- npm or yarn

## 🛠️ Installation

1. **Clone and navigate to the project:**
   ```bash
   cd config-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Copy `.env.example` to `.env` and configure:
   ```env
   PORT=4000
   MONGODB_URI=mongodb://localhost:27017/session_service
   GRAPHQL_PLAYGROUND=true
   ```

4. **Ensure MongoDB is running:**
   - Install and start MongoDB locally
   - Default connection: `mongodb://localhost:27017/session_service`

## 🚀 Running the Application

### Development Mode (with Hot Reload)
```bash
npm run start:dev
```

### Development Mode (with HMR - Hot Module Replacement)
```bash
npm run start:hmr
```

### Production Mode
```bash
npm run build
npm run start:prod
```

## 📊 GraphQL Playground

Once the application is running, access the GraphQL Playground at:
```
http://localhost:4000/graphql
```

## 🔧 Available Operations

### Channel Operations
```graphql
# Get all channels
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

# Create a new channel
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

### Message Operations
```graphql
# Get messages by channel
query GetChannelMessages($channelId: ID!) {
  channelMessages(channelId: $channelId) {
    _id
    content
    author
    channelId
    createdAt
    channel {
      _id
      name
    }
  }
}

# Create a new message
mutation CreateMessage($input: CreateChannelMessageInput!) {
  createChannelMessage(createChannelMessageInput: $input) {
    _id
    content
    author
    channelId
    createdAt
    channel {
      _id
      name
    }
  }
}
```

### Subscriptions (Real-time)
```graphql
# Listen for new channels
subscription OnChannelCreated {
  channelCreated {
    _id
    name
    description
    createdAt
  }
}

# Listen for new messages
subscription OnMessageCreated {
  messageCreated {
    _id
    content
    author
    channelId
    createdAt
    channel {
      name
    }
  }
}
```

## 📁 Project Structure

```
config-app/
├── src/
│   ├── channel/
│   │   ├── dto/
│   │   │   ├── channel.input.ts
│   │   │   └── channel-message.input.ts
│   │   ├── channel.module.ts
│   │   ├── channel.resolver.ts
│   │   ├── channel-message.resolver.ts
│   │   ├── channel.schema.ts
│   │   ├── channel-message.schema.ts
│   │   └── channel.service.ts
│   ├── app.module.ts
│   └── main.ts
├── .env
├── .env.example
├── package.json
├── tsconfig.json
├── nest-cli.json
├── CHANNEL_EXAMPLES.md
└── webpack-hmr.config.js
```

## 🔧 Development Scripts

```bash
# Start development server with watch mode
npm run start:dev

# Start with Hot Module Replacement
npm run start:hmr

# Build the application
npm run build

# Start production server
npm run start:prod

# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## 🌟 Key Features Implemented

1. **Environment Configuration**: Global ConfigModule with `.env` support
2. **MongoDB Integration**: Async connection using MongooseModule
3. **GraphQL Schema**: Auto-generated schema file (`schema.gql`)
4. **Real-time Updates**: MongoDB Change Streams + GraphQL subscriptions
5. **Channel System**: Communication channels with CRUD operations
6. **Message System**: Messages with channel relationships and CRUD operations
7. **Entity Relationships**: Proper Channel ↔ ChannelMessage relationships with population
8. **Validation**: Input validation using class-validator
9. **Hot Reload**: Webpack HMR configuration for fast development
10. **CORS Enabled**: For GraphQL subscriptions support

## 📝 Example Usage

1. Start MongoDB locally
2. Run `npm run start:dev`
3. Open http://localhost:4000/graphql
4. Try creating a channel, then create messages in that channel!
5. Use the `CHANNEL_EXAMPLES.md` file for complete GraphQL query examples
6. Subscribe to real-time updates and see changes in real-time!

## 🔍 Troubleshooting

- **MongoDB Connection**: Ensure MongoDB is running on localhost:27017
- **Port Conflicts**: Change PORT in .env file if 4000 is occupied
- **Dependencies**: Run `npm install` if facing module issues

## 📄 License

This project is licensed under the UNLICENSED License.