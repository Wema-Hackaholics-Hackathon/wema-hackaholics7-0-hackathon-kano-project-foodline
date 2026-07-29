// Local typings for @mono.co/connect.js (the package ships no TypeScript
// declarations). Shapes follow the widget docs in
// node_modules/@mono.co/connect.js/docs/examples/nextjs.md.
declare module "@mono.co/connect.js" {
  export type MonoConnectOptions = {
    key: string;
    onSuccess: (response: { code: string }) => void;
    onClose?: () => void;
    onLoad?: () => void;
    onEvent?: (eventName: string, data: unknown) => void;
    data?: {
      customer?: {
        name?: string;
        email?: string;
        identity?: { type: string; number: string };
      };
    };
    [key: string]: unknown;
  };

  export default class Connect {
    constructor(options: MonoConnectOptions);
    setup(): void;
    open(): void;
    close(): void;
    reauthorise(accountId: string): void;
  }
}
