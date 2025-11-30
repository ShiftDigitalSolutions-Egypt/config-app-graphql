# Package & Pallet Aggregation System Documentation

## Overview

This documentation describes the complete end-to-end flow for both **Package Aggregation** and **Pallet Aggregation** in the Channel module. The system provides real-time processing capabilities for QR code aggregation workflows with different hierarchical levels.

## Architecture Overview

### Key Components

- **PackageAggregationService**: Core business logic for both aggregation types
- **PackageAggregationResolver**: GraphQL resolvers for mutations and subscriptions
- **PubSubService**: Real-time event publishing and subscription management
- **Channel Schema**: Database model for aggregation sessions
- **ChannelMessage Schema**: Database model for individual aggregation operations

### Session Modes

- **PACKAGE_AGGREGATION**: Aggregates OUTER QR codes into Package QR codes
- **PALLET_AGGREGATION**: Aggregates Package QR codes into Pallet QR codes
- **FULL_AGGREGATION**: Complete top-down aggregation flow (OUTER → Package → Pallet) in a single session

---

## Complete Workflow Analysis

## 🔄 Package Aggregation Lifecycle

### Phase 1: Session Initialization (`startAggregation`)

**Purpose**: Create and initialize a new aggregation session for combining OUTER QRs into a Package QR.

**GraphQL Mutation**:
```graphql
mutation StartPackageAggregation {
  startAggregation(input: {
    name: "Package Production Batch A001"
    description: "Processing OUTER QRs for package creation"
    sessionMode: PACKAGE_AGGREGATION
    productId: "63f7693118b7e3cc374a6cdc"
    targetQrCode: "https://qara-dynamic-link.web.app/?type=qr&appName=HSE-KSA&value=-PACKAGE-xyz123"
    userId: "operator_001"
  }) {
    _id
    name
    status
    sessionMode
    processedQrCodes
    createdAt
  }
}
```

**Process Flow**:
1. **Target QR Validation**: Validates target Package QR using `validateTargetPackageForAggregation()`
   - Checks QR exists in database
   - Validates QR is of type `COMPOSED` (Package)
   - Ensures QR is not already configured
   - Prevents duplicate aggregation sessions

2. **Channel Creation**: Creates new channel record with:
   - Status: `OPEN`
   - SessionMode: `PACKAGE_AGGREGATION`
   - Empty `processedQrCodes` array
   - Target Package QR code reference

3. **Event Publishing**: Publishes `CHANNEL_CREATED` event via PubSub

**Validation Rules**:
- Target QR must exist and be of kind `COMPOSED`
- Target QR must not be already configured (`configuredDate` should be null)
- No existing open channel for the same target QR

### Phase 2: Real-time Processing (`processAggregationMessage`)

**Purpose**: Validate and process individual OUTER QR codes for aggregation into the package.

**GraphQL Mutation**:
```graphql
mutation ProcessOuterQR {
  processAggregationMessage(input: {
    channelId: "68ff3d8457bc9c27daf3dc17"
    childQrCode: "https://qara-dynamic-link.web.app/?type=qr&appName=HSE-KSA&value=-OUTER-abc456"
    author: "operator_001"
    eventType: "PACKAGE_CONFIGURATION"
    metadata: "{\"batchId\": \"A001\", \"lineNumber\": 1}"
  }) {
    _id
    content
    status
    aggregationData {
      targetQr
      childQrCode
      eventType
    }
  }
}
```

**Process Flow**:
1. **Channel Validation**: Ensures channel exists and is in `OPEN` status
2. **Message Creation**: Creates initial message with `PROCESSING` status
3. **OUTER QR Validation**: Uses `validateOuterForPackageAggregation()`
   - Checks for duplicates in session
   - Validates OUTER QR exists and is type `OUTER`
   - Ensures OUTER QR is configured
   - Verifies OUTER QR is not already aggregated
   - Validates product matches channel product

4. **Success Path**:
   - Updates message status to `VALID`
   - Adds QR to channel's `processedQrCodes`
   - Publishes `VALIDATION_COMPLETED` event

