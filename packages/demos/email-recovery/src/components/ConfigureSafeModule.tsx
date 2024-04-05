import { waitForTransactionReceipt } from '@wagmi/core'
import { useState, useCallback, useMemo } from 'react'
import { useWalletClient, useConfig } from 'wagmi'
import { relayer } from '../services/relayer'
import { abi as moduleAbi, bytecode as moduleBytecode } from '../abi/SafeZkEmailRecoveryPlugin.json'
import { verifier, dkimRegistry, emailAuthImpl } from '../../contracts.base-sepolia.json'
import { Button } from './Button'

// TODO Pull from lib
type HexStr = `0x${string}`;

const safeModuleAddressKey = 'safeModuleAddress'

export function ConfigureSafeModule() {
    const cfg = useConfig();
    const { data: walletClient } = useWalletClient()
    const [safeModuleAddress/*, setSafeModuleAddress*/] = useState(
        localStorage.getItem(safeModuleAddressKey)
    )
  
    const [moduleEnabled, setModuleEnabled] = useState(false)
    const [recoveryConfigured, setRecoveryConfigured] = useState(false)

    const deployEmailRecoveryModule = useCallback(async() => {
        const hash = await walletClient?.deployContract({
            abi: moduleAbi,
            bytecode: moduleBytecode.object as HexStr,
            args: [verifier, dkimRegistry, emailAuthImpl],
        }) as HexStr
        console.debug('module deploy txn hash', hash)
        const receipt = await waitForTransactionReceipt(cfg, { hash })
        console.debug('module deploy txn receipt', receipt)
        // TODO Look this up from receipt
        // const moduleAddress = "0x01";

        // setSafeModuleAddress(moduleAddress);
        // localStorage.setItem(safeModuleAddressKey, moduleAddress);
    }, [walletClient, cfg])

    const enableEmailRecoveryModule = useCallback(async () => {
      // TODO submit txn to enable module
  
      setModuleEnabled(true);
    }, [])
  
    const configureRecoveryAndRequestGuardian = useCallback(async () => {
      // TODO submit txn/userop to configure recovery
      // TODO Consider, could we enable the module & configure recovery in one step/txn/userop?
  
    //   await relayer.acceptanceRequest();
  
      setRecoveryConfigured(true);
    }, [])

    const recoveryCfgEnabled = useMemo(
        () => !moduleEnabled || recoveryConfigured,
        [moduleEnabled, recoveryConfigured]
    );

    return (
        <>
            <Button disabled={!!safeModuleAddress} onClick={deployEmailRecoveryModule}>
                1. Deploy Email Recovery Module
            </Button>
            <h2>TODO (below)</h2>
            <Button disabled={!safeModuleAddress} onClick={enableEmailRecoveryModule}>
                2. Enable Email Recovery Module
            </Button>
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
                    3. Configure Recovery & Request Guardian
                </Button>
            </div>
        </>
    );
}