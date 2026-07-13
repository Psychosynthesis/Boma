import { readFileSync, writeFileSync } from 'fs';
import { addToJSONAsync, readJSONAsync, saveJSONAsync } from './async.js';
import { getDate, getIssueMessage, getSerializationIssues, isErrorWithCode, isPlainMergeableObject, isSyntaxError, logSerializationIssues, sanitizeNonSerializable } from './common.js';
export * from './common.js';
const saveJSONSync = (saveInput) => {
    const { filePath, objToSave, format = false, logSaving = false, replaceNonSerializable = false, silent = true, } = saveInput;
    const issues = getSerializationIssues(objToSave);
    if (issues.length > 0) {
        !silent && logSerializationIssues(issues);
        if (!replaceNonSerializable && !silent) {
            const firstIssue = issues[0];
            const errorMessage = `[${getDate()}] Boma got non JSON-serializable object at saveJSON! ${getIssueMessage(firstIssue)}`;
            console.error(errorMessage);
            throw new Error(errorMessage);
        }
    }
    const valueToSave = replaceNonSerializable && issues.length > 0
        ? sanitizeNonSerializable(objToSave)
        : objToSave;
    try {
        const json = format ? JSON.stringify(valueToSave, null, 2) : JSON.stringify(valueToSave);
        writeFileSync(filePath, json, 'utf8');
        !silent && logSaving && console.log(`[${getDate()}] Write file ${filePath} successfully`);
    }
    catch (error) {
        if (isErrorWithCode(error)) {
            console.error(`[${getDate()}] Boma got filesystem error for ${filePath}:`, error);
        }
        throw error;
    }
};
const readJSONSync = (props) => {
    const { filePath, createIfNotFound = false, parseJSON = true, silent = true } = props;
    try {
        const savedfile = readFileSync(filePath, 'utf8');
        if (parseJSON) {
            return savedfile.trim() === '' ? null : JSON.parse(savedfile);
        }
        return savedfile;
    }
    catch (err) {
        if (isErrorWithCode(err)) {
            switch (err.code) {
                case 'ENOENT':
                    if (createIfNotFound) {
                        !silent && console.log('Try to create: ', filePath);
                        try {
                            const initialContent = typeof createIfNotFound === 'boolean' ? '{}' : JSON.stringify(createIfNotFound);
                            writeFileSync(filePath, initialContent, 'utf8');
                        }
                        catch (writeErr) {
                            console.error(`Error creating file ${filePath}: `, writeErr, '\n');
                        }
                        return (typeof createIfNotFound === 'boolean' ? {} : createIfNotFound);
                    }
                    console.info("Boma can't find file: ", filePath);
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
const addToJSONSync = (saveInput) => {
    const { filePath, dataToAdd, format = false, logSaving = false, replaceNonSerializable = false, silent = true, } = saveInput;
    const oldJSON = readJSONSync({ filePath, createIfNotFound: true, silent });
    if (oldJSON === null || typeof oldJSON !== 'object') {
        return saveJSONSync({ filePath, objToSave: dataToAdd, format, logSaving, replaceNonSerializable, silent });
    }
    if (Array.isArray(oldJSON) && Array.isArray(dataToAdd)) {
        saveJSONSync({
            filePath,
            objToSave: [...oldJSON, ...dataToAdd],
            format,
            logSaving,
            replaceNonSerializable,
            silent
        });
        return;
    }
    if (isPlainMergeableObject(oldJSON) && isPlainMergeableObject(dataToAdd)) {
        saveJSONSync({
            filePath,
            objToSave: { ...oldJSON, ...dataToAdd },
            format,
            logSaving,
            replaceNonSerializable,
            silent
        });
        return;
    }
    if (Array.isArray(dataToAdd) && isPlainMergeableObject(oldJSON) && Object.keys(oldJSON).length === 0) {
        saveJSONSync({
            filePath,
            objToSave: [...dataToAdd],
            format,
            logSaving,
            replaceNonSerializable,
            silent
        });
        return;
    }
    throw new Error('Cannot merge array with object');
};
export function saveJSON(props) {
    return props.async === true ? saveJSONAsync(props) : saveJSONSync(props);
}
export function readJSON(props) {
    return props.async === true ? readJSONAsync(props) : readJSONSync(props);
}
export function addToJSON(props) {
    return props.async === true ? addToJSONAsync(props) : addToJSONSync(props);
}
