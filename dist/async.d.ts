import type { addToJSONProps, ReadJSONProps, ReadJSONResult, SaveJSONProps } from './common.js';
export declare const saveJSONAsync: (saveInput: SaveJSONProps) => Promise<void>;
export declare const readJSONAsync: <T = any>(props: ReadJSONProps) => Promise<ReadJSONResult<T>>;
export declare const addToJSONAsync: (saveInput: addToJSONProps) => Promise<void>;
