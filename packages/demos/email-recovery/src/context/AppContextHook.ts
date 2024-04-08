import { useContext } from "react";
import { appContext } from "./AppContext";

export const useAppContext = () => useContext(appContext)