5. **Error Path**:
   - Updates message with error status and message
   - Publishes `ERROR` event

**Real-time Events**:
- `VALIDATION_COMPLETED`: Successfully validated OUTER QR
- `ERROR`: Validation failed with specific error message

### Phase 3: Session Finalization (`finalizeChannel`)

**Purpose**: Execute configuration, relationship updates, and close the aggregation session.

**GraphQL Mutation**:
```graphql
mutation FinalizePackageAggregation {
  finalizeChannel(input: {
    channelId: "68ff3d8457bc9c27daf3dc17"
  }) {
    _id
    status
    processedQrCodes
    updatedAt
  }
}
```

**Process Flow**:
1. **Session Mode Detection**: Routes to `finalizePackageAggregation()`
2. **Message Processing**: Retrieves all validated messages from the session
3. **Target QR Enrichment** (Phase 2B - One-time):
   - Uses first OUTER QR to enrich Package QR metadata
   - Sets configuration flags and metadata from first OUTER
   - Marks package as configured with `configuredDate`

4. **Per-Message Processing** (Phase 2A & 3):
   - **Counter Configuration**: Updates package counters and product data
   - **Relationship Updates**: Sets OUTER QR's `directParent` to package QR
   - Updates message status to completed
   - Publishes `CONFIGURATION_COMPLETED` events

5. **Channel Closure**:
   - Updates channel status to `FINALIZED`
   - Closes all subscriptions
   - Publishes `SESSION_CLOSED` event

**Real-time Events**:
- `CONFIGURATION_COMPLETED`: Per OUTER QR configuration success
- `SESSION_CLOSED`: Channel finalization complete

---

## 🔄 Full Aggregation Lifecycle

### Phase 1: Session Initialization (`startAggregation`)

**Purpose**: Create a complete aggregation session that handles both package and pallet aggregation in a structured, sequential flow.

**GraphQL Mutation**:
```graphql
mutation StartFullAggregation {
  startAggregation(input: {
    name: "Complete Production Line A001"
    description: "Full aggregation flow: OUTER → Package → Pallet"
    sessionMode: FULL_AGGREGATION
    productId: "63f7693118b7e3cc374a6cdc"
    targetQrCode: "https://qara-dynamic-link.web.app/?type=qr&appName=HSE-KSA&value=-PALLET-xyz789"
    userId: "operator_001"
    packagesPerPallet: 4
    outersPerPackage: 6
  }) {
    _id
    name
    status
    sessionMode
    packagesPerPallet
    outersPerPackage
    currentPackageIndex
    currentOuterCount
    processedQrCodes
    createdAt
  }
}
```

**Process Flow**:
1. **Target QR Validation**: Validates target Pallet QR using `validateTargetPalletForAggregation()`
   - Checks pallet QR exists and is suitable for pallet operations
   - Ensures pallet QR is not already configured

2. **Configuration Validation**: Validates FULL_AGGREGATION specific parameters
   - `packagesPerPallet` must be > 0
   - `outersPerPackage` must be > 0
   - Both parameters are required for FULL_AGGREGATION mode

3. **Channel Creation**: Creates channel with FULL_AGGREGATION state tracking:
   - `currentPackageIndex`: 0 (starts with first package)
   - `currentOuterCount`: 0 (starts with first outer)
   - `currentPackageQr`: null (no package selected initially)

**Validation Rules**:
- Target must be a valid pallet QR (COMPOSED type, not configured)
- `packagesPerPallet` and `outersPerPackage` are mandatory and must be positive integers
- Standard product and user validation applies

### Phase 2: Sequential Processing (`processAggregationMessage`)

**Purpose**: Handle sequential processing of Package QRs followed by their constituent OUTER QRs in a structured manner.

**Flow Pattern**:
```
1. Package QR #1 → Outer QR #1 → Outer QR #2 → ... → Outer QR #N
2. Package QR #2 → Outer QR #1 → Outer QR #2 → ... → Outer QR #N  
3. Package QR #3 → Outer QR #1 → Outer QR #2 → ... → Outer QR #N
4. Package QR #4 → Outer QR #1 → Outer QR #2 → ... → Outer QR #N
```

