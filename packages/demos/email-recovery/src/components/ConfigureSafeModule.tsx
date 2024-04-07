import { useState, useCallback, useMemo } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { abi as safeAbi } from '../abi/Safe.json'
import { safeZkSafeZkEmailRecoveryPlugin } from '../../contracts.base-sepolia.json'
import { Button } from './Button'

export function ConfigureSafeModule() {
    const { address } = useAccount()
    const { writeContract } = useWriteContract()

    const [recoveryConfigured, setRecoveryConfigured] = useState(false)

    const { data: isModuleEnabled } = useReadContract({
        address,
        abi: safeAbi,
        functionName: 'isModuleEnabled',
        args: [safeZkSafeZkEmailRecoveryPlugin]
    });

    const enableEmailRecoveryModule = useCallback(async () => {
        if (!address) {
            throw new Error('unable to get account address');
        }

        writeContract({
            abi: safeAbi,
            address,
            functionName: 'enableModule',
            args: [safeZkSafeZkEmailRecoveryPlugin],
         })
    }, [address, writeContract])
  
    const configureRecoveryAndRequestGuardian = useCallback(async () => {
      // TODO submit txn/userop to configure recovery
      // TODO Consider, could we enable the module & configure recovery in one step/txn/userop?
  
    //   await relayer.acceptanceRequest();
  
      setRecoveryConfigured(true);
    }, [])

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
                    <input disabled ={recoveryCfgEnabled} type='email' />
                </label>
                <label>
                    Recovery Delay
                    <input disabled={recoveryCfgEnabled} type='number' />
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