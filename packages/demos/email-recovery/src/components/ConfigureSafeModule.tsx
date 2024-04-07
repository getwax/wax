import { useState, useCallback, useMemo } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { abi as safeAbi } from '../abi/Safe.json'
import { abi as recoveryPluginAbi } from '../abi/SafeZkEmailRecoveryPlugin.json'
import { safeZkSafeZkEmailRecoveryPlugin } from '../../contracts.base-sepolia.json'
import { Button } from './Button'
import { genAccountCode, getGuardianAddress, getRequestGuardianSubject } from '../utils/email'

export function ConfigureSafeModule() {
    const { address } = useAccount()
    const { writeContractAsync } = useWriteContract()

    const [recoveryConfigured, setRecoveryConfigured] = useState(false)
    const [guardianEmail, setGuardianEmail] = useState<string>()
    // TODO 0 sets recovery to default of 2 weeks, likely want a warning here
    // Also, better time duration setting component
    const [recoveryDelay, setRecoveryDelay] = useState(0)

    const { data: isModuleEnabled } = useReadContract({
        address,
        abi: safeAbi,
        functionName: 'isModuleEnabled',
        args: [safeZkSafeZkEmailRecoveryPlugin]
    });

    const { data: safeOwnersData } = useReadContract({
        address,
        abi: safeAbi,
        functionName: 'getOwners',
    });
    const firstSafeOwner = useMemo(() => {
        const safeOwners = safeOwnersData as string[];
        if (!safeOwners?.length) {
            return;
        }
        return safeOwners[0];
    }, [safeOwnersData]);

    const enableEmailRecoveryModule = useCallback(async () => {
        if (!address) {
            throw new Error('unable to get account address');
        }

        await writeContractAsync({
            abi: safeAbi,
            address,
            functionName: 'enableModule',
            args: [safeZkSafeZkEmailRecoveryPlugin],
         })
    }, [address, writeContractAsync])

    const configureRecoveryAndRequestGuardian = useCallback(async () => {
        if (!address) {
            throw new Error('unable to get account address');
        }

        if (!guardianEmail) {
            throw new Error('guardian email not set')
        }

        if (!firstSafeOwner) {
            throw new Error('safe owner not found')
        }

        const accountCode = await genAccountCode();
        const guardianAddr = await getGuardianAddress(guardianEmail, accountCode);
        const subject = getRequestGuardianSubject(address);
        // TODO Should this be something else?
        const previousOwnerInLinkedList = '0x1'

        await writeContractAsync({
            abi: recoveryPluginAbi,
            address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
            functionName: 'configureRecovery',
            args: [
                firstSafeOwner,
                guardianAddr,
                recoveryDelay,
                previousOwnerInLinkedList
            ],
         })

         console.debug('recovery configured');

         accountCode;
         subject;

        // const { requestId } = await relayer.acceptanceRequest(
        //     emailRecoveryRelayer,
        //     guardianEmail,
        //     accountCode,
        //     templateIdx,
        //     subject,
        // );

        setRecoveryConfigured(true);
    }, [
        address,
        firstSafeOwner,
        guardianEmail,
        recoveryDelay,
        writeContractAsync
    ])

    const recoveryCfgEnabled = useMemo(
        () => !isModuleEnabled || recoveryConfigured,
        [isModuleEnabled, recoveryConfigured]
    );

    return (
        <>
            {
                isModuleEnabled ?
                <div>Recovery Module Enabled</div> :
                <Button onClick={enableEmailRecoveryModule}>
                    1. Enable Email Recovery Module
                </Button>
            }
            <div>
                <label>
                    Guardian's Email
                    <input disabled ={recoveryCfgEnabled}
                        type='email'
                        onInput={e => setGuardianEmail((e.target as HTMLTextAreaElement).value)}
                    />
                </label>
                <label>
                    Recovery Delay
                    <input
                        disabled={recoveryCfgEnabled}
                        type='number'
                        onInput={e => setRecoveryDelay(parseInt((e.target as HTMLTextAreaElement).value))}
                    />
                </label>
                <Button
                    disabled={recoveryCfgEnabled}
                    onClick={configureRecoveryAndRequestGuardian}>
                    2. Configure Recovery & Request Guardian
                </Button>
            </div>
        </>
    );
}