**GraphQL Mutations**:

*Processing a Package QR*:
```graphql
mutation ProcessPackageInFullAggregation {
  processAggregationMessage(input: {
    channelId: "68ff3d8457bc9c27daf3dc17"
    childQrCode: "https://qara-dynamic-link.web.app/?type=qr&appName=HSE-KSA&value=-PACKAGE-abc123"
    author: "operator_001"
    eventType: "FULL_AGGREGATION_PACKAGE"
    metadata: "{\"packageIndex\": 1, \"palletId\": \"P001\"}"
  }) {
    _id
    content
    status
    aggregationData {
      targetQr
      childQrCode
      eventType
    }
  }
}
```

*Processing an OUTER QR*:
```graphql
mutation ProcessOuterInFullAggregation {
  processAggregationMessage(input: {
    channelId: "68ff3d8457bc9c27daf3dc17"
    childQrCode: "https://qara-dynamic-link.web.app/?type=qr&appName=HSE-KSA&value=-OUTER-def456"
    author: "operator_001"
    eventType: "FULL_AGGREGATION_OUTER"
    metadata: "{\"outerIndex\": 1, \"packageId\": \"PACKAGE-abc123\"}"
  }) {
    _id
    content
    status
    aggregationData {
      targetQr
      childQrCode
      eventType
    }
  }
}
```

**Process Flow**:
1. **Session State Analysis**: Determines what type of QR is expected based on channel state
   - If `currentOuterCount` = 0 or `currentPackageQr` is null → Expecting Package QR
   - Otherwise → Expecting OUTER QR for current package

2. **Validation**: Uses `validateFullAggregation()` which routes to appropriate validation:
   - **Package QR**: Must be COMPOSED, configured, not already aggregated
   - **OUTER QR**: Must be OUTER type, configured, not already aggregated
   - **Product Validation**: Must match channel product

3. **State Updates**: Updates channel state via `updateFullAggregationState()`:
   - **Package QR processed**: Sets `currentPackageQr`, resets `currentOuterCount` to 0, increments `currentPackageIndex`
   - **OUTER QR processed**: Increments `currentOuterCount`
   - **Package completion**: When `currentOuterCount` reaches `outersPerPackage`, resets `currentPackageQr` to null

4. **Real-time Events**: Enhanced event data includes session progress:
   - `isPackageQr`: Boolean indicating QR type processed
   - `currentPackageIndex`: Current package being processed
   - `currentOuterCount`: Outers processed for current package
   - `isSessionComplete`: Whether all packages and outers are complete

**Validation Rules**:
- **Sequential Processing**: Must follow Package → Outers → Package → Outers pattern
- **Package Limits**: Cannot exceed `packagesPerPallet`
- **Outer Limits**: Cannot exceed `outersPerPackage` per package
- **QR Type Validation**: Must provide correct QR type based on current state
- **Standard Validation**: All existing validation rules apply (duplicates, product matching, etc.)

### Phase 3: Session Finalization (`finalizeChannel`)

**Purpose**: Execute dual-phase aggregation (package aggregation + pallet aggregation) and close the session.

**GraphQL Mutation**:
```graphql
mutation FinalizeFullAggregation {
  finalizeChannel(input: {
    channelId: "68ff3d8457bc9c27daf3dc17"
  }) {
    _id
    status
    processedQrCodes
    packagesPerPallet
    outersPerPackage
    updatedAt
  }
}
```

**Process Flow**:
1. **Session Mode Detection**: Routes to `finalizeFullAggregation()`
2. **Message Grouping**: Groups validated messages using `groupFullAggregationMessages()`:
   - Separates Package QR messages from OUTER QR messages
   - Maintains package-to-outers relationships based on processing sequence

3. **Phase 2A - Package Aggregations**: Processes each package and its outers
   - **Package Metadata Enrichment**: Uses first OUTER QR to enrich each Package QR
   - **OUTER → Package Relationships**: Sets up `directParent` relationships
   - **Counter Updates**: Aggregates OUTER counts into Package QR
   - **Events**: Publishes `PACKAGE_COMPLETION` events per package

