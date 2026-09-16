declare const wx: any;
declare function App<T extends Record<string, any>>(options: T & ThisType<T>): void;
declare function Page<T extends Record<string, any>>(options: T & ThisType<T & {
  data: any;
  setData(data: Record<string, any>, callback?: () => void): void;
  getTabBar?(): any;
}>): void;
declare function Component<T extends Record<string, any>>(options: T & ThisType<T & {
  data: any;
  setData(data: Record<string, any>, callback?: () => void): void;
  triggerEvent(name: string, detail?: unknown): void;
}>): void;
declare function getApp<T = any>(): T;
