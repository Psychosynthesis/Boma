import { readFileSync, writeFileSync } from 'fs';

export type SerializablePrimitive = string | number | boolean | null;
export type SerializableArray = Serializable[];
export type SerializableObject = { [key: string]: Serializable };
export type Serializable = SerializablePrimitive | SerializableArray | SerializableObject;

type JSONLikeObject = Record<string, unknown>;
type JSONLikeArray = unknown[];

export interface ReadJSONProps {
  filePath: string;
  parseJSON?: boolean;
  createIfNotFound?: boolean | SerializableObject | SerializableArray; // Файл с чем создать, если не создан
  silent?: boolean; // Не выводим предупреждения
}

export interface SaveJSONProps {
  filePath: string;
  objToSave: unknown;
  format?: boolean;
  logSaving?: boolean;
  replaceNonSerializable?: boolean; // Если true — заменяем плохие значения на строковый флаг типа
  silent?: boolean; // Не выводим предупреждения
}

export interface addToJSONProps {
  filePath: string;
  dataToAdd: JSONLikeObject | JSONLikeArray;
  format?: boolean;
  logSaving?: boolean;
  replaceNonSerializable?: boolean; // Пробрасываем тот же режим и сюда
  silent?: boolean; // Не выводим предупреждения
}

export type ErrorWithCode = Error & { code: string };
export type ErrorWithMessage = Error & { message: any };

export type SerializationIssueKind =
  | 'undefined'
  | 'function'
  | 'symbol'
  | 'bigint'
  | 'non-finite-number'
  | 'circular';

export interface SerializationIssue {
  path: string;
  kind: SerializationIssueKind;
  message: string;
  circularTo?: string;
}

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
};

export const isObjectLike = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null;
};

export const isPlainMergeableObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// Собираем путь до поля в человекочитаемом виде: $.a.b[2].c
const pathJoin = (basePath: string, key: string | number) => {
  if (typeof key === 'number') {
    return `${basePath}[${key}]`;
  }

  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${basePath}.${key}`
    : `${basePath}[${JSON.stringify(key)}]`;
};

const getIssueMessage = (issue: SerializationIssue) => {
  if (issue.kind === 'circular') {
    return `Field "${issue.path}" contains circular reference${issue.circularTo ? ` to "${issue.circularTo}"` : ''}`;
  }

  if (issue.kind === 'non-finite-number') {
    return `Field "${issue.path}" contains non-finite number (NaN / Infinity)`;
  }

  return `Field "${issue.path}" has non-serializable value of type "${issue.kind}"`;
};

// Рекурсивно обходим всё значение и собираем ВСЕ проблемные места
// ancestors — это стек текущего обхода, чтобы ловить именно цикл, а не просто повторную ссылку
export const getSerializationIssues = (
  value: unknown,
  path = '[OBJECT]',
  ancestors = new WeakMap<object, string>(),
  issues: SerializationIssue[] = [],
): SerializationIssue[] => {
  if (value === null) {
    return issues;
  }

  const valueType = typeof value;

  // Примитивы, которые JSON переваривает нормально
  if (valueType === 'string' || valueType === 'boolean') {
    return issues;
  }

  // Числа отдельно: NaN / Infinity лучше считать проблемой, а не молча превращать в null
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

  // Всё это JSON не умеет сериализовать как есть
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

  // Для массивов проверяем цикл и рекурсивно обходим элементы
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

  // Для объектов логика та же: цикл + рекурсивный обход ключей
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

    for (const key of Object.keys(value as Record<string, unknown>)) {
      getSerializationIssues(
        (value as Record<string, unknown>)[key],
        pathJoin(path, key),
        ancestors,
        issues,
      );
    }

    ancestors.delete(value);
    return issues;
  }

  return issues;
};

// Удобная булева проверка, если нужна старая семантика
export const isSerializable = (value: unknown): value is Serializable => {
  return getSerializationIssues(value).length === 0;
};

// Возвращаем строковый маркер типа, которым будем заменять плохое значение
const typeFlagFromValue = (value: unknown): SerializablePrimitive => {
  if (value === null) return null;
  if (Array.isArray(value)) return 'array';

  const t = typeof value;

  if (String(t) === 'number' && !Number.isFinite(value as number)) {
    return 'non-finite-number';
  } else if (['undefined', 'function', 'symbol', 'bigint'].includes(String(t))) {
    return String(t);
  } else if (String(t) === 'object') {
    return 'object';
  }
  return String(t);
};

// Делаем безопасную копию значения:
// всё несереализуемое заменяем на строку с типом
export const sanitizeNonSerializable = (
  value: unknown,
  path = '$',
  ancestors = new WeakMap<object, string>(),
): Serializable => {
  // Нормальные JSON-значения отдаём как есть
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  // NaN / Infinity заменяем на текстовый флаг
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 'non-finite-number';
  }

  // Явно плохие типы заменяем названием типа
  if (['undefined', 'function', 'symbol', 'bigint'].includes(typeof value)) {
    return typeFlagFromValue(value);
  }

  // Для массива рекурсивно чистим элементы
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return 'circular';
    }

    ancestors.set(value, path);

    const result: SerializableArray = value.map((item, index) =>
      sanitizeNonSerializable(item, pathJoin(path, index), ancestors),
    );

    ancestors.delete(value);
    return result;
  }

  // Для объекта рекурсивно чистим поля
  if (isObjectLike(value)) {
    if (ancestors.has(value)) {
      return 'circular';
    }

    ancestors.set(value, path);

    const result: SerializableObject = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      result[key] = sanitizeNonSerializable(
        (value as Record<string, unknown>)[key],
        pathJoin(path, key),
        ancestors,
      );
    }

    ancestors.delete(value);
    return result;
  }

  return typeFlagFromValue(value);
};

// Пишем info по каждой найденной проблеме
const logSerializationIssues = (issues: SerializationIssue[]) => {
  for (const issue of issues) {
    console.info(`[${getDate()}] Boma serialization info: ${getIssueMessage(issue)}`);
  }
};

export const saveJSON = (saveInput: SaveJSONProps) => {
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

export const readJSON = (props: ReadJSONProps) => {
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
            return typeof createIfNotFound === 'boolean' ? {} : createIfNotFound;
          }

          // Здесь, пожалуй, лучше выводить инфу
          console.info("Boma can't find file: ", filePath);
          return parseJSON ? {} : null;

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
export const addToJSON = (saveInput: addToJSONProps) => {
  const {
    filePath,
    dataToAdd,
    format = false,
    logSaving = false,
    replaceNonSerializable = false,
    silent = true,
  } = saveInput;

  const oldJSON = readJSON({ filePath, createIfNotFound: true, silent });

  // Если старый JSON битый или не объект — просто перезаписываем файл
  if (oldJSON === null || typeof oldJSON !== 'object') {
    return saveJSON({
      filePath,
      objToSave: dataToAdd,
      format,
      logSaving,
      replaceNonSerializable,
      silent
    });
  }

  // Был массив + пришёл массив => склеиваем
  if (Array.isArray(oldJSON) && Array.isArray(dataToAdd)) {
    saveJSON({
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
    saveJSON({
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
    saveJSON({
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
