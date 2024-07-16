# Design Document: Serializable Utility

## Overview

The `Serializable` utility enhances JavaScript serialization and deserialization capabilities beyond what is offered by standard `JSON.stringify` and `JSON.parse` methods. It supports the serialization of class instances, including methods, decorators, and complex data structures like `Map`, `Set`, and `Date`. This document outlines the internal design and functioning of the `Serializable` utility.

## Features

- **Class Instance Serialization**: Serialize and deserialize class instances while preserving methods and decorators.
- **Complex Data Structures**: Support for `Map`, `Set`, and `Date` objects.
- **Full Reconstruction**: Reconstruct class instances from serialized data, ensuring methods and properties are intact.

## Key Components

1. **ClassMap**: A map that maintains the relationship between class names and their constructors. This allows for proper reconstruction of class instances during deserialization.
2. **Serialization**:
    - **serialize()**: Converts an object into a JSON string, including meta-information about the object's class type and properties.
3. **Deserialization**:
    - **deserialize()**: Converts a JSON string back into an object, reconstructing its class type and properties.
4. **Additional Utilities**:
    - **makeSerializable()**: Adds a class to the internal map, allowing it to be serialized and deserialized by the utility.

## Detailed Design

### 1. ClassMap

- **Purpose**: To store mappings between class names and their constructors.
- **Structure**: A `Map<string, ConstructorV2>` that holds class name keys and constructor values.
- **Usage**: Essential for deserializing objects to their original class instances.

### 2. Serialization

- **serialize(instance: T)**:
  - **Input**: An instance of any type `T`.
  - **Process**:
    - Uses `serializeObject()` (a private function) to convert the instance into a JSON-compatible structure with meta-information.
    - `serializeObject(instance: T, seen: Map<T, string>)`:
      - Checks if the instance is an object.
      - Handles circular references using a `seen` map.
      - Identifies the object's class and adds class meta-information.
      - Special handling for `Set`, `Map`, and `Date`.
      - Recursively serializes object properties.
  - **Output**: A JSON string representing the serialized object.

### 3. Deserialization

- **deserialize(json: string)**:
  - **Input**: A JSON string produced by `serialize()`.
  - **Process**:
    - Parses the JSON string and uses `deserializeObject()` (a private function) to reconstruct the original object.
    - `deserializeObject(jsonObject: any, references: Map<string, any>)`:
      - Checks if the JSON object has a reference.
      - Identifies the class and creates an instance of it.
      - Special handling for `Set`, `Map`, and `Date`.
      - Recursively deserializes object properties.
  - **Output**: The deserialized object.

### 4. Additional Utilities

- **makeSerializable(classConstructor: ConstructorV2)**:
  - **Input**: A class constructor.
  - **Process**: Adds the class to the `classMap`.
  - **Usage**: Allows third-party classes to be serialized and deserialized.


## Serialization - Deserialization Restrictions

When using `serialize` and `deserialize` together, the following properties of the source object can be fully reconstructed in the deserialized object:

| Data Type                        | Can Reconstruct                                                                 |
|----------------------------------|---------------------------------------------------------------------------------|
| `@Serializable` class object     |  decorators, class member functions, property-value pairs |
| Array                            | Proxy if source was proxied, array items and their values based on their type as defined herein |
| Map                              | Proxy if source was proxied, Map keys and values based on their type as defined herein |
| Set                              | Proxy if source was proxied, Set items based on their type as defined herein    |
| Date                             | Proxy if source was proxied, Date value                                         |
| `@Serializable` class object     | Class member functions, property-value pairs                                    |
| Instance of class added with `makeSerializable` | Class member functions, property-value pairs                             |
| Other object                     | Only supports what is offered by standard `JSON.stringify` and `JSON.parse`.    |

### `@Serializable` Class reconstruction:
---
**Class Registration:** During class declaration (when the `@Serializable` decorator is used), the class constructor is added to the classMap.

**Serialization:** When serializing an `@Serializable` class object, we create a new object with `__class` property with the name of the class and a unique (`__id`) property which helps to avoid circular reference. And it also adds a new property `SERIALIZED_CLASS` so that we can identify that is an `Serializable` class.
```
@Serializable
class ClassA {
  constructor(num: number) {
    if (num === undefined) {
      throw new Error("num must not be undefined");
    }
    this.val = num;
  }
}
```
```json
{
  "__class":"ClassA", // name of class allows to recover the prototype
  "__id":"ClassA_0",  // id allows to handle circular references
  "SERIALIZED_CLASS":true, // to identify this is an Serializable class
  //object properties
}
```

**Deserialization:** When deserializing an object, Serializable checks if it has the `__class` metadata. If it does, it retrieves the corresponding class constructor from the classMap based on the information stored in `__class`. 

A new object is then created using this constructor prototye, ensuring it inherits the prototype of the `@Serializable` class and becomes an `@Serializable` class itself. This process also copies all the functions defined on the class prototype.

### `Array` class object reconstruction:
---
**Class Registration:** The framework adds `Array` entry to the classMap.

**Serialization:** Serialization process adds a `__class` and `__id` properties since the class name (`Array`) exists in classMap.
```
arr1 = [1,2,3];
```
```json
{
"arr1": // normal Array property 'arr1'
  {
    "0":1,
    "1":2,
    "2":3,
    "__class":"Array",
    "__id":"Array_1"
  },

}
```

