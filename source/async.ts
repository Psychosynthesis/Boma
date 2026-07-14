import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

import { getDate, getIssueMessage, getSerializationIssues, isErrorWithCode,
  isPlainMergeableObject, isSyntaxError, logSerializationIssues, sanitizeNonSerializable,
} from './common.js';

import type { addToJSONProps, ReadJSONProps, ReadJSONResult, SaveJSONProps, Serializable } from './common.js';

const addToJSONQueues = new Map<string, Promise<void>>();

// Последовательно выполняем read > merge > write для одного и того же пути
// внутри текущего Node.js-процесса. Ошибка операции возвращается её вызывающему коду,
// но не ломает очередь для следующих вызовов.
const runAddToJSONExclusive = async <T>(filePath: string, operation: () => Promise<T>): Promise<T> => {
  const key = resolve(filePath);
  const previous = addToJSONQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const settled = current.then(() => undefined, () => undefined);

  addToJSONQueues.set(key, settled);

  try {
    return await current;
  } finally {
    if (addToJSONQueues.get(key) === settled) {
      addToJSONQueues.delete(key);
    }
  }
};

export const saveJSONAsync = async (saveInput: SaveJSONProps): Promise<void> => {
  const {
    filePath,
    objToSave,
    format = false,
    logSaving = false,
    replaceNonSerializable = false,
    silent = true,
  } = saveInput;

  // Сначала собираем все проблемы, чтобы можно было вывести нормальную диагностику
  const issues = getSerializationIssues(objToSave);

  if (issues.length > 0) {
    !silent && logSerializationIssues(issues);

    // Если режим замены выключен — выкидываем исключение
    if (!replaceNonSerializable) {
      const firstIssue = issues[0];
      const errorMessage = `[${getDate()}] Boma got non JSON-serializable object at saveJSON! ${getIssueMessage(firstIssue)}`;
      // Если режим замены выключен, стараемся следовать логике нативного подхода: если исполнение дойдёт до JSON.stringify
      // он выкинет ошибку сериализации, но она будет без нормально описания, которое здесь даёт getIssueMessage
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
    await writeFile(filePath, json, 'utf8');
    !silent && logSaving && console.log(`[${getDate()}] Write file ${filePath} successfully`);
  } catch (error) {
    if (isErrorWithCode(error)) {
      console.error(`[${getDate()}] Boma got filesystem error for ${filePath}:`, error);
    }
    throw error;
  }
};

export const readJSONAsync = async <T = any>(
  props: ReadJSONProps,
): Promise<ReadJSONResult<T>> => {
  const {
    filePath, createIfNotFound = false, parseJSON = true, silent = true, throwError = false,
  } = props;

  try {
    const savedfile = await readFile(filePath, 'utf8');

    // Для пустого файла возвращаем null, чтобы JSON.parse не падал
    if (parseJSON) {
      return savedfile.trim() === '' ? null : JSON.parse(savedfile);
    }

    return savedfile;
  } catch (err) {
    // Если проставлен этот флаг, сами не обрабатываем никакие ошибки,
    // createIfNotFound также не должен срабатывать в этом случае
    if (throwError) throw err;

    if (isErrorWithCode(err)) {
      switch (err.code) {
        case 'ENOENT':
          if (createIfNotFound) {
            !silent && console.log('Try to create: ', filePath);

            const initialValue = typeof createIfNotFound === 'boolean' ? {} : createIfNotFound;
            const initialContent = JSON.stringify(initialValue);

            try {
              await writeFile(filePath, initialContent, { encoding: 'utf8', flag: 'wx' });
            } catch (writeErr) {
              if (isErrorWithCode(writeErr) && writeErr.code === 'EEXIST') {
                return readJSONAsync<T>({ ...props, createIfNotFound: false });
              }

              if (throwError) throw writeErr;
              // В данную ветку код не должен попадать часто, она срабатывает только при одновременно
              // включенном createIfNotFound и ошибке записи нового файла. Если данный флаг указан,
              // создание файла является ожидаемым поведением и даже если в остальных случаях мы
              // намеренно игнорируем ошибки (throwError = false), тут жалательно хотя бы логгировать ошибку.
              console.error(`[${getDate()}] Boma got error while creating file ${filePath}: `, writeErr, '\n');
            }

            // Учитываем флаг parseJSON при возврате
            return (parseJSON ? initialValue : initialContent) as T;
          }

          !silent && console.info("Boma can't find file: ", filePath);
          return parseJSON ? ({} as T) : null;

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

// Важно:
// если в сохранённом JSON уже были те же ключи, что и в dataToAdd,
// то эта функция их просто перезапишет
export const addToJSONAsync = (saveInput: addToJSONProps): Promise<void> =>
  runAddToJSONExclusive(saveInput.filePath, async () => {
    const {
      filePath,
      dataToAdd,
      format = false,
      logSaving = false,
      replaceNonSerializable = false,
      silent = true,
      throwError = false,
    } = saveInput;

    const oldJSON = await readJSONAsync({
      filePath,
      createIfNotFound: true,
      silent,
      throwError,
    });

    // Если старый JSON битый или не объект — просто перезаписываем файл
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

    // Был массив + пришёл массив => склеиваем
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

    // Был объект + пришёл объект => мерджим
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

    // В файле пустой объект, а сохранить хотим массив => просто пишем массив
    if (
      Array.isArray(dataToAdd)
      && isPlainMergeableObject(oldJSON)
      && Object.keys(oldJSON).length === 0
    ) {
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
