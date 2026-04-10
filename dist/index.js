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
const isObjectLike = (value) => {
    return typeof value === 'object' && value !== null;
};
const isPlainMergeableObject = (value) => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};
const pathJoin = (basePath, key) => {
    if (typeof key === 'number') {
        return `${basePath}[${key}]`;
    }
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
        ? `${basePath}.${key}`
        : `${basePath}[${JSON.stringify(key)}]`;
};
const getIssueMessage = (issue) => {
    if (issue.kind === 'circular') {
        return `Field "${issue.path}" contains circular reference${issue.circularTo ? ` to "${issue.circularTo}"` : ''}`;
    }
    if (issue.kind === 'non-finite-number') {
        return `Field "${issue.path}" contains non-finite number (NaN / Infinity)`;
    }
    return `Field "${issue.path}" has non-serializable value of type "${issue.kind}"`;
};
export const getSerializationIssues = (value, path = '$', ancestors = new WeakMap(), issues = []) => {
    if (value === null) {
        return issues;
    }
    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'boolean') {
        return issues;
    }
    if (valueType === 'number') {
        if (!Number.isFinite(value)) {
            issues.push({
                path,
                kind: 'non-finite-number',
                message: `Field "${path}" contains non-finite number (NaN / Infinity)`,
            });
        }
        return issues;
    }
    if (valueType === 'undefined') {
        issues.push({
            path,
            kind: 'undefined',
            message: `Field "${path}" has non-serializable value of type "undefined"`,
        });
        return issues;
    }
    if (valueType === 'function') {
        issues.push({
            path,
            kind: 'function',
            message: `Field "${path}" has non-serializable value of type "function"`,
        });
        return issues;
    }
    if (valueType === 'symbol') {
        issues.push({
            path,
            kind: 'symbol',
            message: `Field "${path}" has non-serializable value of type "symbol"`,
        });
        return issues;
    }
    if (valueType === 'bigint') {
        issues.push({
            path,
            kind: 'bigint',
            message: `Field "${path}" has non-serializable value of type "bigint"`,
        });
        return issues;
    }
    if (Array.isArray(value)) {
        if (ancestors.has(value)) {
            const circularTo = ancestors.get(value);
            issues.push({
                path,
                kind: 'circular',
                circularTo,
                message: `Field "${path}" contains circular reference${circularTo ? ` to "${circularTo}"` : ''}`,
            });
            return issues;
        }
        ancestors.set(value, path);
        for (let i = 0; i < value.length; i++) {
            getSerializationIssues(value[i], pathJoin(path, i), ancestors, issues);
        }
        ancestors.delete(value);
        return issues;
    }
    if (isObjectLike(value)) {
        if (ancestors.has(value)) {
            const circularTo = ancestors.get(value);
            issues.push({
                path,
                kind: 'circular',
                circularTo,
                message: `Field "${path}" contains circular reference${circularTo ? ` to "${circularTo}"` : ''}`,
            });
            return issues;
        }
        ancestors.set(value, path);
        for (const key of Object.keys(value)) {
            getSerializationIssues(value[key], pathJoin(path, key), ancestors, issues);
        }
        ancestors.delete(value);
        return issues;
    }
    return issues;
};
export const isSerializable = (value) => {
    return getSerializationIssues(value).length === 0;
};
const typeFlagFromValue = (value) => {
    if (value === null)
        return null;
    if (Array.isArray(value))
        return 'array';
    const t = typeof value;
    if (String(t) === 'number' && !Number.isFinite(value)) {
        return 'non-finite-number';
    }
    else if (['undefined', 'function', 'symbol', 'bigint'].includes(String(t))) {
        return String(t);
    }
    else if (String(t) === 'object') {
        return 'object';
    }
    return String(t);
};
export const sanitizeNonSerializable = (value, path = '$', ancestors = new WeakMap()) => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 'non-finite-number';
    }
    if (typeof value === 'undefined' ||
        typeof value === 'function' ||
        typeof value === 'symbol' ||
        typeof value === 'bigint') {
        return typeFlagFromValue(value);
    }
    if (Array.isArray(value)) {
        if (ancestors.has(value)) {
            return 'circular';
        }
        ancestors.set(value, path);
        const result = value.map((item, index) => sanitizeNonSerializable(item, pathJoin(path, index), ancestors));
        ancestors.delete(value);
        return result;
    }
    if (isObjectLike(value)) {
        if (ancestors.has(value)) {
            return 'circular';
        }
        ancestors.set(value, path);
        const result = {};
        for (const key of Object.keys(value)) {
            result[key] = sanitizeNonSerializable(value[key], pathJoin(path, key), ancestors);
        }
        ancestors.delete(value);
        return result;
    }
    return typeFlagFromValue(value);
};
const logSerializationIssues = (issues) => {
    for (const issue of issues) {
        console.info(`[${getDate()}] Boma serialization info: ${getIssueMessage(issue)}`);
    }
};
export const saveJSON = (saveInput) => {
    const { filePath, objToSave, format = false, logSaving = false, replaceNonSerializable = false, } = saveInput;
    const issues = getSerializationIssues(objToSave);
    if (issues.length > 0) {
        logSerializationIssues(issues);
        if (!replaceNonSerializable) {
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
        logSaving && console.log(`[${getDate()}] Write file ${filePath} successfully`);
    }
    catch (error) {
        if (isErrorWithCode(error)) {
            console.error(`[${getDate()}] Boma got filesystem error for ${filePath}:`, error);
        }
        throw error;
    }
};
export const readJSON = (props) => {
    const { filePath, createIfNotFound = false, parseJSON = true } = props;
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
    const { filePath, dataToAdd, format = false, logSaving = false, replaceNonSerializable = false, } = saveInput;
    const oldJSON = readJSON({ filePath, createIfNotFound: true });
    if (oldJSON === null || typeof oldJSON !== 'object') {
        return saveJSON({
            filePath,
            objToSave: dataToAdd,
            format,
            logSaving,
            replaceNonSerializable,
        });
    }
    if (Array.isArray(oldJSON) && Array.isArray(dataToAdd)) {
        saveJSON({
            filePath,
            objToSave: [...oldJSON, ...dataToAdd],
            format,
            logSaving,
            replaceNonSerializable,
        });
        return;
    }
    if (isPlainMergeableObject(oldJSON) && isPlainMergeableObject(dataToAdd)) {
        saveJSON({
            filePath,
            objToSave: { ...oldJSON, ...dataToAdd },
            format,
            logSaving,
            replaceNonSerializable,
        });
        return;
    }
    if (Array.isArray(dataToAdd) && isPlainMergeableObject(oldJSON) && Object.keys(oldJSON).length === 0) {
        saveJSON({
            filePath,
            objToSave: [...dataToAdd],
            format,
            logSaving,
            replaceNonSerializable,
        });
        return;
    }
    throw new Error('Cannot merge array with object');
};
