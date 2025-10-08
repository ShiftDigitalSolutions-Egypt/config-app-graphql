# Configuration Module Testing Guide

This guide provides examples and instructions for testing the `configureOuterQr` GraphQL mutation in the Configuration module.

## 🚀 Getting Started

### Prerequisites
- Application running on `http://localhost:4000`
- GraphQL Playground accessible at `http://localhost:4000/graphql`
- MongoDB connection established
- Sample data in the database (QrCode and Product collections)

## 📊 GraphQL API Overview

### Available Operations

#### 1. `configureOuterQr` Mutation
Configures an OUTER QR code with product data and hierarchical relationships.

#### 2. `getConfiguredQr` Query
Retrieves a configured QR code with populated relationships.

## 🧪 Testing Examples

### Example 1: Basic OUTER QR Configuration

```graphql
mutation ConfigureBasicOuterQr {
  configureOuterQr(input: {
    productId: "507f1f77bcf86cd799439011"
    qrCodeList: ["OUTER-QR-001"]
    hasAgg: true
    numberOfAgg: 10
    operationBatch: "BATCH-2025-001"
    workerName: "John Doe"
    productionsDate: 1696550400000
    orderNum: "ORDER-12345"
  }) {
    id
    value
    isConfigured
    hasAgg
    numberOfAgg
    operationBatch
    workerName
    directParent
    parents
    productData {
      productId
      counter
      outers
      pallets
      packages
    }
  }
}
```

### Example 2: OUTER QR with Parent Package

```graphql
mutation ConfigureOuterQrWithParent {
  configureOuterQr(input: {
    productId: "507f1f77bcf86cd799439011"
    qrCodeList: ["OUTER-QR-002", "PACKAGE-QR-001"]
    hasAgg: true
    numberOfAgg: 5
    operationBatch: "BATCH-2025-002"
    workerName: "Jane Smith"
    productionsDate: 1696636800000
    orderNum: "ORDER-67890"
    aggQrCode: "AGG-QR-001"
  }) {
    id
    value
    isConfigured
    hasAgg
    numberOfAgg
    operationBatch
    workerName
    directParent
    parents
    productData {
      productId
      counter
      outers
      pallets
      packages
    }
  }
}
```

### Example 3: Query Configured QR

```graphql
query GetConfiguredQr {
  getConfiguredQr(qrValueOrId: "OUTER-QR-001") {
    id
    value
    isConfigured
    hasAgg
    numberOfAgg
    operationBatch
    workerName
    productionsDate
    orderNum
    directParent
    parents
    productData {
      productId
      counter
      outers
      pallets
      packages
    }
  }
}
```

## 🎯 Test Scenarios

### Scenario 1: Successful Configuration
**Expected Outcome**: QR code gets configured with all provided data

**Setup Requirements**:
1. Ensure QR code `OUTER-QR-001` exists in database
2. Ensure QR code type is `OUTER`
3. Ensure QR code is not already configured (`isConfigured: false`)
4. Ensure product with ID `507f1f77bcf86cd799439011` exists

### Scenario 2: Validation Errors

#### Test Case 2.1: Non-existent QR Code
```graphql
mutation TestNonExistentQR {
  configureOuterQr(input: {
    productId: "507f1f77bcf86cd799439011"
    qrCodeList: ["NON-EXISTENT-QR"]
    hasAgg: true
  }) {
    id
    value
  }
}
```
**Expected**: Error message about QR code not found

#### Test Case 2.2: Wrong QR Type
```graphql
mutation TestWrongQRType {
  configureOuterQr(input: {
    productId: "507f1f77bcf86cd799439011"
    qrCodeList: ["INNER-QR-001"]  # This should be INNER type, not OUTER
    hasAgg: true
  }) {
    id
    value
  }
}
```
**Expected**: Error message about incorrect QR type

#### Test Case 2.3: Already Configured QR
```graphql
mutation TestAlreadyConfigured {
  configureOuterQr(input: {
    productId: "507f1f77bcf86cd799439011"
    qrCodeList: ["ALREADY-CONFIGURED-OUTER-QR"]
    hasAgg: true
  }) {
    id
    value
  }
}
```
**Expected**: Error message about QR already being configured

