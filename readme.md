# Boma JSON helper

Super-simple helper for reading, saving and updating JSON files.

Works in synchronous mode by default.
Pass `async: true` to use the asynchronous implementation.

Old synchronous calls remain unchanged.

# Install

```bash
npm install boma
```

# Import

```typescript
import { readJSON, saveJSON, addToJSON } from 'boma';
```

# Synchronous usage

Without the `async` option, all functions work synchronously.

```typescript
const logs = readJSON({
  filePath: '/support.json',
  createIfNotFound: {},
  parseJSON: true,
  silent: true, // Do not log warnings
});

/*
logs = {
  any: {},
  key: {}
}
*/
```

```typescript
saveJSON({
  filePath: '/test.json',
  objToSave: {
    any: {},
    key: {},
  },
  format: true,
  logSaving: false,
  silent: true,
});

/*
Will save:

{
  "any": {},
  "key": {}
}
*/
```

```typescript
addToJSON({
  filePath: '/support.json',
  dataToAdd: {
    '6sdf89g7dghg': {
      any: 'data',
      someFunc: () => {},
    },
  },
  format: false,
  logSaving: false,
  replaceNonSerializable: true,
});

/*
Will save:

{
  "6sdf89g7dghg": {
    "any": "data",
    "someFunc": "function"
  }
}
*/
```

# Asynchronous usage

Pass `async: true` to any main function.

In this mode:

* `readJSON` returns a `Promise` with the read value;
* `saveJSON` returns `Promise<void>`;
* `addToJSON` returns `Promise<void>`.

```typescript
const logs = await readJSON({
  filePath: '/support.json',
  createIfNotFound: {},
  parseJSON: true,
  silent: true,
  async: true,
});
```

```typescript
await saveJSON({
  filePath: '/test.json',
  objToSave: {
    any: {},
    key: {},
  },
  format: true,
  logSaving: false,
  silent: true,
  async: true,
});
```

```typescript
await addToJSON({
  filePath: '/support.json',
  dataToAdd: {
    newKey: {
      any: 'data',
    },
  },
  format: true,
  silent: true,
  async: true,
});
```

The same functions are used in both modes. Separate async imports are not required.

# Reading JSON

```typescript
const result = readJSON({
  filePath: '/test.json',
});
```

Default options:

```typescript
{
  parseJSON: true,
  createIfNotFound: false,
  silent: true,
  async: false
}
```

When `parseJSON` is `true`, file content is parsed using `JSON.parse`.

When `parseJSON` is `false`, raw file content is returned as a string.

```typescript
const rawContent = readJSON({
  filePath: '/test.json',
  parseJSON: false,
});
```

When `createIfNotFound` is `true`, a missing file is created with an empty object:

```typescript
const result = readJSON({
  filePath: '/test.json',
  createIfNotFound: true,
});
```

You can also provide the initial object or array:

```typescript
const result = readJSON({
  filePath: '/test.json',
  createIfNotFound: {
    created: true,
  },
});
```

# Saving JSON

```typescript
saveJSON({
  filePath: '/test.json',
  objToSave: {
    any: 'data',
  },
});
```

Use `format: true` to save formatted JSON with indentation and line breaks:

```typescript
saveJSON({
  filePath: '/test.json',
  objToSave: {
    any: 'data',
  },
  format: true,
});
```

Use `logSaving: true` to log successful file saving when `silent` is `false`.

# Non-serializable values

JSON does not support values such as:

* `undefined`;
* functions;
* symbols;
* `bigint`;
* `NaN` and `Infinity`;
* circular references.

Use `replaceNonSerializable: true` to replace such values with string type flags:

```typescript
saveJSON({
  filePath: '/test.json',
  objToSave: {
    callback: () => {},
    missing: undefined,
    largeNumber: BigInt(10),
    invalidNumber: NaN,
  },
  replaceNonSerializable: true,
  format: true,
});
```

Will save:

```json
{
  "callback": "function",
  "missing": "undefined",
  "largeNumber": "bigint",
  "invalidNumber": "non-finite-number"
}
```

Circular references are replaced with `"circular"`.

# Adding data to JSON

`addToJSON` reads the existing file, merges the new data and saves the result.

Objects are shallow merged:

```typescript
// Existing file:
{
  "first": 1,
  "second": 2
}
```

```typescript
addToJSON({
  filePath: '/test.json',
  dataToAdd: {
    second: 20,
    third: 3,
  },
});
```

Result:

```json
{
  "first": 1,
  "second": 20,
  "third": 3
}
```

Existing object keys are overwritten by values from `dataToAdd`.

Arrays are concatenated:

```typescript
// Existing file:
[1, 2]
```

```typescript
addToJSON({
  filePath: '/test.json',
  dataToAdd: [3, 4],
});
```

Result:

```json
[1, 2, 3, 4]
```

An object cannot be merged with an array. In this case, `addToJSON` throws:

```text
Cannot merge array with object
```

A missing file is created automatically.

# Typed reading

A result type can be passed to `readJSON`:

```typescript
interface Config {
  port: number;
  production: boolean;
}

const config = readJSON<Config>({
  filePath: '/config.json',
});
```

Async mode uses the same generic:

```typescript
const config = await readJSON<Config>({
  filePath: '/config.json',
  async: true,
});
```

Because `parseJSON: false` returns a string and reading errors can return `null`, the complete result type also includes `string | null`.

# Types

Main types:

```typescript
export type SerializablePrimitive = string | number | boolean | null;
export type SerializableArray = Serializable[];
export type SerializableObject = {
  [key: string]: Serializable;
};

export type Serializable =
  | SerializablePrimitive
  | SerializableArray
  | SerializableObject;

export interface ReadJSONProps {
  filePath: string;
  parseJSON?: boolean;
  createIfNotFound?:
    | boolean
    | SerializableObject
    | SerializableArray;
  silent?: boolean;
  async?: boolean;
}

export interface SaveJSONProps {
  filePath: string;
  objToSave: unknown;
  format?: boolean;
  logSaving?: boolean;
  replaceNonSerializable?: boolean;
  silent?: boolean;
  async?: boolean;
}

export interface addToJSONProps {
  filePath: string;
  dataToAdd:
    | Record<string, unknown>
    | unknown[];
  format?: boolean;
  logSaving?: boolean;
  replaceNonSerializable?: boolean;
  silent?: boolean;
  async?: boolean;
}
```

Types used for synchronous and asynchronous overloads are also exported:

```typescript
export type ReadJSONSyncProps =
  ReadJSONProps & { async?: false };

export type ReadJSONAsyncProps =
  ReadJSONProps & { async: true };

export type SaveJSONSyncProps =
  SaveJSONProps & { async?: false };

export type SaveJSONAsyncProps =
  SaveJSONProps & { async: true };

export type AddToJSONSyncProps =
  addToJSONProps & { async?: false };

export type AddToJSONAsyncProps =
  addToJSONProps & { async: true };

export type ReadJSONResult<T = any> =
  T | string | null;
```

# Helpers

The package also exports serialization and type-checking helpers:

```typescript
isSerializable(value);
sanitizeNonSerializable(value);
getSerializationIssues(value);

isObjectLike(value);
isPlainMergeableObject(value);

isErrorWithCode(error);
isErrorWithMessage(error);
isSyntaxError(error);
```

`getSerializationIssues` returns all detected serialization problems with their object paths:

```typescript
const issues = getSerializationIssues({
  user: {
    callback: () => {},
  },
});

/*
[
  {
    path: '[OBJECT].user.callback',
    kind: 'function',
    message:
      'Field "[OBJECT].user.callback" has non-serializable value of type "function"'
  }
]
*/
```
