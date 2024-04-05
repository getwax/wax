import { relayer } from '../services/relayer';
import { Button } from './Button'
import { useState, useCallback } from 'react'

export function ConfigureSafeModule() {
    const [moduleEnabled, setModuleEnabled] = useState(false);
    const [recoveryConfigured, setRecoveryConfigured] = useState(false);
  
  
    const enableEmailRecoveryModule = useCallback(async () => {
      // TODO submit txn to enable module
  
      setModuleEnabled(true);
    }, [])
  
    const configureRecoveryAndRequestGuardian = useCallback(async () => {
      // TODO submit txn/userop to configure recovery
      // TODO Consider, could we enable the module & configure recovery in one step/txn/userop?
  
      await relayer.acceptanceRequest();
  
      setRecoveryConfigured(true);
    }, [])

    return (
        <>
            <Button disabled={moduleEnabled} onClick={enableEmailRecoveryModule}>
                1. Enable Email Recovery Module
            </Button>
            <div>
                <label>
                    Guardian's Email
                    <input type='email' />
                </label>
                <label>
                    Recovery Delay
                    <input type='number' />
                </label>
                <Button
                    disabled={!moduleEnabled || recoveryConfigured}
                    onClick={configureRecoveryAndRequestGuardian}>
                    2. Configure Recovery & Request Guardian
                </Button>
            </div>
        </>
    );
}