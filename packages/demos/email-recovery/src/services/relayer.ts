// TODO replace fetch
// import { get, post } from "axios"

class RelayerError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = 'RelayerError';
    }
}

// Spec: https://www.notion.so/proofofemail/Email-Sender-Auth-c87063cd6cdc4c5987ea3bc881c68813#d7407d31e1354167be61612f5a16995b
// TODO Do we need to use bigints to prevent possible overflows?
class Relayer {
    private readonly apiRoute = 'api';
    apiUrl: string;

    constructor(relayerUrl: string) {
        this.apiUrl = `${relayerUrl}${this.apiRoute}`
    }

    private async throwErrFromRes(res: Response) {
        const msg = `${res.url} ${res.status} ${await res.text()}`;
        throw new RelayerError(msg);
    }

    // Similar to a ping or health endpoint
    async echo() {
        const res = await fetch(`${this.apiUrl}/echo`);
        if (!res.ok) {
            await this.throwErrFromRes(res);
        }
    }

    async requestStatus(requestId: number) {
        const res = await fetch(`${this.apiUrl}/requestStatus`, {
			body: JSON.stringify({
				request_id: requestId
			})
		});
        if (!res.ok) {
            await this.throwErrFromRes(res);
        }
		return res.json();
    }

    async acceptanceRequest(
		walletEthAddr: string,
		guardianEmailAddr: string,
		accountCode: string,
		templateIdx: number,
		subject: string
	): Promise<{ requestId: number }> {
		const res = await fetch(`${this.apiUrl}/acceptanceRequest`, {
			method: "POST",
			body: JSON.stringify({
				wallet_eth_addr: walletEthAddr,
				guardian_email_addr: guardianEmailAddr,
				account_code: accountCode,
				template_idx: templateIdx,
				subject,
			})
		});
        if (!res.ok) {
            await this.throwErrFromRes(res);
        }
		const { request_id: requestId } = await res.json();
		return {
			requestId,
		}
    }

    async recoveryRequest(
		walletEthAddr: string,
		guardianEmailAddr: string,
		templateIdx: number,
		subject: string
	) {
		const res = await fetch(`${this.apiUrl}/recoveryRequest`, {
			method: "POST",
			body: JSON.stringify({
				wallet_eth_addr: walletEthAddr,
				guardian_email_addr: guardianEmailAddr,
				template_idx: templateIdx,
				subject,
			})
		});
        if (!res.ok) {
            await this.throwErrFromRes(res);
        }
		const { request_id: requestId } = await res.json();
		return {
			requestId,
		}
    }

    async completeRequest(walletEthAddr: string) {
		const res = await fetch(`${this.apiUrl}/completeRequest`, {
			method: "POST",
			body: JSON.stringify({
				wallet_eth_addr: walletEthAddr,
			})
		});
        if (!res.ok) {
            await this.throwErrFromRes(res);
        }
		return res.json();
    }
}

export const relayer = new Relayer(import.meta.env.VITE_RELAYER_URL);
