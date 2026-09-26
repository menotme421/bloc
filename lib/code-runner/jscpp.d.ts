declare module "JSCPP" {
  export type JSCPPStdio = {
    write(s: string): void;
    drain?: () => string;
  };
  export type JSCPPConfig = {
    stdio?: JSCPPStdio;
    unsigned_overflow?: "error" | "warn" | "ignore";
    debug?: boolean;
  };
  const JSCPP: {
    /**
     * Interpret C/C++ source. `input` feeds stdin (cin/scanf).
     * Returns the program exit code; throws on compile/runtime errors.
     */
    run(code: string, input: string, config?: JSCPPConfig): number;
  };
  export default JSCPP;
}
