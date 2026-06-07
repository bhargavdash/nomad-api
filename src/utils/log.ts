/**
 * Dev-only logger. Logs in development, silent in production.
 * Use this instead of bare console.log for debug output.
 * To re-enable debug logs locally: NODE_ENV is 'development' by default.
 */
const isDev = process.env.NODE_ENV !== 'production';

export const devLog = (...args: unknown[]): void => {
  if (isDev) console.log(...args);
};

export const devWarn = (...args: unknown[]): void => {
  if (isDev) console.warn(...args);
};
