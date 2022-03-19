# Donation DApp

## Installation

- (Rust) [rustup](https://www.rust-lang.org/tools/install)
- (Solana) [solan-cli](https://docs.solana.com/cli/install-solana-cli-tools) 1.8.12
- (Anchor) [anchor](https://book.anchor-lang.com/chapter_2/installation.html) 0.22.1
- (Node) [node](https://github.com/nvm-sh/nvm) 17.4.0

## Setup

### Anchor build & test

```
% anchor build
% anchor test --provider.cluster=localnet
```

### Install React packages

```
% cd app
% yarn install
```

## Run DApps

```
% cd app
% yarn start
```

Go to http://localhost:3000

Open Console tab in DevTools

Change Network your Phantom. Phantom settings > Change Network > select "devnet"

## Withdraw authority

Keypair for withdraw authority can be found in `keys/authority.json`