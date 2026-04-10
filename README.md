# Boma JSON helper
 Super-simple helper for working with JSON

 Work only in synchronous mode for now.

# Usage

```JS
const logs = readJSON({ filePath: '/support.log', createIfNotFound: {}, parseJSON: true });
/*
logs = {
  any: {}, //
  key: {}
}
*/

saveJSON({ filePath: '/test.json', objToSave: { any: {}, key: {} }, format: true, logSaving: false }); // Format for save line break's
/* Will save:
{
  "any": {}, // saved line break's
  "key": {}
}
*/

addToJSON({ filePath: '/support.log', dataToAdd: { 6sdf89g7dghg: { any: "data" }}, format: false, logSaving: false });
/* Will save:
"{ "any": {}, "key": {}, "6sdf89g7dghg": { "any": "data" } }"
*/
```

## Types
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
}

export interface addToJSONProps {
  filePath: string;
  dataToAdd: SerializableObject | SerializableArray;
  format?: boolean
  logSaving?: boolean;
}
```
