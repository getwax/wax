
// TODO fill in http calls, type correctly
// See https://www.notion.so/proofofemail/Email-Sender-Auth-c87063cd6cdc4c5987ea3bc881c68813#d7407d31e1354167be61612f5a16995b
// Sections 5.2 & 5.3
export class Relayer {
    constructor(private readonly relayerUrl: string) {}

    async requestStatus() {
        // const res = await fetch(`${this.relayerUrl}/requestStatus`);
        // return res.json();
    }

    // POST
    async acceptanceRequest() {

    }

    // POST
    async recoveryRequest() {

    }

    // POST
    async completeRequest() {
        
    }
}

