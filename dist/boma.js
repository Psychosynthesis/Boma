import { readFileSync, writeFileSync } from 'fs';
import { addToJSONAsync, readJSONAsync, saveJSONAsync } from './async.js';
import { getDate, getIssueMessage, getSerializationIssues, isErrorWithCode, isPlainMergeableObject, isSyntaxError, logSerializationIssues, sanitizeNonSerializable } from './common.js';
export * from './common.js';
const saveJSONSync = (saveInput) => {
    const { filePath, objToSave, format = false, logSaving = false, replaceNonSerializable = false, silent = true } = saveInput;
    const issues = getSerializationIssues(objToSave);
    if (issues.length > 0) {
        !silent && logSerializationIssues(issues);
        if (!replaceNonSerializable) {
            const firstIssue = issues[0];
            const errorMessage = `[${getDate()}] Boma got non JSON-serializable object at saveJSON! ${getIssueMessage(firstIssue)}`;
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
    const { filePath, createIfNotFound = false, parseJSON = true, silent = true, throwError = false, } = props;
    try {
        const savedfile = readFileSync(filePath, 'utf8');
        if (parseJSON) {
            return savedfile.trim() === '' ? null : JSON.parse(savedfile);
        }
        return savedfile;
    }
    catch (err) {
        if (throwError)
            throw err;
        if (isErrorWithCode(err)) {
            switch (err.code) {
                case 'ENOENT':
                    if (createIfNotFound) {
                        !silent && console.log('Try to create: ', filePath);
                        const initialValue = typeof createIfNotFound === 'boolean' ? {} : createIfNotFound;
                        const initialContent = JSON.stringify(initialValue);
                        try {
                            writeFileSync(filePath, initialContent, { encoding: 'utf8', flag: 'wx' });
                        }
                        catch (writeErr) {
                            if (isErrorWithCode(writeErr) && writeErr.code === 'EEXIST') {
                                return readJSONSync({ ...props, createIfNotFound: false });
                            }
                            if (throwError)
                                throw writeErr;
                            console.error(`[${getDate()}] Boma got error while creating file ${filePath}: `, writeErr, '\n');
                        }
                        return (parseJSON ? initialValue : initialContent);
                    }
                    !silent && console.info("Boma can't find file: ", filePath);
                    return parseJSON ? {} : null;
                case 'EACCES':
                    !silent && console.error(`Access denied for ${filePath}`);
                    return null;
                default:
                    !silent && console.error(`Some filesystem error when try readJSON: ${filePath}`, err);
                    return null;
            }
        }
        if (isSyntaxError(err)) {
            !silent && console.error('File ', filePath, ' has incorrect JSON syntax', '\n');
            return null;
        }
        !silent && console.error('Function readJSON error:', err, '\n');
        return null;
    }
};
const addToJSONSync = (saveInput) => {
    const { filePath, dataToAdd, format = false, logSaving = false, replaceNonSerializable = false, silent = true, throwError = false, } = saveInput;
    const oldJSON = readJSONSync({ filePath, createIfNotFound: true, silent, throwError });
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
