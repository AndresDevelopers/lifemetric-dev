/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@prisma/client' {
  export class PrismaClient {
    [key: string]: any;
    constructor(options?: unknown);
  }

  export namespace Prisma {
    class PrismaClientKnownRequestError extends Error {
      code: string;
    }
    class PrismaClientInitializationError extends Error {}
    class PrismaClientValidationError extends Error {}
  }
}
