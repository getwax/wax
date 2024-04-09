import styled from "styled-components";
import "./App.css";
import { VStack } from "./components/Spacer/Stack";
import EmailRecovery from "./EmailRecovery";
import { Web3Provider } from "./providers/Web3Provider";
import { AppContextProviderV2 } from "./context/v2/AppContextProviderV2";

function App() {
  return (
    <Web3Provider>
      <PageWrapper justify="center">
        <AppContextProviderV2>
          <EmailRecovery />
        </AppContextProviderV2>
      </PageWrapper>
    </Web3Provider>
  );
}

export default App;

const PageWrapper = styled(VStack)`
  background-color: #0c111d;
  width: 100%;
  height: 100%;
  color: white;
`;
