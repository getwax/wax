import { useState, useCallback, useMemo } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { abi as safeAbi } from '../abi/Safe.json'
import { abi as recoveryPluginAbi } from '../abi/SafeZkEmailRecoveryPlugin.json'
import { safeZkSafeZkEmailRecoveryPlugin } from '../../contracts.base-sepolia.json'
import { Button } from './Button'
import { genAccountCode, getRequestGuardianSubject, templateIdx } from '../utils/email'
import { readContract } from 'wagmi/actions'
import { config } from '../providers/config'
import { pad } from 'viem'
import { relayer } from '../services/relayer'
import { useAppContext } from '../context/AppContextHook'

export function ConfigureSafeModule() {
    const { address } = useAccount()
    const { writeContractAsync } = useWriteContract()

    const {
        guardianEmail,
        setGuardianEmail,
        accountCode,
        setAccountCode
    } = useAppContext()
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

    // const checkGuardianAcceptance = useCallback(async () => {
    //     if (!gurdianRequestId) {
    //         throw new Error('missing guardian request id')
    //     }

    //     const resBody = await relayer.requestStatus(gurdianRequestId)
    //     console.debug('guardian req res body', resBody);
    // }, [gurdianRequestId])

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

        const acctCode = await genAccountCode();
        setAccountCode(accountCode);

        const guardianSalt = await relayer.getAccountSalt(acctCode, guardianEmail);
        const guardianAddr = await readContract(config, {
            abi: recoveryPluginAbi,
            address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
            functionName: 'computeEmailAuthAddress',
            args: [guardianSalt]
        })
        // TODO Should this be something else?
        const previousOwnerInLinkedList = pad("0x1", {
            size: 20
        })

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

         const recoveryRouterAddr = await readContract(config, {
            abi: recoveryPluginAbi,
            address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
            functionName: 'getRouterForSafe',
            args: [address]
        }) as string;

        const subject = getRequestGuardianSubject(address);
        const { requestId } = await relayer.acceptanceRequest(
            recoveryRouterAddr,
            guardianEmail,
            acctCode,
            templateIdx,
            subject,
        );

        console.debug('req guard req id', requestId)
        // TODO poll until guard req is complete or fails
    }, [
        address,
        firstSafeOwner,
        guardianEmail,
        recoveryDelay,
        accountCode,
        setAccountCode,
        writeContractAsync
    ])

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
                    <input disabled ={!isModuleEnabled}
                        type='email'
                        onInput={e => setGuardianEmail((e.target as HTMLTextAreaElement).value)}
                    />
                </label>
                <label>
                    Recovery Delay
                    <input
                        disabled={!isModuleEnabled}
                        type='number'
                        onInput={e => setRecoveryDelay(parseInt((e.target as HTMLTextAreaElement).value))}
                    />
                </label>
                <Button
                    disabled={!isModuleEnabled}
                    onClick={configureRecoveryAndRequestGuardian}>
                    2. Configure Recovery & Request Guardian
                </Button>
            </div>
        </>
    );
}
