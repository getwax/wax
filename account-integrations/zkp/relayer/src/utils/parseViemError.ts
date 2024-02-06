import { ContractFunctionRevertedError, BaseError } from "viem";

export default function parseViemError(error: unknown): string {
    if (error instanceof BaseError) {
        const revertError = error.walk(
            (error) => error instanceof ContractFunctionRevertedError
        );

        if (
            revertError instanceof ContractFunctionRevertedError &&
            revertError.data
        ) {
            return revertError.data.errorName;
        }

        return error.shortMessage;
    }

    return "An unknown error has occured.";
}
