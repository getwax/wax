import { useState, useCallback, useMemo } from 'react'
import { useWalletClient, useConfig } from 'wagmi'
import { relayer } from '../services/relayer'
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