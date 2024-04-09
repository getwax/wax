import { createContext } from 'react'

type AppContextType = {
    accountCode: string,
    setAccountCode: (ac: string) => void;
    guardianEmail: string;
    setGuardianEmail: (ge: string) => void;
}

export const appContext = createContext<AppContextType>({
    accountCode: '',
    setAccountCode: () => {},
    guardianEmail: '',
    setGuardianEmail: () => {}
});

