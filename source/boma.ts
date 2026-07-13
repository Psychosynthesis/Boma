import { readFileSync, writeFileSync } from 'fs';

import { addToJSONAsync, readJSONAsync, saveJSONAsync } from './async.js';
import {
  getDate, getIssueMessage, getSerializationIssues, isErrorWithCode, isPlainMergeableObject,
  isSyntaxError, logSerializationIssues, sanitizeNonSerializable
} from './common.js';

import type {
  AddToJSONAsyncProps, addToJSONProps, AddToJSONSyncProps, ReadJSONAsyncProps, ReadJSONProps,
  ReadJSONResult, ReadJSONSyncProps, SaveJSONAsyncProps, SaveJSONProps, SaveJSONSyncProps,
  Serializable,
} from './common.js';

export * from './common.js';

const saveJSONSync = (saveInput: SaveJSONProps) => {
  const {
    filePath, objToSave, format = false, logSaving = false, replaceNonSerializable = false, silent = true,
  } = saveInput;

  // Сначала собираем все проблемы, чтобы можно было вывести нормальную диагностику
  const issues = getSerializationIssues(objToSave);

  if (issues.length > 0) {
    !silent && logSerializationIssues(issues);

    // Если режим замены выключен — ведём себя как раньше, но с точным описанием поля
    if (!replaceNonSerializable && !silent) {
      const firstIssue = issues[0];
      const errorMessage = `[${getDate()}] Boma got non JSON-serializable object at saveJSON! ${getIssueMessage(firstIssue)}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  // Если режим замены включён — чистим объект перед сохранением
  const valueToSave =
    replaceNonSerializable && issues.length > 0
      ? sanitizeNonSerializable(objToSave)
      : (objToSave as Serializable);

  try {
    const json = format ? JSON.stringify(valueToSave, null, 2) : JSON.stringify(valueToSave);
    writeFileSync(filePath, json, 'utf8');
    !silent && logSaving && console.log(`[${getDate()}] Write file ${filePath} successfully`);
  } catch (error) {
    if (isErrorWithCode(error)) {
      console.error(`[${getDate()}] Boma got filesystem error for ${filePath}:`, error);
    }
    throw error;
  }
};

const readJSONSync = <T = any>(props: ReadJSONProps): ReadJSONResult<T> => {
  const { filePath, createIfNotFound = false, parseJSON = true, silent = true } = props;

  try {
    const savedfile = readFileSync(filePath, 'utf8');

    // Для пустого файла возвращаем null, чтобы JSON.parse не падал
    if (parseJSON) {
      return savedfile.trim() === '' ? null : JSON.parse(savedfile);
    }

    return savedfile;
  } catch (err) {
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case 'ENOENT':
          // Если файла нет и попросили создать — создаём
          if (createIfNotFound) {
            !silent && console.log('Try to create: ', filePath);
            try {
              const initialContent =
                typeof createIfNotFound === 'boolean' ? '{}' : JSON.stringify(createIfNotFound);
              writeFileSync(filePath, initialContent, 'utf8');
            } catch (writeErr) {
              console.error(`Error creating file ${filePath}: `, writeErr, '\n');
            }
            return (typeof createIfNotFound === 'boolean' ? {} : createIfNotFound) as T;
          }

          // Здесь, пожалуй, лучше выводить инфу
          console.info("Boma can't find file: ", filePath);
          return parseJSON ? ({} as T) : null;

        case 'EACCES': // Нет прав
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

// Важно:
// если в сохранённом JSON уже были те же ключи, что и в dataToAdd,
// то эта функция их просто перезапишет
const addToJSONSync = (saveInput: addToJSONProps) => {
  const {
    filePath, dataToAdd, format = false, logSaving = false, replaceNonSerializable = false, silent = true,
  } = saveInput;

  const oldJSON = readJSONSync({ filePath, createIfNotFound: true, silent });

  // Если старый JSON битый или не объект — просто перезаписываем файл
  if (oldJSON === null || typeof oldJSON !== 'object') {
    return saveJSONSync({ filePath, objToSave: dataToAdd, format, logSaving, replaceNonSerializable, silent });
  }

  // Был массив + пришёл массив => склеиваем
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

  // Был объект + пришёл объект => мерджим
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

  // В файле пустой объект, а сохранить хотим массив => просто пишем массив
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

export function saveJSON(props: SaveJSONAsyncProps): Promise<void>;
export function saveJSON(props: SaveJSONSyncProps): void;
export function saveJSON(props: SaveJSONProps): void | Promise<void>;
export function saveJSON(props: SaveJSONProps): void | Promise<void> {
  return props.async === true ? saveJSONAsync(props) : saveJSONSync(props);
}

export function readJSON<T = any>(props: ReadJSONAsyncProps): Promise<ReadJSONResult<T>>;
export function readJSON<T = any>(props: ReadJSONSyncProps): ReadJSONResult<T>;
export function readJSON<T = any>(props: ReadJSONProps): ReadJSONResult<T> | Promise<ReadJSONResult<T>>;
export function readJSON<T = any>(
  props: ReadJSONProps,
): ReadJSONResult<T> | Promise<ReadJSONResult<T>> {
  return props.async === true ? readJSONAsync<T>(props) : readJSONSync<T>(props);
}

export function addToJSON(props: AddToJSONAsyncProps): Promise<void>;
export function addToJSON(props: AddToJSONSyncProps): void;
export function addToJSON(props: addToJSONProps): void | Promise<void>;
export function addToJSON(props: addToJSONProps): void | Promise<void> {
  return props.async === true ? addToJSONAsync(props) : addToJSONSync(props);
}