**Deserialization:** During deserialization, it checks if the `__class` constructor is an Array or an instance of Array. If so, it creates and Array and sets the prototype from the class constructor which ensure all the member functions are copied. And then recursively deserializes any nested objects.

### `Map` class object reconstruction:
---
**Class Registration:** The framework adds `Map` entry to the classMap.

**Serialization:** During serialization, it creates an object with a `__map` property set to true and converts the entries to a two dimensional array of key values and assign it another property named `entries`. It also add a `__class` and `__id` properties since the class name (`Map`) exists in classMap.
```
map1 = new Map<number, string>([[3,"one"], [6,"two"],[9,"three"]]);
```

```json
{
"map1": // normal map property 'map1'
  {
    "__class":"Map",
    "__id":"Map_1",
    "entries":[[3,"one"],[6,"two"],[9,"three"]],
    "__map":true
  },
}
```

**Deserialization:** During deserialization, it checks for the existence of the `__map` property and creates a Map if it exists. It also sets the prototype of the class constructor to copy the methods. And then it sets the entries by iterating the two-dimensional array `entries`.

### `Set` class object reconstruction:
---
**Class Registration:** The framework adds `Set` entry to the classMap.

**Serialization:** During serialization, it creates an object with `__set` property set to true and converts the values to an array of values and assigns it to another property named `values`. It also add a `__class` and `__id` properties since the class name (`Set`) exists in classMap.

```
set1 = new Set<number>([1,2,3]);
```

```json
{
  "set1": // Set property 'set1'
  {
    "__class":"Set",
    "__id":"Set_2",
    "values":[1,2,3],
    "__set":true
  }
}
```

**Deserialization:** During deserialization, it checks for the existence of the `__set` property and creates a Set if it exists. It also sets the prototype of the class constructor to copy the methods. And then it adds the values by iterating the array `values`.

### `Date` class object reconstruction:
---
**Class Registration:** The framework adds `Date` entry to the classMap.

**Serialization:** During serialization, it creates an object with `__date` property set to true and converts the date to an ISO String and assings it to a another property named `date`. It also add a `__class` and `__id` properties since the class name (`Date`) exists in classMap.

```
date1 = new Date();
```

```json
{

  "date1":
  {
    "__class":"Date",
    "__id":"Date_2",
    "__date":true,
    "date":"2017-08-05T16:37:31.924Z"
  },
}
```
**Deserialization:** During deserialization, it checks for the existence of the `__date` property and creates a Date from the `date` property.

### Handling Circular References and same objects
---
To prevent circular references and avoid serializing the same object more than once, we use a `Map<T, string>` called `seen`. This map keeps track of objects that have already been serialized by assigning them a unique identifier (`__id`).

**Serialization:**

- When an object is encountered during serialization, it is checked if it has already been seen.
  - If the object has been seen before, a reference to its unique identifier (`__id`) is returned as `__ref` instead of serializing it again.
  - If the object is encountered for the first time, it is added to the `seen` map with a unique identifier (`__id`), preventing circular references.
```
@Serializable
class ClassA {
  constructor() {
  }
  classb1: ClassB = new ClassB();
  classb2: ClassB = new ClassB();
}

@Serializable
class ClassB {
  constructor(num?: number) {
    this.val = num || 0;
  }
  val: number;
}


const instanceA = new ClassA(5); // Creating an instance of ClassA
const instanceB = new ClassB(10); // Creating an instance of ClassB
instanceA.classb1 = instanceB; //assign the instance of ClassB to classb1
instanceA.classb2 = instanceB; //assign the same instance to classb2
const serializedA = Serializable.serialize(instanceA); // Serializing the instance
```
Output
```json
{
  {
    "__class":"ClassA",
    "__id":"ClassA_0",
    "classb1":
    {
      "__class":"ClassB",
      "__id":"ClassB_1",
      "val":10
    },
    "classb2":
    {
      "__ref":"ClassB_1"
    },
    "SERIALIZED_CLASS":true
 }
}
```
**Deserialization:**

- During deserialization, when an object is encountered, it is checked if it has a reference (`__ref`) to an already deserialized object.
  - If a reference is found, the actual object is retrieved from the `references` map using its unique identifier (`__id`).
  - This ensures that circular references are resolved correctly, and each object is reconstructed only once.

## Example Usage for an `@ObserveV2` object

```typescript
@Serializable
class ClassA {
  constructor(num: number) {
    if (num === undefined) {
      throw new Error("num must not be undefined");
    }
    this.val = num;
    this.changedVal = num;
  }

  val: number;
  changedVal: number;

  classb: ClassB = new ClassB(10);

  incr(): number {
    this.val++;
    return this.val;
  }
}

class ClassB {
  constructor(num?: number) {
    this.val = num || 0;
  }

  val: number;

  incr(): number {
    this.val++;
    return this.val;
  }
}

// Making ClassB serializable
Serializable.makeSerializable(ClassB);

// Creating an instance of ClassA
const instanceA = new ClassA(5);

// Serializing the instance
const serializedA = Serializable.serialize(instanceA);
console.log(serializedA);

// Deserializing the instance
const deserializedA = Serializable.deserialize<ClassA>(serializedA);
console.log(deserializedA.val); // Output: 5
console.log(deserializedA.sum); // Output: 15
console.log(deserializedA.classb.val); // Output: 10

// Checking if methods and decorators are preserved
deserializedA.incr();
console.log(deserializedA.val); // Output: 6
console.log(deserializedA.sum); // Output: 16
```
