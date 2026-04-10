import { readFileSync, writeFileSync } from 'fs';
export const isErrorWithCode = (error) => {
    return error instanceof Error && 'code' in error;
};
export const isErrorWithMessage = (error) => {
    return error instanceof Error && 'message' in error;
};
export const isSyntaxError = (error) => {
    return error instanceof SyntaxError;
};
const getDate = () => {
    const castedDate = new Date();
    return castedDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};
export const isSerializable = (value, seen = new WeakSet()) => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return true;
    }
    if (Array.isArray(value)) {
        for (const el of value) {
            if (!isSerializable(el, seen)) {
                return false;
            }
        }
        return true;
    }
    if (typeof value === "object") {
        if (seen.has(value)) {
            return false;
        }
        seen.add(value);
        const obj = value;
        for (const key in obj) {
            if (!isSerializable(obj[key], seen)) {
                return false;
            }
        }
        return true;
    }
    return false;
};
export const saveJSON = (saveInput) => {
    const { filePath, objToSave, format = false, logSaving = false } = saveInput;
    if (!isSerializable(objToSave)) {
        console.error(`[${getDate()}] Boma get non JSON-serializable object at saveJSON!`);
        throw new Error(`[${getDate()}] Boma get non JSON-serializable object at saveJSON!`);
    }
    try {
        const json = format ? JSON.stringify(objToSave, null, 2) : JSON.stringify(objToSave);
        writeFileSync(filePath, json, 'utf8');
        logSaving && console.log(`[${getDate()}] Write file ${filePath} successfully`);
    }
    catch (error) {
        if (isErrorWithCode(error)) {
            console.error(`[${getDate()}] Boma get filesystem error for ${filePath}:`, error);
        }
        throw error;
    }
};
export const readJSON = (props) => {
    const { filePath, createIfNotFound = false, parseJSON = true } = props;
    try {
        const savedfile = readFileSync(filePath, 'utf8');
        if (parseJSON) {
            return savedfile.trim() === "" ? null : JSON.parse(savedfile);
        }
        return savedfile;
    }
    catch (err) {
        if (isErrorWithCode(err)) {
            switch (err.code) {
                case 'ENOENT':
                    if (createIfNotFound) {
                        console.log('Try to create: ', filePath);
                        try {
                            const initialContent = typeof createIfNotFound === 'boolean' ? '{}' : JSON.stringify(createIfNotFound);
                            writeFileSync(filePath, initialContent, 'utf8');
                        }
                        catch (writeErr) {
                            console.error(`Error creating file ${filePath}: `, writeErr, '\n');
                        }
                        return typeof createIfNotFound === 'boolean' ? {} : createIfNotFound;
                    }
                    console.log('File not found: ', filePath);
                    return parseJSON ? {} : null;
                case 'EACCES':
                    console.error(`Access denied for ${filePath}`);
                    return null;
                default:
                    console.error(`Some filesystem error when try readJSON: ${filePath}`);
                    return null;
            }
        }
        if (isSyntaxError(err)) {
            console.error('File ', filePath, ' has incorrect JSON syntax', '\n');
            return null;
        }
        console.error('Function readJSON error:', err, '\n');
        return null;
    }
};
export const addToJSON = (saveInput) => {
    const { filePath, dataToAdd, format = false, logSaving = false } = saveInput;
    const oldJSON = readJSON({ filePath, createIfNotFound: true });
    if (oldJSON === null || typeof oldJSON !== 'object') {
        return saveJSON({ filePath, objToSave: dataToAdd, logSaving });
    }
    if (Array.isArray(oldJSON) && Array.isArray(dataToAdd)) {
        saveJSON({ filePath, objToSave: [...oldJSON, ...dataToAdd], format, logSaving });
    }
    else if (!Array.isArray(oldJSON) && !Array.isArray(dataToAdd)) {
        saveJSON({ filePath, objToSave: { ...oldJSON, ...dataToAdd }, format, logSaving });
    }
    else if (Array.isArray(dataToAdd) && Object.keys(oldJSON).length === 0) {
        saveJSON({ filePath, objToSave: [...dataToAdd], format, logSaving });
    }
    else {
        throw new Error('Cannot merge array with object');
    }
};
