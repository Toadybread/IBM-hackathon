import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'

/**
 * A generic hook that persists state to localStorage.
 *
 * @param key       The localStorage key.
 * @param initial   Initial value (or factory function) used when no stored value exists.
 * @returns         A [value, setValue] pair, just like useState.
 */
function useLocalStorage<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) {
        return JSON.parse(stored) as T
      }
    } catch {
      // Ignore parse errors — fall back to initial value
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Ignore write errors (e.g. quota exceeded)
    }
  }, [key, state])

  return [state, setState]
}

export default useLocalStorage
