# Boma JSON helper
 Super-simple helper for working with JSON

 Work only in synchronous mode for now.

# Usage

```JS
const logs = readJSON({
  filePath: '/support.log',
  createIfNotFound: {},
  parseJSON: true,
  silent: true, // Do not log warnings (only file not found will be logged)
});
/*
logs = {
  any: {}, //
  key: {}
}
*/

saveJSON({
  filePath: '/test.json',
  objToSave: { any: {}, key: {} },
  format: true,
  logSaving: false,
  silent: true, // Do not log warnings
}); // Format for save line break's
/* Will save:
{
  "any": {}, // saved line break's
  "key": {}
}
*/

addToJSON({
  filePath: '/support.log',
  dataToAdd: { 6sdf89g7dghg: { any: "data", someFunc: () => {} }},
  format: false,
  logSaving: false,
  replaceNonSerializable: true
});
/* Will save:
"{ "6sdf89g7dghg": { "any": "data", "someFunc": "function" } }"
*/
```

## Types
Main types:

```typescript
export type SerializablePrimitive = string | number | boolean | null;
export type SerializableArray = Serializable[];
export type SerializableObject = { [key: string]: Serializable };
export type Serializable = SerializablePrimitive | SerializableArray | SerializableObject;

export interface ReadJSONProps {
  filePath: string;
  parseJSON?: boolean;
  createIfNotFound?: boolean | SerializableObject | SerializableArray; // Файл с чем создать, если не создан
}

export interface SaveJSONProps {
  filePath: string;
  objToSave: Serializable;
  format?: boolean
  logSaving?: boolean;
  replaceNonSerializable?: boolean; // Заменять несереализуемые значения их типом
  silent?: boolean; // Не выводим предупреждения
}

export interface addToJSONProps {
  filePath: string;
  dataToAdd: SerializableObject | SerializableArray;
  format?: boolean
  logSaving?: boolean;
  silent?: boolean; // Не выводим предупреждения
}

// We also export some helpers:
export const isSerializable = (value: unknown) => boolean;
export const isObjectLike = (value: unknown) => boolean;
export const isPlainMergeableObject = (value: unknown) => boolean;

export const isErrorWithCode = (error: unknown) => boolean;
export const isErrorWithMessage = (error: unknown) => boolean;
export const isSyntaxError = (error: unknown) => boolean;
```
