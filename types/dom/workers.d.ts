interface Worker {}
interface SharedWorker {}

declare var Worker: {
  new (...args: any[]): Worker;
};

declare var SharedWorker: {
  new (...args: any[]): SharedWorker;
};
export {};
