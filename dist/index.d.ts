export type SerializablePrimitive = string | number | boolean | null;
export type SerializableArray = Serializable[];
export type SerializableObject = {
    [key: string]: Serializable;
};
export type Serializable = SerializablePrimitive | SerializableArray | SerializableObject;
export interface ReadJSONProps {
    filePath: string;
    parseJSON?: boolean;
    createIfNotFound?: boolean | SerializableObject | SerializableArray;
}
export interface SaveJSONProps {
    filePath: string;
    objToSave: Serializable;
    format?: boolean;
    logSaving?: boolean;
}
export interface addToJSONProps {
    filePath: string;
    dataToAdd: SerializableObject | SerializableArray;
    format?: boolean;
    logSaving?: boolean;
}
export type ErrorWithCode = Error & {
    code: string;
};
export type ErrorWithMessage = Error & {
    message: any;
};
export declare const isErrorWithCode: (error: unknown) => error is ErrorWithCode;
export declare const isErrorWithMessage: (error: unknown) => error is ErrorWithMessage;
export declare const isSyntaxError: (error: unknown) => error is SyntaxError;
export declare const isSerializable: (value: unknown, seen?: WeakSet<object>) => value is Serializable;
export declare const saveJSON: (saveInput: SaveJSONProps) => void;
export declare const readJSON: (props: ReadJSONProps) => any;
export declare const addToJSON: (saveInput: addToJSONProps) => void;