4. **Phase 2B - Pallet Aggregation**: Processes all packages into the pallet
   - **Pallet Metadata Enrichment**: Uses first Package QR to enrich Pallet QR
   - **Package → Pallet Relationships**: Sets up pallet hierarchy
   - **Cascading Updates**: Updates all OUTER QRs to include pallet in `parents` array
   - **Counter Aggregation**: Rolls up all package counts to pallet level
   - **Events**: Publishes `PALLET_COMPLETION` event

5. **Channel Closure**: Standard finalization
   - Updates channel status to `FINALIZED`
   - Closes subscriptions
   - Publishes `SESSION_CLOSED` with aggregation statistics

**Real-time Events**:
- `PACKAGE_COMPLETION`: When a package and all its outers are processed
- `PALLET_COMPLETION`: When all packages are aggregated to the pallet
- `SESSION_CLOSED`: Final event with complete statistics

**Result Hierarchy**:
```
Pallet QR (target)
├── Package QR #1
│   ├── OUTER QR #1
│   ├── OUTER QR #2
│   └── ... (up to outersPerPackage)
├── Package QR #2
│   ├── OUTER QR #1
│   ├── OUTER QR #2
│   └── ... (up to outersPerPackage)
└── ... (up to packagesPerPallet)
```

---

## 🔄 Pallet Aggregation Lifecycle

### Phase 1: Session Initialization (`startAggregation`)

**Purpose**: Create and initialize a new aggregation session for combining Package QRs into a Pallet QR.

**GraphQL Mutation**:
```graphql
mutation StartPalletAggregation {
  startAggregation(input: {
    name: "Pallet Formation Batch P001"
    description: "Processing packages for pallet creation"
    sessionMode: PALLET_AGGREGATION
    productId: "63f7693118b7e3cc374a6cdc"
    targetQrCode: "https://qara-dynamic-link.web.app/?type=qr&appName=HSE-KSA&value=-PALLET-xyz789"
    userId: "operator_001"
  }) {
    _id
    name
    status
    sessionMode
    processedQrCodes
    createdAt
  }
}
```

**Process Flow**:
1. **Target QR Validation**: Validates target Pallet QR using `validateTargetPalletForAggregation()`
   - Checks QR exists and is of appropriate type for pallet
   - Ensures QR is not already configured
   - Prevents duplicate pallet sessions

2. **Channel Creation**: Creates new channel with `PALLET_AGGREGATION` mode

**Validation Rules**:
- Target QR must be suitable for pallet aggregation
- Target QR must not be already configured
- Product validation for pallet operations

### Phase 2: Real-time Processing (`processAggregationMessage`)

**Purpose**: Validate and process individual Package QR codes for aggregation into the pallet.

**GraphQL Mutation**:
```graphql
mutation ProcessPackageQR {
  processAggregationMessage(input: {
    channelId: "68ff3d8457bc9c27daf3dc17"
    childQrCode: "https://qara-dynamic-link.web.app/?type=qr&appName=HSE-KSA&value=-PACKAGE-def789"
    author: "operator_001"
    eventType: "PALLET_CONFIGURATION"
    metadata: "{\"palletId\": \"P001\", \"position\": 1}"
  }) {
    _id
    content
    status
    aggregationData {
      targetQr
      childQrCode
      eventType
    }
  }
}
```

**Process Flow**:
1. **Channel Validation**: Ensures pallet aggregation channel is active
2. **Package QR Validation**: Uses `validatePackageForPalletAggregation()`
   - Checks for duplicates in pallet session
   - Validates Package QR exists and is type `COMPOSED`
   - Ensures Package QR is already configured (packages must be finalized)
   - Verifies Package QR is not already on another pallet
   - Validates product consistency

3. **Success/Error Processing**: Similar to package aggregation

**Validation Rules**:
- Package QR must be `COMPOSED` type and already configured
- Package QR must not already be on a pallet (`directParent` should be null)
- Product must match the pallet session product

### Phase 3: Session Finalization (`finalizeChannel`)

**Purpose**: Configure pallet, update hierarchical relationships, and close the session.

