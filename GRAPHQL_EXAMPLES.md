# GraphQL Examples for Config App

## Sample Variables for Mutations

### Create Session
```json
{
  "input": {
    "name": "My First Session"
  }
}
```

### Update Session
```json
{
  "id": "YOUR_SESSION_ID_HERE",
  "input": {
    "name": "Updated Session Name"
  }
}
```

### Get Session by ID
```json
{
  "id": "YOUR_SESSION_ID_HERE"
}
```

### Delete Session
```json
{
  "id": "YOUR_SESSION_ID_HERE"
}
```

## Complete Example Workflow

1. **Create a session:**
   ```graphql
   mutation CreateSession($input: CreateSessionInput!) {
     createSession(createSessionInput: $input) {
       _id
       name
       createdAt
       updatedAt
     }
   }
   ```
   Variables:
   ```json
   {
     "input": {
       "name": "Test Session"
     }
   }
   ```

2. **Subscribe to real-time updates** (in a new tab):
   ```graphql
   subscription OnSessionCreated {
     sessionCreated {
       _id
       name
       createdAt
       updatedAt
     }
   }
   ```

3. **Query all sessions:**
   ```graphql
   query GetAllSessions {
     sessions {
       _id
       name
       createdAt
       updatedAt
     }
   }
   ```

4. **Update a session:**
   ```graphql
   mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
     updateSession(id: $id, updateSessionInput: $input) {
       _id
       name
       createdAt
       updatedAt
     }
   }
   ```

5. **Delete a session:**
   ```graphql
   mutation DeleteSession($id: ID!) {
     deleteSession(id: $id) {
       _id
       name
       createdAt
       updatedAt
     }
   }
   ```