#### Test Case 2.4: Non-existent Product
```graphql
mutation TestNonExistentProduct {
  configureOuterQr(input: {
    productId: "507f1f77bcf86cd799439999"  # Non-existent product ID
    qrCodeList: ["OUTER-QR-003"]
    hasAgg: true
  }) {
    id
    value
  }
}
```
**Expected**: Error message about product not found

## 📋 Sample Data Setup

### Create Sample QR Codes

```javascript
// MongoDB commands to create sample data
db.qrcodes.insertMany([
  {
    value: "OUTER-QR-001",
    type: "OUTER",
    isConfigured: false,
    hasAgg: false,
    referenceNumber: "REF-001"
  },
  {
    value: "OUTER-QR-002", 
    type: "OUTER",
    isConfigured: false,
    hasAgg: false,
    referenceNumber: "REF-002"
  },
  {
    value: "PACKAGE-QR-001",
    type: "QUANTIFIED", 
    isConfigured: true,
    hasAgg: true,
    referenceNumber: "REF-003",
    productData: [{
      productId: ObjectId("507f1f77bcf86cd799439011"),
      counter: 50
    }]
  },
  {
    value: "INNER-QR-001",
    type: "INNER",
    isConfigured: false,
    hasAgg: false,
    referenceNumber: "REF-004"
  }
])
```

### Create Sample Product

```javascript
// MongoDB command to create sample product
db.products.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439011"),
  name: "Sample Product",
  description: "Test product for QR configuration",
  sku: "SKU-001",
  category: "Electronics"
})
```

## 🔍 Debugging Tips

### 1. Check Application Logs
Monitor the console output for detailed log messages:
```
[ConfigurationService] Successfully configured OUTER QR: OUTER-QR-001
[ConfigurationService] Failed to configure OUTER QR: Product with ID 'xxx' not found
```

### 2. Validate Database State
Before testing, ensure:
- QR codes exist with correct `type` field
- QR codes have `isConfigured: false` 
- Products exist with the specified IDs
- Parent packages (if used) are properly configured

### 3. GraphQL Playground Features
- Use the **Schema** tab to explore available fields
- Use **Query Variables** for dynamic testing
- Check the **Network** tab for detailed error responses

## 📚 Field Descriptions

### Input Fields (`CreateQrConfigrationDto`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | String | ✅ | MongoDB ObjectId of the product |
| `qrCodeList` | [String] | ❌ | Array of QR code values (first one is the target) |
| `hasAgg` | Boolean | ❌ | Whether the QR has aggregation |
| `numberOfAgg` | Number | ❌ | Number of aggregated items |
| `operationBatch` | String | ❌ | Operation batch identifier |
| `workerName` | String | ❌ | Name of the worker performing configuration |
| `productionsDate` | Number | ❌ | Production date as Unix timestamp |
| `orderNum` | String | ❌ | Order number reference |
| `aggQrCode` | String | ❌ | Aggregation QR code reference |

### Output Fields (`QrCode`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier |
| `value` | String | QR code value |
| `isConfigured` | Boolean | Configuration status |
| `hasAgg` | Boolean | Aggregation status |
| `numberOfAgg` | Number | Number of aggregated items |
| `directParent` | String | Direct parent QR code |
| `parents` | [String] | Array of all parent QR codes |
| `productData` | [ProductData] | Associated product information |

## 🚀 Quick Start Commands

1. **Start Application**:
   ```bash
   node dist/main.js
   ```

2. **Open GraphQL Playground**:
   ```
   http://localhost:4000/graphql
   ```

3. **Test Basic Configuration**:
   Copy and paste Example 1 into the playground and execute

4. **Verify Configuration**:
   Use Example 3 to query the configured QR code

## ⚠️ Common Issues

1. **PowerShell Execution Policy**: Use `node` commands directly instead of `npm`
2. **GraphQL Schema Errors**: Ensure all entities have proper `@Field` decorators
3. **MongoDB Connection**: Verify `.env` file has correct `MONGODB_URI`
4. **TypeScript Compilation**: Run `node node_modules\typescript\bin\tsc` to rebuild

## 📞 Support

For issues or questions:
1. Check application logs for detailed error messages
2. Verify database connection and sample data
3. Use GraphQL Playground schema explorer
4. Review validation error messages in responses