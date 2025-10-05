export interface ServerOptions {
  host?: string | boolean;
}

export interface BuildOptions {
  target?: string;
}

export interface UserConfig {
  server?: ServerOptions;
  build?: BuildOptions;
  [key: string]: unknown;
}

export function defineConfig<T extends UserConfig>(config: T): T;
