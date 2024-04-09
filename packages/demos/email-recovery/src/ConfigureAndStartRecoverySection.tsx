import styled from "styled-components";
import { useMemo, useState, useCallback, useEffect } from "react";

import { VStack, HStack } from "./components/Spacer/Stack";
import { CustomConnectWalletButton, NewButton } from "./components/Button";
import {
  PrimaryText,
  SecondaryText,
  TertiaryText,
  SecondaryHeader,
} from "./components/core/Text";
import Card from "./components/Card";
import Input from "./components/Input";
import ShieldDollarIcon from "../src/icons/ShieldDollarIcon";
import SafeIcon from "../src/icons/SafeIcon";
import StatusCard, { Status } from "./components/core/StatusCard";
import testPfp from "../src/assets/testPfp.png";
import ExistingWalletStartRecoverySection from "./ExistingWalletStartRecoverySection";
import ClockFastForwardIcon from "./icons/ClockFastForwardIcon";

const testWalletConnectionData = {
  ensName: "anaaronist.eth",
  walletAddress: "0x95e1...17d6",
};

enum SubmitType {
  configureAndRequestGuardian = "configureAndRequestGuardian",
  startRecovery = "startRecovery",
  completeRecovery = "completeRecovery",
}

enum RecoverState {
  notStarted = "notStarted",
  inProgress = "inProgress",
  readyToComplete = "readyToComplete",
}

const testGuardianEmail = "guardian@prove.email";
const testRequestWalletAddress = "0x.....";

type ConfigureAndStartRecoverySectionProps = {
  isExistingWallet?: boolean;
  onConfigureRecoveryAndRequestGuardianClick: () => void;
};

