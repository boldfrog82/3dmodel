declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }

  interface Process {
    env: ProcessEnv;
    cwd(): string;
  }
}

declare var process: NodeJS.Process;
declare var __dirname: string;

declare interface NodeRequire {
  (id: string): any;
  resolve(id: string): string;
  main: any;
}

declare var require: NodeRequire;

declare interface NodeModule {
  exports: any;
  require: NodeRequire;
}

declare var module: NodeModule;

type Buffer = any;
declare const Buffer: any;

declare module "node:events" {
  export class EventEmitter {
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    emit(event: string | symbol, ...args: any[]): boolean;
  }
}

declare module "node:http" {
  export type OutgoingHttpHeaders = Record<string, string | number | readonly string[]>;
  export type ClientRequestArgs = Record<string, any>;
  export interface IncomingMessage {
    headers: Record<string, string | string[] | undefined>;
    url?: string;
    method?: string;
    [key: string]: any;
  }
  export interface ClientRequest {
    end(data?: any): void;
  }
  export interface Agent {}
  export interface Server {}
  export interface ServerResponse {}
}

declare module "node:http2" {
  export interface Http2SecureServer {}
}

declare module "node:https" {
  export interface ServerOptions {}
  export interface Server {}
}

declare module "node:url" {
  export class URL {
    constructor(input: string, base?: string | URL);
    toString(): string;
  }
}

declare module "node:stream" {
  export interface Duplex {}
  export interface DuplexOptions {}
}

declare module "node:tls" {
  export interface SecureContextOptions {}
}

declare module "node:zlib" {
  export interface ZlibOptions {}
}

declare module "node:fs" {
  export namespace fs {
    interface FSWatcher {}
    interface Stats {}
  }
  export type FSWatcher = fs.FSWatcher;
  export type Stats = fs.Stats;
}

declare module "node:path" {
  export function resolve(...segments: string[]): string;
  export function join(...segments: string[]): string;
}

declare module "node:crypto" {
  export interface BinaryLike {}
}
