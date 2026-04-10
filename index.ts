import { readFileSync, writeFileSync } from 'fs';

export type SerializablePrimitive = string | number | boolean | null;
export type SerializableArray = Serializable[];
export type SerializableObject = { [key: string]: Serializable };
export type Serializable = SerializablePrimitive | SerializableArray | SerializableObject;

export interface ReadJSONProps {
  filePath: string;
  parseJSON?: boolean;
  createIfNotFound?: boolean | SerializableObject | SerializableArray; // Файл с чем создать, если не создан
}

export interface SaveJSONProps {
  filePath: string;
  objToSave: Serializable;
  format?: boolean
  logSaving?: boolean;
}

export interface addToJSONProps {
  filePath: string;
  dataToAdd: SerializableObject | SerializableArray;
  format?: boolean
  logSaving?: boolean;
}

export type ErrorWithCode = Error & { code: string };
export type ErrorWithMessage = Error & { message: any };

// Хелперы для проверки типов ошибок
export const isErrorWithCode = (error: unknown): error is ErrorWithCode => {
  return error instanceof Error && 'code' in error;
};

export const isErrorWithMessage = (error: unknown): error is ErrorWithMessage => {
  return error instanceof Error && 'message' in error;
};

export const isSyntaxError = (error: unknown): error is SyntaxError => {
  return error instanceof SyntaxError;
};

const getDate = () => {
  const castedDate = new Date();
  return castedDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export const isSerializable = (value: unknown, seen = new WeakSet()): value is Serializable => {
  if (
    value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  ) {
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
    if (seen.has(value as object)) {
      return false; // цикл
    }
    seen.add(value as object);

    const obj = value as Record<string, unknown>;
    for (const key in obj) {
      if (!isSerializable(obj[key], seen)) {
        return false;
      }
    }
    return true;
  }

  return false;
}

export const saveJSON = (saveInput: SaveJSONProps) => {
  const { filePath, objToSave, format = false, logSaving = false } = saveInput;
  if (!isSerializable(objToSave)) {
    console.error(`[${getDate()}] Boma get non JSON-serializable object at saveJSON!`);
    throw new Error(`[${getDate()}] Boma get non JSON-serializable object at saveJSON!`);
  }

  try {
    const json = format ? JSON.stringify(objToSave, null, 2) : JSON.stringify(objToSave);
    writeFileSync(filePath, json, 'utf8');
    logSaving && console.log(`[${getDate()}] Write file ${filePath} successfully`);
  } catch (error) {
    if (isErrorWithCode(error)) {
      console.error(`[${getDate()}] Boma get filesystem error for ${filePath}:`, error);
    }
    throw error; // Или вернуть кастомный результат
  }
};

export const readJSON = (props: ReadJSONProps) => {
  const { filePath, createIfNotFound = false, parseJSON = true } = props;

  try {
    const savedfile = readFileSync(filePath, 'utf8');
    if (parseJSON) { // For empty files
      return savedfile.trim() === "" ? null : JSON.parse(savedfile);
    }
    return savedfile;
  } catch (err) {
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case 'ENOENT':
          // Проверка для ошибок файловой системы
          if (createIfNotFound) {
            console.log('Try to create: ', filePath);
            try {
              const initialContent = typeof createIfNotFound === 'boolean' ? '{}' : JSON.stringify(createIfNotFound);
              writeFileSync(filePath, initialContent, 'utf8');
            } catch (writeErr) {
              console.error(`Error creating file ${filePath}: `, writeErr, '\n');
            }
            return typeof createIfNotFound === 'boolean' ? {} : createIfNotFound;
          }
          console.log('File not found: ', filePath);
          return parseJSON ? {} : null;

        case 'EACCES': // Нет прав
          console.error(`Access denied for ${filePath}`);
          return null;

        default: // Другие ошибки FS
          console.error(`Some filesystem error when try readJSON: ${filePath}`);
          return null;
      }
    }

    // Проверка синтаксических ошибок JSON
    if (isSyntaxError(err)) {
      console.error('File ', filePath, ' has incorrect JSON syntax', '\n');
      return null;
    }

    // Общая обработка ошибок
    console.error('Function readJSON error:', err, '\n');
    return null;
  }
};

// Важно! Если в сохранённом JSON уже были те же ключи, которые есть в objToAdd
// То данная функция их просто перезапишет
export const addToJSON = (saveInput: addToJSONProps) => {
  const { filePath, dataToAdd, format = false, logSaving = false } = saveInput;

  const oldJSON = readJSON({ filePath, createIfNotFound: true });
  if (oldJSON === null || typeof oldJSON !== 'object') {
    // Перезаписать файл, если данные битые
    return saveJSON({ filePath, objToSave: dataToAdd, logSaving });
  }

  if (Array.isArray(oldJSON) && Array.isArray(dataToAdd)) { // Был массив, сохраняем массив
    saveJSON({ filePath, objToSave: [...oldJSON, ...dataToAdd], format, logSaving });
  } else if (!Array.isArray(oldJSON) && !Array.isArray(dataToAdd)) { // Сохраняем объекты
    saveJSON({ filePath, objToSave: { ...oldJSON, ...dataToAdd }, format, logSaving });
  } else if (Array.isArray(dataToAdd) && Object.keys(oldJSON).length === 0) { // Ничего нет, но хотим сохранить массив
    saveJSON({ filePath, objToSave: [...dataToAdd], format, logSaving });
  } else {
    throw new Error('Cannot merge array with object');
  }
};
