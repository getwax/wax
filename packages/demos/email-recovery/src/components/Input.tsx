import styled from "styled-components";

export default function Input({ children, name }) {
  return <StyledInput name={name} type="email" />;
}

const StyledInput = styled.input`
  background-color: #1f242f;
  border: 1px solid #333741;
`;
