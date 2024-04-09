import React from "react";
import styled from "styled-components";
import { ConnectKitButton, Avatar } from "connectkit";

import { HStack } from "./Spacer/Stack";

import WalletIcon from "../icons/WalletIcon";
import { PrimaryText, TertiaryText } from "./core/Text";

export function Button({
  children,
  ...buttonProps
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <div className="card">
      <button {...buttonProps}>{children}</button>
    </div>
  );
}

type ButtonProps = {
  active?: boolean;
} & React.ComponentPropsWithoutRef<"button">;

export function NewButton({ active, children, ...buttonProps }: ButtonProps) {
  return (
    <ButtonCard gap={4}>
      <StyledButton {...buttonProps}>{children}</StyledButton>
    </ButtonCard>
  );
}

const StyledButton = styled.button`
  display: flex;
  flex-grow: 1;
  min-width: 202px;

  &:focus {
    outline: none;
    box-shadow: none;
  }
`;

const ButtonCard = styled(HStack)`
  display: flex;
  flex-grow: 1;
  min-width: 202px;
`;

type CustomConnectWalletButtonProps = {
  buttonLabel?: string;
  onConnect?: () => void;
};

export function CustomConnectWalletButton({
  buttonLabel = "Connect Wallet",
  onConnect,
}: CustomConnectWalletButtonProps) {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, address, truncatedAddress, ensName }) => {
        if (isConnected && onConnect) {
          onConnect();
        }

        return (
          <StyledWalletButton onClick={show}>
            <HStack>
              {isConnected ? (
                <HStack gap={8} justify="center" align="center">
                  <Avatar address={address} size={24} />
                  <PrimaryText>
                    {ensName ? ensName : truncatedAddress}
                  </PrimaryText>
                  {ensName && <TertiaryText>{truncatedAddress}</TertiaryText>}
                </HStack>
              ) : (
                <HStack gap={8}>
                  <WalletIcon />
                  {buttonLabel}
                </HStack>
              )}
            </HStack>
          </StyledWalletButton>
        );
      }}
    </ConnectKitButton.Custom>
  );
}

const StyledWalletButton = styled(NewButton)`
  justify-content: center;
  align-items: center;
  height: 60px;
  max-width: 380px;
`;
