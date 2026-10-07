export function readItem(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(storage, key, value) {
  try {
    if (value == null) storage.removeItem(key);
    else storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
