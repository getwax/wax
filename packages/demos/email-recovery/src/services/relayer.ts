class RelayerError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = 'RelayerError';
    }
}

// TODO fill in http calls, type correctly
// See https://www.notion.so/proofofemail/Email-Sender-Auth-c87063cd6cdc4c5987ea3bc881c68813#d7407d31e1354167be61612f5a16995b
// Sections 5.2 & 5.3
class Relayer {
    private readonly apiRoute = 'api';
    apiUrl: string;

    constructor(relayerUrl: string) {
        this.apiUrl = `${relayerUrl}${this.apiRoute}`
    }

    private async throwErrFromRes(res) {
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

    // GET
    async requestStatus() {
        /*
        {
			"name": "Request Status",
			"protocolProfileBehavior": {
				"disableBodyPruning": true
			},
			"request": {
				"method": "GET",
				"header": [],
				"body": {
					"mode": "raw",
					"raw": "{\n    \"request_id\": 6452730868223340277\n}",
					"options": {
						"raw": {
							"language": "json"
						}
					}
				},
				"url": {
					"raw": "http://localhost:4500/api/requestStatus",
					"protocol": "http",
					"host": [
						"localhost"
					],
					"port": "4500",
					"path": [
						"api",
						"requestStatus"
					]
				}
			},
			"response": []
		},
        */
    }

    // POST
    async acceptanceRequest() {
        /*
        {
			"name": "Acceptance Request",
			"request": {
				"method": "POST",
				"header": [],
				"body": {
					"mode": "raw",
					"raw": "{\n    \"wallet_eth_addr\": \"0xe3cAAe207983FF54118112536520Ce0ec2FC53Cc\",\n    \"guardian_email_addr\": \"bisht.s.aditya@gmail.com\",\n    \"account_code\": \"12c68bae81cd4ca6616ddc8392a27476f3d2450068fb7e703d4f7f662348b438\",\n    \"template_idx\": 0,\n    \"subject\": \"Accept guardian request for 0xe3cAAe207983FF54118112536520Ce0ec2FC53Cc\"\n}",
					"options": {
						"raw": {
							"language": "json"
						}
					}
				},
				"url": {
					"raw": "http://localhost:4500/api/acceptanceRequest",
					"protocol": "http",
					"host": [
						"localhost"
					],
					"port": "4500",
					"path": [
						"api",
						"acceptanceRequest"
					]
				}
			},
			"response": []
		},
        */
    }

    // POST
    async recoveryRequest() {
        /*
        {
			"name": "Recovery Request",
			"request": {
				"method": "POST",
				"header": [],
				"body": {
					"mode": "raw",
					"raw": "{\n    \"wallet_eth_addr\": \"0xe3cAAe207983FF54118112536520Ce0ec2FC53Cc\",\n    \"guardian_email_addr\": \"bisht.s.aditya@gmail.com\",\n    \"template_idx\": 0,\n    \"subject\": \"Set the new signer of 0xe3cAAe207983FF54118112536520Ce0ec2FC53Cc to 0x9401296121FC9B78F84fc856B1F8dC88f4415B2e\"\n}",
					"options": {
						"raw": {
							"language": "json"
						}
					}
				},
				"url": {
					"raw": "http://localhost:4500/api/recoveryRequest",
					"protocol": "http",
					"host": [
						"localhost"
					],
					"port": "4500",
					"path": [
						"api",
						"recoveryRequest"
					]
				}
			},
			"response": []
		},
        */
    }

    // POST
    async completeRequest() {
        /*
{
			"name": "Complete Request",
			"request": {
				"method": "POST",
				"header": [],
				"body": {
					"mode": "raw",
					"raw": "{\n    \"wallet_eth_addr\": \"0xe3cAAe207983FF54118112536520Ce0ec2FC53Cc\"\n}",
					"options": {
						"raw": {
							"language": "json"
						}
					}
				},
				"url": {
					"raw": "http://localhost:4500/api/completeRecovery",
					"protocol": "http",
					"host": [
						"localhost"
					],
					"port": "4500",
					"path": [
						"api",
						"completeRecovery"
					]
				}
			},
			"response": []
		}
        */
    }
}

export const relayer = new Relayer(import.meta.env.VITE_RELAYER_URL);
