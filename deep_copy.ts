/**
 * UiUtils class provides utilities for deep copying JavaScript objects,
 * including handling complex types such as Array, Set, Map, and Date.
 * The primary feature is the ability to perform deep copies of objects
 * to a specified depth while preventing circular references.
 */
class UiUtils {
  /**
   * Creates a deep copy of an object to a specified depth.
   * @param {T} instance - The object to be copied.
   * @param {number} [level=-1] - Depth level for copying. -1 means a full deep copy, 0 means a shallow copy.
   * @returns {T} The copied object.
   */
  static deepCopy<T>(instance: T, level: number = -1): T {
    const seen = new Map<T, T>();
    return this.copyObject(instance, seen, level);
  }

  /**
   * Recursively copies an object, handling different data structures and respecting the specified depth level.
   * @param {T} instance - The object to be copied.
   * @param {Map<T, T>} seen - Map tracking seen objects to handle circular references.
   * @param {number} level - Depth level for copying.
   * @returns {T} The copied object.
   */
  private static copyObject<T>(instance: T, seen: Map<T, T>, level: number): T {
    if (instance && typeof instance === "object") {
      if (seen.has(instance)) {
        return seen.get(instance) as T; // Prevent circular references
      }

      if (level === 0) {
        return instance; // Shallow copy if level is 0
      }

      let copy: any;
      if (instance.constructor === Array || instance instanceof Array) {
        copy = new Array();
      } else if (instance instanceof Set) {
        copy = new Set();
      } else if (instance instanceof Map) {
        copy = new Map();
      } else if (instance instanceof Date) {
        copy = new Date(instance);
      } else {
        copy = Object.create(instance.constructor.prototype);
      }

      Object.setPrototypeOf(copy, instance.constructor.prototype);

      seen.set(instance, copy);

      if (instance instanceof Set) {
        for (const item of instance) {
          copy.add(
            this.isObject(item)
              ? this.copyObject(item, seen, level === -1 ? -1 : level - 1)
              : item
          );
        }
      } else if (instance instanceof Map) {
        for (const [key, value] of instance) {
          const copiedKey = this.isObject(key)
            ? this.copyObject(key, seen, level === -1 ? -1 : level - 1)
            : key;
          const copiedValue = this.isObject(value)
            ? this.copyObject(value, seen, level === -1 ? -1 : level - 1)
            : value;
          copy.set(copiedKey, copiedValue);
        }
      } else {
        for (const key in instance) {
          if (instance.hasOwnProperty(key)) {
            if (typeof copy[key] === "undefined") {
              copy[key] = this.isObject(instance[key])
                ? this.copyObject(
                    instance[key as string],
                    seen,
                    level === -1 ? -1 : level - 1
                  )
                : instance[key];
            }
          }
        }
      }

      return copy;
    }
    return instance;
  }

  /**
   * Checks if a value is an object.
   * @param {any} value - The value to check.
   * @returns {boolean} true if the value is an object, false otherwise.
   */
  private static isObject(value: any): boolean {
    return value && typeof value === "object";
  }
}
