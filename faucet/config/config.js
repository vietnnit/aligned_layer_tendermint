
import { stringToPath } from '@cosmjs/crypto'
import fs from 'fs'

const HOME = ".faucet";
const mnemonic_path= `${HOME}/mnemonic.txt`

const path = stringToPath("m/44'/118'/0'/0/0")
const mnemonic = fs.readFileSync(mnemonic_path, "utf8").trim()

export default {
    port: 8088, // http port 
    db: {
        path: `${HOME}/history.db` // save request states 
    },
    project: {
        name: "AlignedLayer Faucet",
    },
    blockchains: [
        {
            name: process.env.CHAIN_ID ?? "alignedlayer",
            endpoint: {
                // make sure that CORS is enabled in rpc section in config.toml
                // cors_allowed_origins = ["*"]
                rpc_endpoint: "http://localhost:26657",
            },
            sender: {
                mnemonic,
                option: {
                    "prefix": "aligned",  //address prefix
                    "hdPaths": [path],
                }
            },
            tx: {
                amount: [
                    {
                        denom: "stake",
                        amount: "1000000"
                    },
                ],
                fee: {
                    amount: [
                        {
                            amount: "100",
                            denom: "stake"
                        }
                    ],
                    gas: "200000"
                },
            },
            limit: {
                // how many times each wallet address is allowed in a window(24h)
                address: 1,
                // how many times each ip is allowed in a window(24h),
                // if you use proxy, double check if the req.ip is return client's ip.
                ip: 5
            }
        },
    ]    
}
