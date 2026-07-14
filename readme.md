# Boma JSON helper

[![npm version](https://img.shields.io/npm/v/boma?color=%20027dec)](https://www.npmjs.org/package/boma)

Super-simple helper for reading, saving and updating JSON files. Zero runtime dependencies.

Works in synchronous mode by default. Pass `async: true` to use the asynchronous implementation.
Old synchronous calls remain unchanged.

## Basic features
- Using the `createIfNotFound` parameter in `readJSON` and `addToJSONS`, you can immediately create a missing file with the specified (default) object or array without any additional steps. This is convenient, for example, for writing configuration files.
- `addToJSON` — reads a file and shallow merges objects or concatenates arrays.
- Flag `replaceNonSerializable` — replaces `function`, `undefined`, `bigint`, `loops`, `NaN`, and `Infinity` with understandable markers.
- Flag `getSerializationIssues` — shows all problematic fields with paths like `[OBJECT].user.callback`.
- Single interface with `async: true`, instead of separate `readFile` / `readFileSync`.
- You can get raw text using flag `parseJSON`: false.
- By default, boma hides many errors when reading a file and returns `null` or `{}` — this is very convenient in a production environment. If necessary, you can set the `throwError: true` in `readJSON` and `addToJSONS` to catch and handle all errors yourself. However, write errors are much more critical, so `boma` always throws them.
- Concurrent `addToJSON` calls within the same process are serialized per file, preventing lost updates from overlapping read–merge–write cycles. **Important! This does not provide cross-process or cross-thread locking, so multiple workers or external writers may still cause race conditions.**

## Install
```bash
npm install boma
```

## Import
```typescript
import { readJSON, saveJSON, addToJSON } from 'boma';
```

## Synchronous usage
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
  format: false, // Add line-breaks for result file
  logSaving: false,
  replaceNonSerializable: true, // Replace non-serializable values ​​with descriptive strings (e.g. function for a function)
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

## Asynchronous usage
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

## Reading JSON
Minimal example:

```typescript
const result = readJSON({ filePath: '/test.json' });
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
const rawContent = readJSON({ filePath: '/test.json', parseJSON: false });
// rawContent will be a string here
```

When `createIfNotFound` is `true`, a missing file is created with an empty object:

```typescript
const result = readJSON({ filePath: '/test.json', createIfNotFound: true });
// test.json will contain a `{}` string if not existing before
```

You can also provide the initial object or array:

```typescript
const result = readJSON({ filePath: '/test.json', createIfNotFound: { default: 'info' } });
```

## Saving JSON
Minimal example:

```typescript
saveJSON({ filePath: '/test.json', objToSave: { any: 'data' } });
```

Use `format: true` to save formatted JSON with indentation and line breaks:

```typescript
saveJSON({ filePath: '/test.json', objToSave: { any: 'data' }, format: true });
```

Use `logSaving: true` to log successful file saving when `silent` is `false`.

## Non-serializable values
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
The `format` flag is setted, so there will be a line breaks.

Circular references are replaced with `"circular"`.

## Adding data to JSON
`addToJSON` reads the existing file, merges the new data and saves the result.

Objects are shallow merged:

```typescript
// Existing test.json: { "first": 1, "second": 2 }
addToJSON({ filePath: '/test.json', dataToAdd: { second: 20, third: 3 } });
```

Result (the `format` flag is disabled by default, so there will be no line breaks):

```json
{ "first": 1, "second": 20, "third": 3 }
```

Existing object keys are overwritten by values from `dataToAdd`.

Arrays are concatenated:

```typescript
// Existing file:
[1, 2]
```

```typescript
addToJSON({ filePath: '/test.json', dataToAdd: [3, 4] });
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

## Typed reading
A result type can be passed to `readJSON`:

```typescript
interface Config { port: number; production: boolean; }

const config = readJSON<Config>({ filePath: '/config.json' });
```

Async mode uses the same generic:

```typescript
const config = await readJSON<Config>({ filePath: '/config.json', async: true });
```

Because `parseJSON: false` returns a string and reading errors can return `null`, the complete result type also includes `string | null`.

## Types
Main types:

```typescript
export type SerializablePrimitive = string | number | boolean | null;
export type SerializableArray = Serializable[];
export type SerializableObject = { [key: string]: Serializable; };

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
export type ReadJSONSyncProps = ReadJSONProps & { async?: false };

export type ReadJSONAsyncProps = ReadJSONProps & { async: true };

export type SaveJSONSyncProps = SaveJSONProps & { async?: false };

export type SaveJSONAsyncProps = SaveJSONProps & { async: true };

export type AddToJSONSyncProps = addToJSONProps & { async?: false };

export type AddToJSONAsyncProps = addToJSONProps & { async: true };

export type ReadJSONResult<T = any> = T | string | null;
```

## Helpers

The package also exports few serialization and type-checking helpers:

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

You also can use simple checker: `isSerializable(value: unknown)` (return `boolean`).
