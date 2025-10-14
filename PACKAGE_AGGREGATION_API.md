
# Package Aggregation GraphQL API

This document provides examples of GraphQL queries, mutations, and subscriptions for the Package Aggregation functionality.

## Mutations

### 1. Start Package Aggregation Session

```graphql
mutation StartPackageAggregation($input: StartPackageAggregationInput!) {
  startPackageAggregation(input: $input) {
    _id
    name
    description
    status
    sessionMode
    userId
    processedQrCodes
    createdAt
    updatedAt
  }
}
```

Variables:
```json
{
  "input": {
    "name": "Package Aggregation Session 001",
    "description": "Aggregating packages for batch XYZ",
    "sessionMode": "PACKAGE_AGGREGATION",
    "userId": "user123"
  }
}
```

### 2. Process Aggregation Message

```graphql
mutation ProcessAggregationMessage($input: ProcessAggregationMessageInput!) {
  processAggregationMessage(input: $input) {
    _id
    content
    author
    channelId
    status
    aggregationData {
      composedQrCode
      outerQrCode
      productId
      eventType
      metadata
    }
    errorMessage
    createdAt
    updatedAt
  }
}
```

Variables:
```json
{
  "input": {
    "channelId": "64f7e8b9c1234567890abcde",
    "composedQrCode": "COMPOSED_QR_12345",
    "outerQrCode": "OUTER_QR_67890",
    "author": "operator001",
    "eventType": "PACKAGE_CONFIGURATION",
    "metadata": "{\"batchId\": \"B001\", \"location\": \"Warehouse A\"}"
  }
}
```

### 3. Update Channel Status

```graphql
mutation UpdateChannelStatus($input: UpdateChannelStatusInput!) {
  updateChannelStatus(input: $input) {
    _id
    name
    status
    sessionMode
    processedQrCodes
    updatedAt
  }
}
```

Variables:
```json
{
  "input": {
    "channelId": "64f7e8b9c1234567890abcde",
    "status": "CLOSED"
  }
}
```

## Queries

### 1. Get Channels

```graphql
query GetChannels {
  channels {
    _id
    name
    description
    status
    sessionMode
    userId
    processedQrCodes
    createdAt
    updatedAt
  }
}
```

### 2. Get Channel Messages

```graphql
query GetChannelMessages($channelId: ID!) {
  channelMessages(channelId: $channelId) {
    _id
    content
    author
    status
    aggregationData {
      composedQrCode
      outerQrCode
      productId
      eventType
      metadata
    }
    errorMessage
    createdAt
    channel {
      _id
      name
      status
    }
  }
}
```

Variables:
```json
{
  "channelId": "64f7e8b9c1234567890abcde"
}
```

## Subscriptions

### 1. Package Aggregation Events

```graphql
subscription PackageAggregationEvents($channelId: ID) {
  packageAggregationEvents(channelId: $channelId) {
    channelId
    messageId
    eventType
    data
    error
  }
}
```

### 2. Validation Events

```graphql
subscription ValidationEvents($channelId: ID) {
  validationEvents(channelId: $channelId) {
    channelId
    messageId
    eventType
    data
    error
  }
}
```

### 3. Configuration Events

```graphql
subscription ConfigurationEvents($channelId: ID) {
  configurationEvents(channelId: $channelId) {
    channelId
    messageId
    eventType
    data
    error
  }
}
```

### 4. Error Events

```graphql
subscription AggregationErrorEvents($channelId: ID) {
  aggregationErrorEvents(channelId: $channelId) {
    channelId
    messageId
    eventType
    data
    error
  }
}
```

### 5. Channel Events

```graphql
subscription ChannelEvents {
  channelCreated {
    _id
    name
    status
    sessionMode
    processedQrCodes
    createdAt
  }
}
```

### 6. Message Events

```graphql
subscription MessageEvents($channelId: ID) {
  messageCreated(channelId: $channelId) {
    _id
    content
    author
    status
    aggregationData {
      composedQrCode
      outerQrCode
      eventType
    }
    errorMessage
    createdAt
  }
}
```

## Example Workflow

1. **Start Session**: Use `startPackageAggregation` to create a new aggregation channel
2. **Subscribe to Events**: Subscribe to `packageAggregationEvents` for real-time updates
3. **Process QR Codes**: Use `processAggregationMessage` to validate and configure QR codes
4. **Monitor Progress**: Use subscriptions to track validation, configuration, and error events
5. **Close Session**: Use `updateChannelStatus` to close or finalize the session

## Status Enums

### Channel Status
- `OPEN`: Channel is active and accepting messages
- `PAUSED`: Channel is temporarily paused
- `CLOSED`: Channel is closed but can be reopened
- `FINALIZED`: Channel is permanently closed

### Message Status
- `PROCESSING`: Message is being processed
- `VALID`: Message processed successfully
- `ALREADY_CONFIGURED`: QR code already configured
- `TYPE_MISMATCH`: QR code type doesn't match expected
- `DUPLICATE_IN_SESSION`: QR code already processed in this session
- `NOT_FOUND`: QR code not found
- `WRONG_TYPE`: QR code is wrong type
- `NOT_CONFIGURED`: OUTER QR code not configured
- `PRODUCT_NOT_FOUND`: Product not found
- `ERROR`: General error occurred

### Session Mode
- `PACKAGE_AGGREGATION`: Package-level aggregation
- `PALLET_AGGREGATION`: Pallet-level aggregation