export const removeUndefined = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === "object" && item !== null) {
        return removeUndefined(item); // Recursively remove undefined keys from objects in the array
      }
      return item; // Preserve non-object elements in the array
    });
  } else if (typeof data === "object" && data !== null) {
    const result = {};
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === "object" && value !== null) {
        result[key] = removeUndefined(value); // Recursively remove undefined keys from nested objects
      } else if (value !== undefined && value !== null) {
        result[key] = value;
      }
    });
    return result;
  } else {
    return data; // Preserve non-object data
  }
};
