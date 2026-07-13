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
  async?: boolean; // Если true — используем асинхронную реализацию
}

export interface SaveJSONProps {
  filePath: string;
  objToSave: unknown;
  format?: boolean;
  logSaving?: boolean;
  replaceNonSerializable?: boolean; // Если true — заменяем плохие значения на строковый флаг типа
  silent?: boolean; // Не выводим предупреждения
  async?: boolean; // Если true — используем асинхронную реализацию
}

export interface addToJSONProps {
  filePath: string;
  dataToAdd: JSONLikeObject | JSONLikeArray;
  format?: boolean;
  logSaving?: boolean;
  replaceNonSerializable?: boolean; // Пробрасываем тот же режим и сюда
  silent?: boolean; // Не выводим предупреждения
  async?: boolean; // Если true — используем асинхронную реализацию
}

// Отдельные типы нужны для перегрузок функций:
// async: true возвращает Promise, async: false или отсутствие async — обычное значение
export type ReadJSONSyncProps = ReadJSONProps & { async?: false };
export type ReadJSONAsyncProps = ReadJSONProps & { async: true };
export type SaveJSONSyncProps = SaveJSONProps & { async?: false };
export type SaveJSONAsyncProps = SaveJSONProps & { async: true };
export type AddToJSONSyncProps = addToJSONProps & { async?: false };
export type AddToJSONAsyncProps = addToJSONProps & { async: true };

// T = any сохраняет прежнюю, нестрогую типизацию результата JSON.parse
export type ReadJSONResult<T = any> = T | string | null;

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

export const getDate = () => {
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

export const getIssueMessage = (issue: SerializationIssue) => {
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
  // null проверяем отдельно, чтобы TypeScript точно сузил unknown до Serializable
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
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
export const logSerializationIssues = (issues: SerializationIssue[]) => {
  for (const issue of issues) {
    console.info(`[${getDate()}] Boma serialization info: ${getIssueMessage(issue)}`);
  }
};
