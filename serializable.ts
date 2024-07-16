/**
 * Serializable
 *
 * The Serializable utility enhances the serialization and deserialization capabilities beyond
 * the standard JSON.stringify and JSON.parse methods. While JSON.stringify serializes
 * object properties and their values, it drops functions, class, property, and function decorators,
 * and does not support Map, Set, or Date serialization. Serializable addresses these limitations,
 * providing robust support for a wider range of JavaScript features.
 *
 * Main Features:
 * - Adds support for serializing and deserializing class instances, including methods and decorators.
 * - Supports serialization of complex data structures like Map, Set, and Date.
 * - Provides full reconstruction of class instances through the Serializable.deserialize method.
 *
 * Usage Scenarios:
 * - Serializing class instances to JSON for network transmission or storage.
 * - Deserializing JSON data back into fully functional class instances, preserving methods and decorators.
 * - Converting JSON data received from network or database into state management observable view models (e.g., @Serializable class objects).
 *
 * The name 'Serializable' is derived from the word 'stringify', reflecting its purpose to enhance JSON serialization and deserialization for classes.
 *
 */

type Constructor = { new(...args: any[]): any };

class Serializable {
    private static classMap = new Map<string, Constructor>([['Date', Date], ['Set', Set], ['Map', Map], ['Array', Array]]);
    public static readonly SERIALIZED_CLASS = Symbol('__SERIALIZED_CLASS__');

    /**
     * Serializes the given object into a string. This string includes additional meta info
     * allowing `deserialize` to fully reconstruct the original object, including its class
     * type and properties.
     *
     * @template T - The type of the object being serialized.
     * @param {T} instance - The object to serialize.
     * @returns {string} - The serialized string representation of the object.
     */
    static serialize<T>(instance: T): string {
      const seen = new Map<T, string>();
      const serializedObject = this.serializeObject(instance, seen);
      return JSON.stringify(serializedObject);
    }
  
    private static serializeObject<T>(instance: T, seen: Map<T, string>): any {
      if (instance && typeof instance === 'object') {
        if (seen.has(instance)) {
          return { __ref: seen.get(instance) }; // Prevent circular references
        }
  
        const className = this.getClassName(instance.constructor.name);
        const classConstructor = this.classMap.get(className);
        const id = `${className}_${seen.size}`;
        seen.set(instance, id);
  
        if (classConstructor) {
          const jsonObject: any = { __class: className, __id: id };
  
          if (instance instanceof Set) {
            jsonObject.values = Array.from(instance).map(item =>
              this.isObject(item) ? this.serializeObject(item, seen) : item
            );
            jsonObject.__set = true;
          } else if (instance instanceof Map) {
            jsonObject.entries = Array.from(instance).map(([key, value]) => [
              this.isObject(key) ? this.serializeObject(key, seen) : key,
              this.isObject(value) ? this.serializeObject(value, seen) : value
            ]);
            jsonObject.__map = true;
          } else if (instance instanceof Date) {
            jsonObject.__date = true;
            jsonObject.date = instance.toISOString();
          } else {
            Object.assign(jsonObject, instance);
            for (const key in jsonObject) {
              if (instance.hasOwnProperty(key)) {
                jsonObject[key] = this.isObject(instance[key])
                  ? this.serializeObject(instance[key], seen)
                  : instance[key];
              }
            }
          }
  
          //Adding V2_DECO_META for Serializable classes
          if (Serializable.SERIALIZED_CLASS in instance) {
            jsonObject.SERIALIZED_CLASS = true;
          }
          return jsonObject;
        }
      }
      return instance;
    }
  
    /**
     * Deserializes a string produced by `serialize` back into the original object,
     * fully reconstructing its class type and properties.
     *
     * @template T - The type of the object being deserialized.
     * @param {string} json - The serialized string representation of the object.
     * @returns {T} - The deserialized object.
     */
    static deserialize<T>(json: string): T {
      const jsonObject = JSON.parse(json);
      const references = new Map<string, any>();
      return this.deserializeObject(jsonObject, references);
    }
  
