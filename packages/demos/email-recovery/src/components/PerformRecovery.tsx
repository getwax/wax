import { useState, useCallback } from 'react'
import { Button } from './Button'
import { relayer } from '../services/relayer';

export function PerformRecovery() {
    // TODO Pass in props or get from onchain data
    const recoveryConfigured = false;
    const [recoveryInProgress, setRecoveryInProgress] = useState(false);
    const [recoveryApproved, setRecoveryApproved] = useState(false);
    const [delayRemaining, setDelayRemaining] = useState(0);

    const requestRecovery = useCallback(async () => {
        await relayer.recoveryRequest();
    
        setRecoveryInProgress(true);
      }, [])
    
      const testRecoveryApprove = useCallback(() => {
        // TODO Instead, poll relayer.requestStatus until approval is complete
    
        setRecoveryApproved(true);
        setDelayRemaining(42);
      }, []);
    
      const testTimeTravel = useCallback(() => {
        setDelayRemaining(0);
      }, []);
    
      const completeRecovery = useCallback(async () => {
        // TODO Instead, poll relayer.requestStatus until complete recovery is complete
    
        setRecoveryInProgress(false);
        setRecoveryApproved(false);
      }, []);

    return (
        <>
            <Button disabled={!recoveryConfigured || recoveryInProgress} onClick={requestRecovery}>
                3. Request Recovery
            </Button>
            <div>
                <div>4. Awaiting Guardian Approval</div>
                <Button disabled={!recoveryConfigured || recoveryApproved} onClick={testRecoveryApprove}>
                    TEST Approve (Switch to polling)
                </Button>
            </div>
            <div>
                <div>5. Waiting until delay is finished... ({delayRemaining} time units)</div>
                <Button
                    disabled={!recoveryInProgress || !recoveryApproved || !delayRemaining}
                    onClick={testTimeTravel}>
                    TEST Time Travel
                </Button>
            </div>
            <Button
                disabled={!recoveryInProgress || !recoveryApproved || !delayRemaining} 
                onClick={completeRecovery}>
                6. Complete Recovery (Switch to polling)
            </Button>
        </>
    );
}
