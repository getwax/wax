import React from "react";
import styled from "styled-components";

import { HStack } from "./Spacer/Stack";

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
    <ButtonCard active={active} gap={4}>
      <StyledButton active={active} {...buttonProps}>
        {children}
      </StyledButton>
    </ButtonCard>
  );
}

const StyledButton = styled.button<{ active: boolean }>`
  display: flex;
  flex-grow: 1;
  min-width: 202px;
`;

const ButtonCard = styled(HStack)<{ active: boolean }>`
  display: flex;
  flex-grow: 1;
  min-width: 202px;
`;
