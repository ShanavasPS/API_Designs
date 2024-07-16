# Design Document for UiUtils Class

## Overview

The `UiUtils` class provides utilities for deep copying JavaScript objects, including handling complex types such as `Array`, `Set`, `Map`, and `Date`. The primary feature is the ability to perform deep copies of objects to a specified depth while preventing circular references.

## Goals

- **Deep Copy Functionality:** Provide a method to create deep copies of objects.
- **Handle Complex Types:** Ensure correct copying of arrays, sets, maps, and dates.
- **Prevent Circular References:** Manage circular references by using a `Map` to track seen objects.
- **Custom Depth Control:** Allow specifying the depth level for copying, including shallow copies.

## Non-Goals

- The utility does not aim to handle special object types beyond those specified (e.g., `RegExp`, `Error`).
- It does not provide serialization or deserialization capabilities.

## Design

### Class: `UiUtils`

- **Methods:**
  - `deepCopy<T>(instance: T, level: number = -1): T`
  - `private static copyObject<T>(instance: T, seen: Map<T, T>, level: number): T`
  - `private static isObject(value: any): boolean`

### Method: `deepCopy`

#### Purpose:
Creates a deep copy of an object to a specified depth.

#### Parameters:
- `instance` (`T`): The object to be copied.
- `level` (`number`, default `-1`): Depth level for copying. `-1` means a full deep copy, `0` means a shallow copy.

#### Returns:
- (`T`): The copied object.

#### Workflow:
1. Initialize a `Map` to track seen objects and prevent circular references.
2. Call the `copyObject` method with the instance, seen map, and level.

### Method: `copyObject`

#### Purpose:
Recursively copies an object, handling different data structures and respecting the specified depth level.

#### Parameters:
- `instance` (`T`): The object to be copied.
- `seen` (`Map<T, T>`): Map tracking seen objects to handle circular references.
- `level` (`number`): Depth level for copying.

#### Returns:
- (`T`): The copied object.

#### Workflow:
1. **Check for Object Type:**
   - If `instance` is not an object, return `instance`.
   - If `instance` is in the `seen` map, return the previously copied instance to handle circular references.
   - If `level` is `0`, return the instance for a shallow copy.
2. **Create Copy:**
   - Determine the type of `instance` and create an appropriate empty copy (`Array`, `Set`, `Map`, `Date`, or general object).
   - Set the prototype of the copy to match the `instance`'s prototype.
   - Add the `instance` to the `seen` map.
3. **Copy Elements/Properties:**
   - For `Set`: Iterate over items and recursively copy each item.
   - For `Map`: Iterate over entries, recursively copy each key and value.
   - For general objects: Iterate over own properties and recursively copy each value.
4. **Handle Custom Metadata:**
   - If `SERIALIZED_CLASS` is in the instance, apply additional functionalities if needed.
5. **Return Copy:**
   - Return the fully copied object.

### Method: `isObject`

#### Purpose:
Checks if a value is an object.

#### Parameters:
- `value` (`any`): The value to check.

#### Returns:
- (`boolean`): `true` if the value is an object, `false` otherwise.

## Considerations

- **Performance:** Deep copying can be expensive in terms of time and memory. Use depth control to mitigate performance issues.
- **Circular References:** The implementation must handle circular references gracefully to avoid infinite loops.
- **Prototype Handling:** The copied object retains the prototype of the original, ensuring methods and properties are preserved correctly.
- **Special Metadata:** Support for additional metadata handling ensures compatibility with specific frameworks or libraries.

## Example Usage

```typescript
const original = {
  a: 1,
  b: [2, 3],
  c: new Set([4, 5]),
  d: new Map([['key1', 'value1'], ['key2', 'value2']]),
  e: new Date()
};

const copy = UiUtils.deepCopy(original, 2);

console.log(copy);
