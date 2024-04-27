import express from 'express';
import bodyParser from 'express';

import {DirectSecp256k1HdWallet} from "@cosmjs/proto-signing";
import {SigningStargateClient} from "@cosmjs/stargate";

import conf from './config/config.js'
import {FrequencyChecker} from './checker.js';

import {Mutex, withTimeout} from 'async-mutex';

import 'dotenv/config';

// load config
console.log("loaded config: ", conf)

const RECAPTCHA_ACTION = 'token'

const mutex = withTimeout(new Mutex(), 60000);

const app = express()
app.enable("trust proxy")
app.set("view engine", "ejs");
app.use(bodyParser.json({
  limit: '1mb'
}));

const checker = new FrequencyChecker(conf)

app.get('/', (req, res) => {
  res.render('index', conf);
})

app.get('/config.json', async (req, res) => {
  const sample = {}
  for (let i = 0; i < conf.blockchains.length; i++) {
    const chainConf = conf.blockchains[i]
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(chainConf.sender.mnemonic, chainConf.sender.option);
    const [firstAccount] = await wallet.getAccounts();
    sample[chainConf.name] = firstAccount.address
  }

  const project = conf.project
  project.sample = sample
  project.blockchains = conf.blockchains.map(x => x.name)
  res.send(project);
})

app.get('/balance/:chain', async (req, res) => {
  const { chain } = req.params

  let balance = {}

  try {
    const chainConf = conf.blockchains.find(x => x.name === chain)
    if (chainConf) {
      const rpcEndpoint = chainConf.endpoint.rpc_endpoint;
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(chainConf.sender.mnemonic, chainConf.sender.option);
      const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
      const [firstAccount] = await wallet.getAccounts();
      await client.getBalance(firstAccount.address, chainConf.tx.amount[0].denom).then(x => {
        balance = x
      }).catch(e => console.error(e));
    }
  } catch (err) {
    console.log(err)
  }
  res.send(balance);
})

app.post('/send/:chain/:address', async (req, res) => {
  const { chain, address } = req.params;
  const ip = req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers['X-Forwarded-For'] || req.ip
  const recaptcha = req.body.recaptcha
  const discord_token = req.body.discord_token

  if (!chain && !address) {
    res.send({ result: 'address is required' })
    return
  }

  if (!recaptcha || !await validateRecaptcha(recaptcha)) {
    return res.status(400).send({ result: 'Captcha is not valid' })
  }
  const discord_user = await getDiscordUser(discord_token)
  if (!discord_token || !discord_user || !await belongsToServer(discord_token)) {
    return res.status(400).send({ result: 'You are not a member of the server' })
  }

  try {
    const chainConf = conf.blockchains.find(x => x.name === chain)
    if (!chainConf || !address.startsWith(chainConf.sender.option.prefix)) {
      res.status(400).send({ result: `Address [${address}] is not supported.` })
      return
    }

    if (!await checker.checkAddress(address, chain) ||
        !await checker.checkIp(`${chain}${ip}`, chain) ||
        !await checker.checkDiscord(discord_user.id, chain)) {
      res.status(429).send({ result: "You requested too often" })
      return
    }

    await checker.update(`${chain}${ip}`) // get ::1 on localhost
    await checker.update(address)
    await checker.update(discord_user.id)

    await mutex.runExclusive(async () => {
      await sendTx(address, chain).then(ret => {
        console.log('send tokens to ', address, ip, discord_user)
        checker.update(`${chain}${ip}`) // get ::1 on localhost
        checker.update(address)
        res.send({ result: { code: ret.code, tx_hash: ret.transactionHash, height: ret.height } })
      }).catch(err => {
        res.status(500).send({ result: `err: ${err}` })
      });
    });
  } catch (err) {
    console.error(err.message, address, ip);

    if (err == E_TIMEOUT) {
      return res.status(500).send({ result: 'Faucet is busy, Please try again later.' })
    }
    res.status(500).send({ result: 'Failed, Please contact to admin.' })
  }
})

app.post('/getToken', async (req, res) => {
  const tokenResponseData = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      code: req.body.code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.FRONTEND_URL,
      scope: 'identify',
    }).toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const oauthData = await tokenResponseData.json();
  return res.json(oauthData)
});

app.get("/p/getMe", async (req, res) => {
  const authString = req.headers.authorization
  const user = await getDiscordUser(authString)
  res.json(user)
});

app.listen(conf.port, () => {
  console.log(`Faucet app listening on port ${conf.port}`)
})

async function sendTx(recipient, chain) {
  const chainConf = conf.blockchains.find(x => x.name === chain)
  if (!chainConf) {
    throw new Error(`Blockchain Config [${chain}] not found`)
  }

  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(chainConf.sender.mnemonic, chainConf.sender.option);
  const [firstAccount] = await wallet.getAccounts();
  // console.log("sender", firstAccount);

  const rpcEndpoint = chainConf.endpoint.rpc_endpoint;
  const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);

  const amount = chainConf.tx.amount;
  const fee = chainConf.tx.fee;
  // console.log("recipient", recipient, amount, fee);

  return client.sendTokens(firstAccount.address, recipient, amount, fee);
}

async function validateRecaptcha(recaptcha) {
  const secret = process.env.RECAPTCHA_SECRET
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${recaptcha}`
  const response = await fetch(url, { method: 'POST' })
  const data = await response.json()
  return data.success && data.action === RECAPTCHA_ACTION && data.score > 0.8
}

async function belongsToServer(discord_token) {
  try {
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        authorization: `Bearer ${discord_token}`,
      },
    });
    const data = await response.json()
    return data.some(guild => guild.id === process.env.ALIGNED_SERVER_ID)
  } catch (err) {
    return false
  }
}

async function getDiscordUser(discord_token) {
  try {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        authorization: `Bearer ${discord_token}`,
      },
    });
    const data = await response.json()
    const {id, username} = data;
    return {id, username}
  } catch (err) {
    return null
  }
}
