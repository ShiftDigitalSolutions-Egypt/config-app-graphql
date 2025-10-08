# PubSub Service Architecture

## Overview

The `PubSubService` has been extracted into a separate, reusable service that handles all GraphQL subscription and real-time event management for the Channel application.

## Architecture

### Files Created/Modified:

```
src/
├── common/
│   └── enums.ts                   # Event kind enums
├── channel/
│   ├── pubsub.service.ts         # New PubSub service
│   ├── channel.types.ts          # Type definitions
│   ├── channel.service.ts        # Updated to use PubSubService
│   └── channel.module.ts         # Updated to include PubSubService
```

## PubSub Service Features

### 🎯 **Core Methods**

#### **Channel Events**
```typescript
// Publish channel events with structured data
await pubSubService.publishChannelEvent(channel, ChannelEventKind.CREATED);
await pubSubService.publishChannelEvent(channel, ChannelEventKind.UPDATED);
await pubSubService.publishChannelEvent(channel, ChannelEventKind.DELETED);
```

#### **Message Events**
```typescript
// Publish message events with structured data
await pubSubService.publishMessageEvent(message, MessageEventKind.CREATED);
await pubSubService.publishMessageEvent(message, MessageEventKind.UPDATED);
await pubSubService.publishMessageEvent(message, MessageEventKind.DELETED);
```

#### **Async Iterators**
```typescript
// Get channel-specific iterators
pubSubService.getAsyncIterator(channelId)
pubSubService.getChannelAsyncIterator()
pubSubService.getMessageAsyncIterator(channelId?)
```

#### **Legacy Support**
```typescript
// Backward compatibility with existing resolvers
pubSubService.channelCreated()
pubSubService.channelUpdated()
pubSubService.channelDeleted()
pubSubService.messageCreated()
pubSubService.messageUpdated()
pubSubService.messageDeleted()
```

### 🏗️ **Event Structure**

#### **Channel Event**
```typescript
interface ChannelEvent {
  kind: ChannelEventKind;  // CREATED | UPDATED | DELETED
  channel: ChannelGQL;
}
```

#### **Message Event**
```typescript
interface MessageEvent {
  kind: MessageEventKind;  // CREATED | UPDATED | DELETED
  message: ChannelMessageGQL;
}
```

### 📡 **Event Channels**

The service publishes to multiple channels for flexibility:

- `CHANNEL_EVENTS_${channelId}` - Channel-specific events
- `CHANNEL_EVENTS` - Global channel events  
- `MESSAGE_EVENTS_${channelId}` - Channel-specific message events
- `MESSAGE_EVENTS` - Global message events
- Legacy channels: `channelCreated`, `messageCreated`, etc.

## Benefits of This Architecture

### ✅ **Separation of Concerns**
- Business logic in `ChannelService`
- Event publishing in `PubSubService`
- Clear separation of responsibilities

### ✅ **Reusability**
- PubSubService can be used by other modules
- Consistent event structure across the application
- Exportable service for external consumption

### ✅ **Type Safety**
- Strongly typed event structures
- Enum-based event kinds
- TypeScript interfaces for all data

### ✅ **Scalability**
- Channel-specific subscriptions
- Global event streams
- Easy to extend with new event types

### ✅ **Backward Compatibility**
- Legacy subscription methods maintained
- Existing GraphQL resolvers continue to work
- Gradual migration path

## Usage Examples

### In Services:
```typescript
@Injectable()
export class ChannelService {
  constructor(
    private readonly pubSubService: PubSubService,
  ) {}

  async createChannel(input: CreateChannelInput) {
    // ... create logic
    await this.pubSubService.publishChannelEvent(channel, ChannelEventKind.CREATED);
    return channel;
  }
}
```

### In Resolvers:
```typescript
@Resolver()
export class ChannelResolver {
  constructor(private readonly channelService: ChannelService) {}

  @Subscription()
  channelCreated() {
    return this.channelService.channelCreated();
  }
}
```

### New Event-Based Subscriptions:
```typescript
@Subscription()
channelEvents(@Args('channelId') channelId: string) {
  return this.pubSubService.getAsyncIterator(channelId);
}
```

## Migration Benefits

1. **Cleaner Code**: Removed PubSub dependency from ChannelService
2. **Better Testing**: PubSubService can be easily mocked
3. **Enhanced Events**: Structured events with metadata
4. **Future-Ready**: Easy to add new event types and channels
5. **Monitoring**: Centralized event publishing for logging/monitoring

This refactoring maintains all existing functionality while providing a more robust, scalable, and maintainable event system.