    private static deserializeObject<T>(jsonObject: any, references: Map<string, any>): T {
      if (jsonObject && typeof jsonObject === 'object') {
        if (jsonObject.__ref) {
          return references.get(jsonObject.__ref);
        }
  
        const className = jsonObject.__class;
        const classConstructor = this.classMap.get(className);
        const id = jsonObject.__id;
  
        let instance: any;
        if (classConstructor) {
          if (classConstructor === Array || classConstructor.prototype instanceof Array) {
            instance = new Array();
          } else if (jsonObject.__set) {
            instance = new Set();
          } else if (jsonObject.__map) {
            instance = new Map();
          } else if (jsonObject.__date) {
            instance = new Date(jsonObject.date);
          } else {
            instance = Object.create(classConstructor.prototype);
          }
  
          Object.setPrototypeOf(instance, classConstructor.prototype);
  
          references.set(id, instance);
  
          if (instance instanceof Set) {
            for (const value of jsonObject.values) {
              instance.add(this.isObject(value) ? this.deserializeObject(value, references) : value);
            }
          } else if (instance instanceof Map) {
            for (const [key, value] of jsonObject.entries) {
              instance.set(
                this.isObject(key) ? this.deserializeObject(key, references) : key,
                this.isObject(value) ? this.deserializeObject(value, references) : value
              );
            }
          } else {
            for (const key in jsonObject) {
              if (jsonObject.hasOwnProperty(key) && key !== '__class' && key !== '__id') {
                if(typeof instance[key] === "undefined") {
                  instance[key] = this.isObject(jsonObject[key])
                  ? this.deserializeObject(jsonObject[key], references)
                  : jsonObject[key];
                }
              }
            }
          }
  
          if(jsonObject.SERIALIZED_CLASS) {
            //Perform any additional functionalities if needed
          }
          return instance as T;
        } else {
          const simpleInstance: any = {};
          references.set(id, simpleInstance);
          for (const key in jsonObject) {
            if (jsonObject.hasOwnProperty(key) && key !== '__class' && key !== '__id') {
              simpleInstance[key] = this.isObject(jsonObject[key])
                ? this.deserializeObject(jsonObject[key], references)
                : jsonObject[key];
            }
          }
          return simpleInstance as T;
        }
      }
      return jsonObject as T;
    }
  
    /**
     * Parses a JSON string or object and applies the nested key-values to a class object.
     * The main usage scenario is to convert JSON data received from a network or database
     * to a state management observable view model.
     *
     * @template T - The type of the object being parsed.
     * @param {new() => T | T} type_ - The class prototype or constructor function that has no parameters.
     * @param {string | Object} jsonObj - The JSON string or JSON object.
     * @returns {T} - The parsed object of type T.
     */
    static parse<T extends Object>(type_: { new(): Constructor; } | Constructor, jsonObj: string | Object): T {
      // Check if the jsonObj is a string and parse it into an object if necessary
      const jsonObject = (typeof jsonObj === 'string') ? JSON.parse(jsonObj) : jsonObj;
  
      let instance: T;
  
      // Determine if type_ is a constructor function or an existing instance
      if (typeof type_ === 'function') {
        instance = new type_();
      } else {
        instance = type_;
      }
  
      if (Array.isArray(instance)) {
        if (Array.isArray(jsonObject)) {
          (instance as any).length = 0; // Clear the array
          for (const element of jsonObject) {
            (instance as any).push(element);
          }
        }
      }
  
      // Assign the jsonObject's properties to the instance
      for (const key in instance) {
        if (instance.hasOwnProperty(key)) {
          if(jsonObject.hasOwnProperty(key)) {
            (instance as any)[key] = jsonObject[key];
          }
        }
      }
  
      return instance;
    }
  
    private static isObject(value: any): value is Object {
      return value !== null && typeof value === 'object';
    }
  
    private static getClassName(constructorName: string): string {
      //remove 'bound ' prefix for proxied objects
      const match = constructorName.match(/^(?:bound\s)?(.+)$/);
      return match ? match[1] : constructorName;
    }
  }
  