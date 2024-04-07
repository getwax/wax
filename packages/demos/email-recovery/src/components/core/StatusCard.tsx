import styled from "styled-components";

import { HStack } from "../Spacer/Stack";
import { ReactNode } from "react";

export enum Status {
  Recovered = "Recovered",
  Guarded = "Guarded",
}

type StatusCardProps = {
  status: Status;
  statusText: String;
  icon?: ReactNode;
};

export default function StatusCard({
  statusText,
  status,
  icon,
}: StatusCardProps) {
  return (
    <StyledStatusCard gap={4} align="center" status={status}>
      {icon ? icon : null}
      {statusText}
    </StyledStatusCard>
  );
}

// Define the color mappings for each status
const statusColors = {
  [Status.Recovered]: {
    backgroundColor: "#4E1D09",
    borderColor: "#93370D",
    textColor: "#FEC84B",
  },
  [Status.Guarded]: {
    backgroundColor: "#102A56",
    borderColor: "#1849A9",
    textColor: "#84CAFF",
  },
};

// Extend HStack with dynamic styles based on the status prop
const StyledStatusCard = styled(HStack)<{ status: Status }>`
  height: 28px;

  background-color: ${(props) =>
    statusColors[props.status as Status].backgroundColor};
  border-color: ${(props) => statusColors[props.status as Status].borderColor};
  color: ${(props) => statusColors[props.status as Status].textColor};
  border-style: solid;
  border-width: 1px;
  padding-left: 10px;
  padding-right: 10px;

  padding-top: 0px;
  padding-bottom: 0px;

  border-radius: 9999px;
`;
