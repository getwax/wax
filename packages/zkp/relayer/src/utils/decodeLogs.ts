import { Abi, Address, TransactionReceipt, decodeEventLog } from "viem";

type AbiOrUnknown = Abi | readonly unknown[];

export default function decodeEventFromReceipt(
    receipt: TransactionReceipt,
    targetAddress: Address,
    abi: AbiOrUnknown,
    eventSignature: string
) {
    const logsFromTargetAddress = receipt.logs.filter((log) => {
        return log.address.toLowerCase() === targetAddress.toLowerCase();
    });

    const eventLog = logsFromTargetAddress.filter((log) => {
        return log.topics[0] === eventSignature;
    });

    return decodeEventLog({
        abi: abi,
        data: eventLog[0].data,
        topics: eventLog[0].topics,
    });
}
