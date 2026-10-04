declare module 'pngjs' {
  export const PNG: {
    sync: {
      read(
        data: Buffer,
        options: { checkCRC: boolean },
      ): { width: number; height: number; data: Buffer };
      write(data: { width: number; height: number; data: Buffer }): Buffer;
    };
  };
}
