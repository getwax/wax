import { ReactNode, useMemo, useState } from "react";
import { appContext } from "./AppContext";

export const AppContextProvider = ({ children } : { children: ReactNode }) => {
    const [accountCode, setAccountCode] = useState('');
    const [guardianEmail, setGuardianEmail] = useState('');

    const ctxVal = useMemo(() => ({
        accountCode,
        setAccountCode,
        guardianEmail,
        setGuardianEmail,
    }), [
        accountCode,
        guardianEmail
    ])

    return (
        <appContext.Provider value={ctxVal}>
            {children}
        </appContext.Provider>
    )
}
