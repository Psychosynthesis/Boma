import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { getDate, getIssueMessage, getSerializationIssues, isErrorWithCode, isPlainMergeableObject, isSyntaxError, logSerializationIssues, sanitizeNonSerializable, } from './common.js';
const addToJSONQueues = new Map();
const runAddToJSONExclusive = async (filePath, operation) => {
    const key = resolve(filePath);
    const previous = addToJSONQueues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    const settled = current.then(() => undefined, () => undefined);
    addToJSONQueues.set(key, settled);
    try {
        return await current;
    }
    finally {
        if (addToJSONQueues.get(key) === settled) {
            addToJSONQueues.delete(key);
        }
    }
};
export const saveJSONAsync = async (saveInput) => {
    const { filePath, objToSave, format = false, logSaving = false, replaceNonSerializable = false, silent = true, } = saveInput;
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
        await writeFile(filePath, json, 'utf8');
        !silent && logSaving && console.log(`[${getDate()}] Write file ${filePath} successfully`);
    }
    catch (error) {
        if (isErrorWithCode(error)) {
            console.error(`[${getDate()}] Boma got filesystem error for ${filePath}:`, error);
        }
        throw error;
    }
};
export const readJSONAsync = async (props) => {
    const { filePath, createIfNotFound = false, parseJSON = true, silent = true, throwError = false, } = props;
    try {
        const savedfile = await readFile(filePath, 'utf8');
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
                            await writeFile(filePath, initialContent, { encoding: 'utf8', flag: 'wx' });
                        }
                        catch (writeErr) {
                            if (isErrorWithCode(writeErr) && writeErr.code === 'EEXIST') {
                                return readJSONAsync({ ...props, createIfNotFound: false });
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
                    !silent && console.error(`[${getDate()}] Access denied error for ${filePath}`);
                    return null;
                default:
                    !silent && console.error(`[${getDate()}] Boma get some filesystem error when try readJSON: ${filePath}`, err);
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
export const addToJSONAsync = (saveInput) => runAddToJSONExclusive(saveInput.filePath, async () => {
    const { filePath, dataToAdd, format = false, logSaving = false, replaceNonSerializable = false, silent = true, throwError = false, } = saveInput;
    const oldJSON = await readJSONAsync({
        filePath,
        createIfNotFound: true,
        silent,
        throwError,
    });
    if (oldJSON === null || typeof oldJSON !== 'object') {
        return saveJSONAsync({
            filePath,
            objToSave: dataToAdd,
            format,
            logSaving,
            replaceNonSerializable,
            silent,
        });
    }
    if (Array.isArray(oldJSON) && Array.isArray(dataToAdd)) {
        await saveJSONAsync({
            filePath,
            objToSave: [...oldJSON, ...dataToAdd],
            format,
            logSaving,
            replaceNonSerializable,
            silent,
        });
        return;
    }
    if (isPlainMergeableObject(oldJSON) && isPlainMergeableObject(dataToAdd)) {
        await saveJSONAsync({
            filePath,
            objToSave: { ...oldJSON, ...dataToAdd },
            format,
            logSaving,
            replaceNonSerializable,
            silent,
        });
        return;
    }
    if (Array.isArray(dataToAdd)
        && isPlainMergeableObject(oldJSON)
        && Object.keys(oldJSON).length === 0) {
        await saveJSONAsync({
            filePath,
            objToSave: [...dataToAdd],
            format,
            logSaving,
            replaceNonSerializable,
            silent,
        });
        return;
    }
    throw new Error('Cannot merge array with object');
});
