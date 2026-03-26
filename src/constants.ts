export const APP_NAME = "super-productivity";
export const APP_VERSION = "1.0.0";
export const DEFAULT_PORT = 3000;

export function getServerPort(): number {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`PORT must be a positive integer, received: ${rawPort}`);
  }

  return parsedPort;
}
