import { createContext, useContext } from 'react';
import WaxInPage, { EthereumApi } from '../src';

export default class DemoContext {
  ethereum: EthereumApi;

  constructor(public waxInPage: WaxInPage) {
    this.ethereum = waxInPage.ethereum;
  }

  private static context = createContext<DemoContext>({} as DemoContext);

  static Provider = DemoContext.context.Provider;

  static use() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useContext(DemoContext.context);
  }
}