**Process Flow**:
1. **Session Mode Detection**: Routes to `finalizePalletAggregation()`
2. **Pallet QR Enrichment** (Phase 2B):
   - Uses first Package QR to enrich Pallet QR metadata
   - Sets pallet-specific flags (`hasPallet: true`, `hasAgg: false`)

3. **Per-Package Processing** (Phase 2A & 3):
   - **Counter Configuration**: Updates pallet counters (aggregates from packages)
   - **Hierarchical Relationship Updates**: 
     - Sets Package QR's `directParent` to pallet QR
     - **Cascading Updates**: Updates all OUTER QRs that belong to packages
     - Adds pallet to `parents` array of all constituent OUTER QRs

4. **Channel Closure**: Same as package aggregation

**Key Difference - Cascading Relationships**:
When a package is added to a pallet, the system:
1. Updates the Package QR → Pallet QR relationship
2. Finds all OUTER QRs where `directParent = packageQR.value`
3. Adds the pallet to the `parents` array of all those OUTER QRs

This creates the complete hierarchy: `OUTER → Package → Pallet`

---

## 🔄 Real-time Subscription System

### Main Subscription

**GraphQL Subscription**:
```graphql
subscription PackageAggregationEvents($channelId: ID!) {
  packageAggregationEvents(channelId: $channelId) {
    channelId
    messageId
    eventType
    data
    error
    status
  }
}
```

### Event Types

| Event Type | Trigger | Package Aggregation | Pallet Aggregation | Full Aggregation |
|------------|---------|-------------------|------------------|-----------------|
| `VALIDATION_COMPLETED` | QR successfully validated | ✅ OUTER QR validated | ✅ Package QR validated | ✅ Package/OUTER QR validated |
| `CONFIGURATION_COMPLETED` | QR configuration finished | ✅ OUTER → Package config | ✅ Package → Pallet config | ✅ OUTER → Package config |
| `PACKAGE_COMPLETION` | Package fully configured | ❌ Not applicable | ❌ Not applicable | ✅ Package + all outers complete |
| `PALLET_COMPLETION` | Pallet fully configured | ❌ Not applicable | ❌ Not applicable | ✅ All packages aggregated to pallet |
| `SESSION_CLOSED` | Channel finalized | ✅ Package session closed | ✅ Pallet session closed | ✅ Full session closed |
| `ERROR` | Validation/processing error | ✅ OUTER QR errors | ✅ Package QR errors | ✅ Package/OUTER QR errors |

### Event Data Structure

```typescript
interface PackageAggregationEvent {
  channelId: string;          // Channel identifier
  messageId: string;          // Message identifier
  eventType: string;          // Event type (see above)
  data: string;              // JSON serialized event data
  error?: string;            // Error message if applicable
  status?: MessageStatus;    // Message status
}
```

---

## 🏗️ Database Schema Changes

### QR Code Relationships

**Package Aggregation Result**:
```javascript
// OUTER QR after aggregation
{
  value: "OUTER-abc123",
  directParent: "PACKAGE-xyz789",
  parents: ["PACKAGE-xyz789"],
  type: "OUTER",
  configuredDate: "2024-01-01T10:00:00Z"
}

// Package QR after aggregation
{
  value: "PACKAGE-xyz789",
  kind: "COMPOSED",
  configuredDate: "2024-01-01T10:05:00Z",
  hasAgg: true,
  hasPallet: false,
  productData: [/* aggregated counters */]
}
```

**Pallet Aggregation Result**:
```javascript
// Package QR after pallet aggregation
{
  value: "PACKAGE-xyz789",
  directParent: "PALLET-abc456",
  parents: ["PALLET-abc456"],
  hasPallet: false,
  hasAgg: true
}

// OUTER QR after pallet aggregation (cascaded update)
{
  value: "OUTER-abc123",
  directParent: "PACKAGE-xyz789",
  parents: ["PACKAGE-xyz789", "PALLET-abc456"], // Pallet added
}

// Pallet QR after aggregation
{
  value: "PALLET-abc456",
  kind: "COMPOSED",
  configuredDate: "2024-01-01T11:00:00Z",
  hasAgg: false,
  hasPallet: true,
  productData: [/* aggregated from packages */]
}
```

