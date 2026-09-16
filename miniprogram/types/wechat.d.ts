declare namespace WechatMiniprogram {
  interface CallFunctionResult<T = unknown> { result: T }
}

declare const wx: {
  cloud?: {
    init(options: { env: string; traceUser?: boolean }): void;
    callFunction<T>(options: { name: string; data: unknown }): Promise<WechatMiniprogram.CallFunctionResult<T>>;
  };
  showToast(options: { title: string; icon: "none" | "success"; duration?: number }): void;
};

declare function App(options: { onLaunch?(): void }): void;
type MiniProgramPage = {
  data: Record<string, unknown>;
  setData(data: Record<string, unknown>): void;
};

declare function Page(options: Record<string, unknown> & ThisType<MiniProgramPage>): void;
