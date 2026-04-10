export type SerializablePrimitive = string | number | boolean | null;
export type SerializableArray = Serializable[];
export type SerializableObject = {
    [key: string]: Serializable;
};
export type Serializable = SerializablePrimitive | SerializableArray | SerializableObject;
type JSONLikeObject = Record<string, unknown>;
type JSONLikeArray = unknown[];
export interface ReadJSONProps {
    filePath: string;
    parseJSON?: boolean;
    createIfNotFound?: boolean | SerializableObject | SerializableArray;
    silent?: boolean;
}
export interface SaveJSONProps {
    filePath: string;
    objToSave: unknown;
    format?: boolean;
    logSaving?: boolean;
    replaceNonSerializable?: boolean;
    silent?: boolean;
}
export interface addToJSONProps {
    filePath: string;
    dataToAdd: JSONLikeObject | JSONLikeArray;
    format?: boolean;
    logSaving?: boolean;
    replaceNonSerializable?: boolean;
    silent?: boolean;
}
export type ErrorWithCode = Error & {
    code: string;
};
export type ErrorWithMessage = Error & {
    message: any;
};
export type SerializationIssueKind = 'undefined' | 'function' | 'symbol' | 'bigint' | 'non-finite-number' | 'circular';
export interface SerializationIssue {
    path: string;
    kind: SerializationIssueKind;
    message: string;
    circularTo?: string;
}
export declare const isErrorWithCode: (error: unknown) => error is ErrorWithCode;
export declare const isErrorWithMessage: (error: unknown) => error is ErrorWithMessage;
export declare const isSyntaxError: (error: unknown) => error is SyntaxError;
export declare const isObjectLike: (value: unknown) => value is object;
export declare const isPlainMergeableObject: (value: unknown) => value is Record<string, unknown>;
export declare const getSerializationIssues: (value: unknown, path?: string, ancestors?: WeakMap<object, string>, issues?: SerializationIssue[]) => SerializationIssue[];
export declare const isSerializable: (value: unknown) => value is Serializable;
export declare const sanitizeNonSerializable: (value: unknown, path?: string, ancestors?: WeakMap<object, string>) => Serializable;
export declare const saveJSON: (saveInput: SaveJSONProps) => void;
export declare const readJSON: (props: ReadJSONProps) => any;
export declare const addToJSON: (saveInput: addToJSONProps) => void;
export {};