---

## 🎯 Key Validation Rules

### Package Aggregation
- **Target**: Must be `COMPOSED`, not configured
- **Child (OUTER)**: Must be `OUTER` type, configured, not aggregated
- **Product**: Must match channel product
- **Session**: No duplicates in same session

### Pallet Aggregation  
- **Target**: Must be suitable for pallet, not configured
- **Child (Package)**: Must be `COMPOSED`, configured, not on pallet
- **Product**: Must match channel product
- **Hierarchy**: Updates cascade to all OUTER QRs in packages

### Full Aggregation
- **Target (Pallet)**: Must be suitable for pallet, not configured
- **Configuration**: `packagesPerPallet` and `outersPerPackage` must be > 0
- **Sequential Processing**: Must follow Package → OUTERs → Package pattern
- **Package Limits**: Cannot exceed specified `packagesPerPallet`
- **Outer Limits**: Cannot exceed specified `outersPerPackage` per package
- **QR Type Validation**: System enforces correct QR type based on session state
- **Product**: All QRs must match channel product
- **Hierarchy**: Creates complete OUTER → Package → Pallet hierarchy

---

## 🔧 Error Handling

### Common Error Scenarios

| Error Type | Package Aggregation | Pallet Aggregation |
|------------|-------------------|------------------|
| `NOT_FOUND` | OUTER QR not in database | Package QR not in database |
| `WRONG_TYPE` | QR is not OUTER type | QR is not COMPOSED type |
| `NOT_CONFIGURED` | OUTER QR not configured | Package QR not configured |
| `ALREADY_AGGREGATED` | OUTER QR already in package | Package QR already on pallet |
| `DUPLICATE_IN_SESSION` | QR already processed in session | Package already processed |
| `TYPE_MISMATCH` | Product doesn't match channel | Product doesn't match channel |

### Error Response Format

```json
{
  "data": {
    "packageAggregationEvents": {
      "channelId": "68ff22416589fd0d4227d7c4",
      "messageId": "68ff4e29b01fa17e21044523",
      "eventType": "ERROR",
      "data": null,
      "error": "OUTER QR code 'xyz' has already been aggregated",
      "status": "ALREADY_AGGREGATED"
    }
  }
}
```

---

## 📊 Performance Considerations

### Optimization Strategies

1. **Parallel Processing**: Finalization processes multiple messages concurrently
2. **Event Filtering**: Subscriptions filter by channelId to reduce noise
3. **Database Indexing**: Indexes on QR codes, channel status, and relationships
4. **Connection Management**: PubSub connections closed after session completion

### Monitoring Metrics

- **Processing Time**: Tracked per phase and overall session
- **Validation Success Rate**: Percentage of successful validations
- **Event Publication Latency**: Real-time event delivery performance
- **Session Duration**: Time from start to finalization

---

## 🚀 Usage Examples

### Complete Package Aggregation Flow

```javascript
// 1. Start session
const session = await startAggregation({
  name: "Morning Batch",
  sessionMode: "PACKAGE_AGGREGATION",
  targetQrCode: "PACKAGE-123",
  productId: "PROD-456"
});

// 2. Subscribe to events
const subscription = packageAggregationEvents(session._id);

// 3. Process OUTER QRs
await processAggregationMessage({
  channelId: session._id,
  childQrCode: "OUTER-001",
  author: "operator"
});

// 4. Finalize
await finalizeChannel({ channelId: session._id });
```

### Complete Pallet Aggregation Flow

```javascript
// 1. Start pallet session
const palletSession = await startAggregation({
  name: "Pallet Formation",
  sessionMode: "PALLET_AGGREGATION", 
  targetQrCode: "PALLET-789",
  productId: "PROD-456"
});

// 2. Process Package QRs
await processAggregationMessage({
  channelId: palletSession._id,
  childQrCode: "PACKAGE-123", // Previously configured package
  author: "operator"
});

// 3. Finalize pallet
await finalizeChannel({ channelId: palletSession._id });
```

