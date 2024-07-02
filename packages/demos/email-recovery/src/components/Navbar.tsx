import { Web3Provider } from "../providers/Web3Provider";
import { ConnectKitButton } from "connectkit";
import { Button } from "./Button";

const Navbar = () => {
  return (
      <nav className="navbar">
        <ConnectKitButton />
      </nav>
  );
};

export default Navbar;
