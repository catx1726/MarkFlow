# Array Uniqueness Utility

Utility to filter an array and keep only unique items based on JSON serialization. 
This works for both primitives and complex objects.

## Usage

```typescript
import { getUniqueItems } from './index';

const data = [{ id: 1 }, { id: 2 }, { id: 1 }];
const unique = getUniqueItems(data);
// Output: [{ id: 1 }, { id: 2 }]
```

## Requirements
- Node.js 20+
- No external npm dependencies.
