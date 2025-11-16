// Ambient declaration to allow conditional checks for Deno in browser builds
declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
} | undefined;


