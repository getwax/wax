import styled from "styled-components";

export default function Card({ children }) {
  return <Wrapper>{children}</Wrapper>;
}

const Wrapper = styled.div`
  padding: 12px;
  border-radius: 8px;

  background-color: #161b26;
  border: 1px solid #333741;
`;
