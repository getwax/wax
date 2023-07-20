import z from 'zod';

class JsonRpcError extends Error {
  code: number;
  data: unknown;

  constructor({ code, data, message }: RawJsonRpcError) {
    super(message);

    this.code = code;
    this.data = data;
  }

  static parse(rawError: unknown) {
    return new JsonRpcError(RawJsonRpcError.parse(rawError));
  }
}

const RawJsonRpcError = z.object({
  code: z.number().int(),
  data: z.unknown(),
  message: z.string(),
});

type RawJsonRpcError = z.infer<typeof RawJsonRpcError>;

export default JsonRpcError;
export { RawJsonRpcError };