export default function ConfigureAndStartRecoverySection({
  isExistingWallet = false,
  onConfigureRecoveryAndRequestGuardianClick,
}: ConfigureAndStartRecoverySectionProps) {
  const [progressState, setProgressState] = useState<SubmitType>(
    SubmitType.configureAndRequestGuardian,
  );
  const [recoverState, setRecoverState] = useState<RecoverState>(
    RecoverState.notStarted,
  );

  const handleConfigureAndRequestClick = useCallback(() => {
    try {
      onConfigureRecoveryAndRequestGuardianClick();
    } catch {
      throw new Error("ConfigureRecoveryAndRequestGuardian error");
    } finally {
      setProgressState(SubmitType.startRecovery);
    }
  }, []);

  const handleRerouteToNewWalletToSetNewGuardianClick =
    useCallback(() => {}, []);

  const handleStartRecoveryClick = useCallback(async () => {
    setRecoverState(RecoverState.inProgress); // Set recovering to true initially

    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait for 3 seconds

    setRecoverState(RecoverState.readyToComplete); // Set recovering to true initially
  }, []);

  const handleCompleteRecoveryClick = useCallback(
    () => setProgressState(SubmitType.completeRecovery),
    [],
  );

  const startRecoveryActionButton = useMemo(() => {
    let title = "";
    let icon = null;
    let onClick: any = handleStartRecoveryClick;

    if (recoverState === RecoverState.notStarted) {
      title = "Start Recovery";
    } else if (recoverState === RecoverState.inProgress) {
      title = "Cancel Recovery";
      icon = <ClockFastForwardIcon />;
    } else if (recoverState === RecoverState.readyToComplete) {
      title = "Complete Recovery";
      icon = <SafeIcon />;
      onClick = handleCompleteRecoveryClick;
    }

    return (
      <StyledWalletButton onClick={onClick}>
        <HStack gap={12} align="center">
          {icon}
          {title}
        </HStack>
      </StyledWalletButton>
    );
  }, [recoverState, handleStartRecoveryClick]);

  const actionsComponent = useMemo(() => {
    if (progressState === SubmitType.configureAndRequestGuardian) {
      return (
        <>
          <ContentWrapper>
            <Card>
              <ContentWrapper gap={12}>
                <HStack>
                  <StyledTertiaryText>Guardian's Email</StyledTertiaryText>
                </HStack>

                <HStack justify="space-between" align="center">
                  <Input
                    placeholder="guardian email here"
                    defaultValue={testGuardianEmail}
                    type="email"
                    readOnly={true}
                    onChange={() => {}}
                  />
                  <TertiaryText>Recovery delay: 0</TertiaryText>
                </HStack>
              </ContentWrapper>
            </Card>
          </ContentWrapper>
          <StyledWalletButton
            onClick={handleConfigureAndRequestClick}
            active={false}
          >
            Configure Recovery and Request Guardian
          </StyledWalletButton>
        </>
      );
    } else if (progressState === SubmitType.startRecovery) {
      return (
        <>
          <ContentWrapper gap={12}>
            <HStack>
              <SecondaryText>
                {recoverState === RecoverState.readyToComplete
                  ? "Requested Status:"
                  : "Requested Recoveries"}
              </SecondaryText>
            </HStack>
            <Card>
              <ContentWrapper gap={12}>
                <GridWrapper>
                  <HStack>
                    <TertiaryText>Guardian's Email</TertiaryText>
                  </HStack>
                  <HStack>
                    <StyledTertiaryText>
                      Requested New Wallet Address
                    </StyledTertiaryText>
                  </HStack>
                  <Input
                    placeholder="guardian email here"
                    defaultValue={testGuardianEmail}
                    type="email"
                    readOnly={false}
                    onChange={() => {}}
                  />
                  <Input
                    placeholder="request wallet here"
                    defaultValue={testRequestWalletAddress}
                    type="text"
                    readOnly={false}
                    onChange={() => {}}
                  />
                </GridWrapper>
              </ContentWrapper>
            </Card>
          </ContentWrapper>
          {startRecoveryActionButton}
        </>
      );
    } else if (progressState === SubmitType.completeRecovery) {
      return (
        <StyledWalletButton
          active={false}
          onClick={handleRerouteToNewWalletToSetNewGuardianClick}
        >
          {"Complete! Connect new wallet to set new guardians ->"}
        </StyledWalletButton>
      );
    }
  }, [
    progressState,
    handleStartRecoveryClick,
    startRecoveryActionButton,
    testGuardianEmail,
    testRequestWalletAddress,
    handleConfigureAndRequestClick,
  ]);

  if (isExistingWallet) {
    return (
      <ExistingWalletStartRecoverySection
        onProceed={handleCompleteRecoveryClick}
      />
    );
  }

  return (
    <VStack gap={28} align="center">
      <SecondaryHeader>Safe Email Recovery Demo</SecondaryHeader>
      <ContentWrapper gap={12}>
        <HStack gap={16}>
          <SecondaryText>Connected Wallet: </SecondaryText>
        </HStack>
        <ContentWrapper>
          <HStack gap={12} align="center">
            <MinContentWrapper>
              <CustomConnectWalletButton />
            </MinContentWrapper>
            {progressState === SubmitType.completeRecovery && (
              <StatusCard
                statusText="Recovered"
                status={Status.Recovered}
                icon={<ShieldDollarIcon />}
              />
            )}
          </HStack>
        </ContentWrapper>
      </ContentWrapper>
      {actionsComponent}
    </VStack>
  );
}

const GridWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(
    2,
    50%
  ); /* Creates two columns, each taking 45% of the container's width */
  grid-row-gap: 10px;
  grid-column-gap: 10px;
  width: 100%; /* Ensures the grid takes the full width of its parent */
  justify-content: center; /* Center aligns the grid items horizontally */
  align-items: start; /* Aligns the grid items to the start of the container vertically */
`;

const MinContentWrapper = styled.div`
  width: min-content;
`;

const StyledTertiaryText = styled(TertiaryText)`
  font-size: 14px;
  display: flex;
`;

const ContentWrapper = styled(VStack)`
  width: 100%;
`;

const StyledWalletButton = styled(NewButton)`
  justify-content: center;
  align-items: center;
  height: 60px;
  max-width: 380px;
`;