### Complete Full Aggregation Flow

```javascript
// 1. Start full aggregation session
const fullSession = await startAggregation({
  name: "Complete Production Line",
  sessionMode: "FULL_AGGREGATION",
  targetQrCode: "PALLET-999",
  productId: "PROD-456",
  packagesPerPallet: 3,
  outersPerPackage: 4
});

// 2. Subscribe to events with enhanced progress tracking
const subscription = packageAggregationEvents(fullSession._id);

// 3. Sequential processing: Package → OUTERs → Package → OUTERs...
// Package 1
await processAggregationMessage({
  channelId: fullSession._id,
  childQrCode: "PACKAGE-001",
  author: "operator",
  eventType: "FULL_AGGREGATION_PACKAGE"
});

// OUTERs for Package 1
for (let i = 1; i <= 4; i++) {
  await processAggregationMessage({
    channelId: fullSession._id,
    childQrCode: `OUTER-001-${i}`,
    author: "operator",
    eventType: "FULL_AGGREGATION_OUTER"
  });
}
// → Triggers PACKAGE_COMPLETION event

// Package 2
await processAggregationMessage({
  channelId: fullSession._id,
  childQrCode: "PACKAGE-002",
  author: "operator",
  eventType: "FULL_AGGREGATION_PACKAGE"
});

// OUTERs for Package 2
for (let i = 1; i <= 4; i++) {
  await processAggregationMessage({
    channelId: fullSession._id,
    childQrCode: `OUTER-002-${i}`,
    author: "operator",
    eventType: "FULL_AGGREGATION_OUTER"
  });
}
// → Triggers PACKAGE_COMPLETION event

// Package 3
await processAggregationMessage({
  channelId: fullSession._id,
  childQrCode: "PACKAGE-003",
  author: "operator",
  eventType: "FULL_AGGREGATION_PACKAGE"
});

// OUTERs for Package 3  
for (let i = 1; i <= 4; i++) {
  await processAggregationMessage({
    channelId: fullSession._id,
    childQrCode: `OUTER-003-${i}`,
    author: "operator",
    eventType: "FULL_AGGREGATION_OUTER"
  });
}
// → Triggers PACKAGE_COMPLETION event

// 4. Finalize complete session
await finalizeChannel({ channelId: fullSession._id });
// → Triggers PALLET_COMPLETION and SESSION_CLOSED events

/* Result Hierarchy:
PALLET-999
├── PACKAGE-001
│   ├── OUTER-001-1
│   ├── OUTER-001-2  
│   ├── OUTER-001-3
│   └── OUTER-001-4
├── PACKAGE-002
│   ├── OUTER-002-1
│   ├── OUTER-002-2
│   ├── OUTER-002-3
│   └── OUTER-002-4
└── PACKAGE-003
    ├── OUTER-003-1
    ├── OUTER-003-2
    ├── OUTER-003-3
    └── OUTER-003-4
*/
```

---

## 🏁 Summary

This system provides a robust, real-time aggregation workflow supporting three hierarchical aggregation modes:

1. **OUTER QRs → Package QRs** (Package Aggregation)
2. **Package QRs → Pallet QRs** (Pallet Aggregation)  
3. **OUTER QRs → Package QRs → Pallet QRs** (Full Aggregation - Complete Pipeline)

Key features include:
- ✅ Real-time validation and processing
- ✅ Three aggregation modes for different operational needs
- ✅ Sequential processing with state management (FULL_AGGREGATION)
- ✅ Comprehensive error handling with specific error codes
- ✅ Hierarchical relationship management with cascading updates
- ✅ Event-driven architecture with detailed progress subscriptions
- ✅ Parallel processing for performance optimization
- ✅ Complete audit trail and logging
- ✅ Configurable limits and validation rules
- ✅ Support for complex production line workflows

The **FULL_AGGREGATION** mode specifically enables complete production line scenarios where operators can process entire pallets by scanning packages and their constituent outers in a structured, guided workflow with real-time progress tracking and validation.

The system ensures data integrity through comprehensive validation while providing real-time feedback for operational efficiency across all aggregation modes.