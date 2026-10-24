declare module "jsonwebtoken" {
  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: string | Buffer,
    options?: any
  ): string;
  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: any
  ): any;
  export function decode(token: string, options?: any): any;
}

declare module "bcryptjs" {
  export function genSalt(rounds?: number): Promise<string>;
  export function hash(s: string, salt: string | number): Promise<string>;
  export function compare(s: string, hash: string): Promise<boolean>;
}
